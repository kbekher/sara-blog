/**
 * LanguageTool grammar / spelling / style checking as a ProseMirror plugin.
 *
 * How it works
 *  - Every text block (paragraph, heading, list item paragraph…; never code) is converted to plain text with a
 *    1:1 offset → document position map (inline code and inline nodes are blanked out with spaces).
 *  - Results are cached per block text (+ language). After ~1.2 s of idle typing, blocks whose text isn't in
 *    the cache are batched (joined with "\n\n", ≤ ~6000 chars ≈ < 20 KB) and POSTed to /api/languagetool.
 *  - Requests are throttled (≥ 3.2 s apart, ≤ 18/min — the public LT API allows ~20/min), one in flight at a
 *    time; HTTP 429 pauses checking with exponential back-off. Typing is never blocked: all of this is async
 *    and decorations are simply mapped through edits in the meantime.
 *  - Decorations: wavy underline, red = misspelling, amber = grammar, blue = style/typography.
 *  - Clicking an underline opens a popover (React, see ../lt-popover.tsx) via `onOpen`.
 *  - "Пропустить" (ignore rule+word) and "Добавить в словарь" (personal dictionary) live in localStorage and
 *    apply immediately.
 */
import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { LanguageToolMatch } from "@/lib/admin/types";
import { languageToolCodes, type Locale } from "@/lib/i18n/config";

export type LTKind = "spelling" | "grammar" | "style";

export type LTIssue = {
  from: number;
  to: number;
  word: string;
  kind: LTKind;
  match: LanguageToolMatch;
};

export type LTStatus =
  | { state: "off" }
  | { state: "idle"; count: number }
  | { state: "checking"; count: number }
  | { state: "paused"; count: number; reason: string }
  | { state: "error"; count: number; reason: string };

export type LanguageToolOptions = {
  locale: Locale;
  enabled: boolean;
  endpoint: string;
  onStatus?: (status: LTStatus) => void;
  /** Called when the user clicks an underlined range. `rect` is in viewport coordinates. */
  onOpen?: (issue: LTIssue, rect: { left: number; top: number; bottom: number }) => void;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    languageTool: {
      setLanguageToolEnabled: (enabled: boolean) => ReturnType;
      /** Re-apply ignore list / dictionary (after they changed). */
      refreshLanguageTool: () => ReturnType;
      ignoreLanguageToolIssue: (issue: LTIssue) => ReturnType;
      addToLanguageToolDictionary: (word: string) => ReturnType;
    };
  }
  interface Storage {
    languageTool: { controller: LTController | null };
  }
}

export const languageToolKey = new PluginKey<LTPluginState>("languageTool");

type LTPluginState = { enabled: boolean; decorations: DecorationSet };
type LTMeta = { type: "set"; decorations: DecorationSet } | { type: "enabled"; enabled: boolean; decorations?: DecorationSet };

/* ───────────────────────── Personal dictionary & ignore list ───────────────────────── */

const DICT_KEY = "sara-editor:lt-dictionary";
const IGNORE_KEY = "sara-editor:lt-ignore";
export const LT_ENABLED_KEY = "sara-editor:lt-enabled";

function readSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}
function writeSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set].slice(-2000)));
  } catch {
    /* storage full / private mode */
  }
}

export function readLanguageToolEnabled(): boolean {
  try {
    return localStorage.getItem(LT_ENABLED_KEY) !== "0";
  } catch {
    return true;
  }
}
export function writeLanguageToolEnabled(enabled: boolean) {
  try {
    localStorage.setItem(LT_ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/* ───────────────────────── Text extraction ───────────────────────── */

type Block = { pos: number; text: string; key: string };

function blockText(node: PMNode): string {
  let text = "";
  node.forEach((child) => {
    if (child.isText) {
      const isCode = child.marks.some((m) => m.type.spec.code);
      text += isCode ? " ".repeat(child.text!.length) : child.text!;
    } else if (child.type.name === "hardBreak") {
      text += "\n";
    } else {
      text += " ".repeat(child.nodeSize);
    }
  });
  return text;
}

function collectBlocks(doc: PMNode, lang: string): Block[] {
  const blocks: Block[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (!node.type.spec.code) {
      const text = blockText(node);
      blocks.push({ pos, text, key: `${lang}\u0001${text}` });
    }
    return false;
  });
  return blocks;
}

function kindOf(match: LanguageToolMatch): LTKind {
  const t = match.issueType;
  if (t === "misspelling") return "spelling";
  if (t === "typographical" || t === "style" || t === "whitespace" || t === "register" || t === "locale-violation") {
    return "style";
  }
  return "grammar";
}

/* ───────────────────────── Controller ───────────────────────── */

const IDLE_MS = 1200;
const MIN_GAP_MS = 3200;
const MAX_PER_MINUTE = 18;
const MAX_BATCH_CHARS = 6000;
const MAX_BLOCK_CHARS = 9000;
const SEPARATOR = "\n\n";

export class LTController {
  private view: EditorView;
  private options: LanguageToolOptions;
  private lang: string;
  private cache = new Map<string, LanguageToolMatch[]>();
  private pending = new Set<string>();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  private requestTimes: number[] = [];
  private backoffUntil = 0;
  private backoffMs = 15000;
  private destroyed = false;
  private lastStatus: LTStatus = { state: "off" };
  dictionary: Set<string>;
  ignored: Set<string>;

  constructor(view: EditorView, options: LanguageToolOptions) {
    this.view = view;
    this.options = options;
    this.lang = languageToolCodes[options.locale];
    this.dictionary = readSet(DICT_KEY);
    this.ignored = readSet(IGNORE_KEY);
  }

  get enabled(): boolean {
    return languageToolKey.getState(this.view.state)?.enabled ?? false;
  }

  /** Called by the plugin view on every state update. */
  onUpdate(docChanged: boolean) {
    if (!this.enabled) return;
    if (docChanged) this.schedule(IDLE_MS);
    else this.emitStatus();
  }

  schedule(delay = IDLE_MS) {
    if (this.destroyed) return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      void this.run();
    }, delay);
  }

  /** Count of currently shown issues. */
  count(): number {
    const state = languageToolKey.getState(this.view.state);
    return state ? state.decorations.find().length : 0;
  }

  private emitStatus(next?: LTStatus) {
    const status: LTStatus =
      next ??
      (!this.enabled
        ? { state: "off" }
        : this.inFlight || this.pending.size
          ? { state: "checking", count: this.count() }
          : this.lastStatus.state === "paused" || this.lastStatus.state === "error"
            ? { ...this.lastStatus, count: this.count() }
            : { state: "idle", count: this.count() });
    const prev = this.lastStatus;
    this.lastStatus = status;
    if (JSON.stringify(prev) !== JSON.stringify(status)) this.options.onStatus?.(status);
  }

  private async run() {
    if (this.destroyed || !this.enabled || this.inFlight) return;
    const now = Date.now();
    if (now < this.backoffUntil) {
      this.retryLater(this.backoffUntil - now);
      return;
    }
    this.requestTimes = this.requestTimes.filter((t) => now - t < 60_000);
    const last = this.requestTimes[this.requestTimes.length - 1] ?? 0;
    const waitGap = last + MIN_GAP_MS - now;
    const waitRate = this.requestTimes.length >= MAX_PER_MINUTE ? this.requestTimes[0] + 60_000 - now : 0;
    const wait = Math.max(waitGap, waitRate);
    if (wait > 0) {
      this.retryLater(wait);
      return;
    }

    // Collect unchecked blocks; the block with the cursor goes last (the user is still typing there).
    const blocks = collectBlocks(this.view.state.doc, this.lang);
    const cursor = this.view.state.selection.from;
    const todo: Block[] = [];
    const seen = new Set<string>();
    let cursorBlock: Block | null = null;
    for (const b of blocks) {
      if (this.cache.has(b.key) || this.pending.has(b.key) || seen.has(b.key)) continue;
      seen.add(b.key);
      if (!/\p{L}{2,}/u.test(b.text) || b.text.length > MAX_BLOCK_CHARS) {
        this.cache.set(b.key, []);
        continue;
      }
      if (cursor >= b.pos && cursor <= b.pos + b.text.length + 1) cursorBlock = b;
      else todo.push(b);
    }
    if (cursorBlock) todo.push(cursorBlock);
    if (todo.length === 0) {
      this.rebuild();
      return;
    }

    const batch: Block[] = [];
    let size = 0;
    for (const b of todo) {
      if (batch.length && size + b.text.length + SEPARATOR.length > MAX_BATCH_CHARS) break;
      batch.push(b);
      size += b.text.length + SEPARATOR.length;
    }
    batch.forEach((b) => this.pending.add(b.key));
    this.inFlight = true;
    this.requestTimes.push(Date.now());
    this.emitStatus();

    const text = batch.map((b) => b.text).join(SEPARATOR);
    try {
      const res = await fetch(this.options.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: this.lang }),
      });
      if (res.status === 429) {
        this.backoffUntil = Date.now() + this.backoffMs;
        this.backoffMs = Math.min(this.backoffMs * 2, 5 * 60_000);
        this.lastStatus = { state: "paused", count: this.count(), reason: "Слишком много проверок — пауза" };
        this.retryLater(this.backoffUntil - Date.now());
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { matches?: LanguageToolMatch[] };
      const matches = Array.isArray(data.matches) ? data.matches : [];
      this.backoffMs = 15000;
      // Split the matches back per block.
      let offset = 0;
      for (const b of batch) {
        const start = offset;
        const end = start + b.text.length;
        this.cache.set(
          b.key,
          matches
            .filter((m) => m.offset >= start && m.offset + m.length <= end)
            .map((m) => ({ ...m, offset: m.offset - start })),
        );
        offset = end + SEPARATOR.length;
      }
      if (this.cache.size > 3000) {
        // Trim the oldest entries.
        const drop = [...this.cache.keys()].slice(0, 1000);
        drop.forEach((k) => this.cache.delete(k));
      }
      this.lastStatus = { state: "idle", count: 0 };
    } catch {
      this.lastStatus = { state: "error", count: this.count(), reason: "Проверка недоступна" };
      this.backoffUntil = Date.now() + 20_000;
      this.retryLater(20_000);
    } finally {
      batch.forEach((b) => this.pending.delete(b.key));
      this.inFlight = false;
    }
    if (this.destroyed) return;
    this.rebuild();
    // More to check? Continue (the throttle decides when).
    this.schedule(50);
  }

  private retryLater(ms: number) {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.run();
    }, ms + 20);
    this.emitStatus();
  }

  /** Build the full decoration set from the cache and the current document. */
  buildDecorations(state: EditorState): DecorationSet {
    const decorations: Decoration[] = [];
    for (const b of collectBlocks(state.doc, this.lang)) {
      const matches = this.cache.get(b.key);
      if (!matches?.length) continue;
      for (const m of matches) {
        if (m.length <= 0 || m.offset + m.length > b.text.length) continue;
        const word = b.text.slice(m.offset, m.offset + m.length);
        if (!word.trim()) continue; // blanked-out code / whitespace-only issues
        const kind = kindOf(m);
        if (kind === "spelling" && this.dictionary.has(word.toLowerCase())) continue;
        if (this.ignored.has(`${m.ruleId}::${word}`)) continue;
        const from = b.pos + 1 + m.offset;
        const to = from + m.length;
        const issue: LTIssue = { from, to, word, kind, match: m };
        decorations.push(
          Decoration.inline(from, to, { class: `lt-mark lt-${kind}`, "data-lt": "1" }, { issue, inclusiveEnd: false }),
        );
      }
    }
    return DecorationSet.create(state.doc, decorations);
  }

  rebuild() {
    if (this.destroyed) return;
    const { state } = this.view;
    const tr = state.tr.setMeta(languageToolKey, { type: "set", decorations: this.buildDecorations(state) } satisfies LTMeta);
    tr.setMeta("addToHistory", false);
    this.view.dispatch(tr);
    this.emitStatus();
  }

  setEnabled(enabled: boolean) {
    writeLanguageToolEnabled(enabled);
    const { state } = this.view;
    const tr = state.tr.setMeta(languageToolKey, {
      type: "enabled",
      enabled,
      decorations: enabled ? this.buildDecorations(state) : DecorationSet.empty,
    } satisfies LTMeta);
    tr.setMeta("addToHistory", false);
    this.view.dispatch(tr);
    if (enabled) this.schedule(100);
    else {
      if (this.idleTimer) clearTimeout(this.idleTimer);
      if (this.retryTimer) clearTimeout(this.retryTimer);
    }
    this.emitStatus();
  }

  ignore(issue: LTIssue) {
    this.ignored.add(`${issue.match.ruleId}::${issue.word}`);
    writeSet(IGNORE_KEY, this.ignored);
    this.rebuild();
  }

  addToDictionary(word: string) {
    this.dictionary.add(word.toLowerCase());
    writeSet(DICT_KEY, this.dictionary);
    this.rebuild();
  }

  destroy() {
    this.destroyed = true;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }
}

/** Ranges (in the new document) touched by a transaction. */
function changedRanges(tr: Transaction): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
  tr.mapping.maps.forEach((map, i) => {
    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      let from = newStart;
      let to = newEnd;
      for (let j = i + 1; j < tr.mapping.maps.length; j++) {
        from = tr.mapping.maps[j].map(from, -1);
        to = tr.mapping.maps[j].map(to, 1);
      }
      ranges.push({ from, to });
    });
  });
  return ranges;
}

export const LanguageTool = Extension.create<LanguageToolOptions, { controller: LTController | null }>({
  name: "languageTool",

  addOptions() {
    return { locale: "ru", enabled: true, endpoint: "/api/languagetool" };
  },

  addStorage() {
    return { controller: null };
  },

  addCommands() {
    return {
      setLanguageToolEnabled:
        (enabled) =>
        () => {
          this.storage.controller?.setEnabled(enabled);
          return true;
        },
      refreshLanguageTool:
        () =>
        () => {
          this.storage.controller?.rebuild();
          return true;
        },
      ignoreLanguageToolIssue:
        (issue) =>
        () => {
          this.storage.controller?.ignore(issue);
          return true;
        },
      addToLanguageToolDictionary:
        (word) =>
        () => {
          this.storage.controller?.addToDictionary(word);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    const storage = this.storage;
    return [
      new Plugin<LTPluginState>({
        key: languageToolKey,
        state: {
          init: () => ({ enabled: options.enabled, decorations: DecorationSet.empty }),
          apply(tr, value) {
            const meta = tr.getMeta(languageToolKey) as LTMeta | undefined;
            if (meta?.type === "enabled") {
              return { enabled: meta.enabled, decorations: meta.decorations ?? DecorationSet.empty };
            }
            if (meta?.type === "set") return { ...value, decorations: meta.decorations };
            if (!tr.docChanged || !value.enabled) return value;
            // Map through the edit and drop issues the edit touched (they're re-checked after idle).
            let decorations = value.decorations.map(tr.mapping, tr.doc);
            for (const { from, to } of changedRanges(tr)) {
              const stale = decorations.find(Math.max(0, from - 1), to + 1);
              if (stale.length) decorations = decorations.remove(stale);
            }
            return { ...value, decorations };
          },
        },
        props: {
          decorations(state) {
            return languageToolKey.getState(state)?.decorations;
          },
          handleClick(view, pos, event) {
            const state = languageToolKey.getState(view.state);
            if (!state?.enabled) return false;
            const target = event.target as HTMLElement | null;
            if (!target?.closest?.("[data-lt]")) return false;
            const found = state.decorations.find(pos, pos).filter((d) => pos >= d.from && pos <= d.to);
            const deco = found[0];
            if (!deco) return false;
            const issue = (deco.spec as { issue: LTIssue }).issue;
            const live: LTIssue = { ...issue, from: deco.from, to: deco.to };
            const start = view.coordsAtPos(deco.from);
            const end = view.coordsAtPos(deco.to);
            options.onOpen?.(live, { left: start.left, top: Math.min(start.top, end.top), bottom: Math.max(start.bottom, end.bottom) });
            return false; // let the cursor move normally
          },
        },
        view(view) {
          const controller = new LTController(view, options);
          storage.controller = controller;
          if (options.enabled) controller.schedule(400);
          return {
            update(v, prev) {
              controller.onUpdate(!v.state.doc.eq(prev.doc));
            },
            destroy() {
              controller.destroy();
              if (storage.controller === controller) storage.controller = null;
            },
          };
        },
      }),
    ];
  },
});
