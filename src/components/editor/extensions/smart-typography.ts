/**
 * Live, locale-aware typography as Tiptap input rules.
 *
 * Every rule is an ordinary Tiptap InputRule, so it is undoable right after it fires:
 *  - Backspace runs `undoInputRule` (restores exactly what was typed),
 *  - Cmd/Ctrl+Z undoes the conversion as a separate history step (Tiptap closes history before the rule).
 * Rules never fire inside code blocks or inline code (Tiptap skips those).
 *
 * The heavier, whole-document cleanup (no-break spaces, quote normalization, dashes in ranges…) is the
 * "Типограф" command (./typograph.ts) — live rules are deliberately conservative.
 */
import { Extension, InputRule, type ExtendedRegExpMatchArray } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import type { Locale } from "@/lib/i18n/config";
import {
  NBSP,
  isSentenceStart,
  smartDoubleQuote,
  smartSingleQuote,
} from "@/lib/content/typography";

type Range = { from: number; to: number };
type Compute = (match: ExtendedRegExpMatchArray, ctx: { state: EditorState; range: Range; before: string }) => string | null;

/**
 * Build a rule replacing the whole match with `compute(...)`. `before` is the block text preceding the match.
 * Returning null (or the unchanged text) lets the keystroke through untouched.
 */
function rule(find: RegExp, compute: Compute): InputRule {
  return new InputRule({
    find,
    handler: ({ state, range, match }) => {
      const input = match.input ?? "";
      const before = input.slice(0, input.length - match[0].length);
      const out = compute(match, { state, range, before });
      if (out === null || out === match[0]) return null;
      state.tr.insertText(out, range.from, range.to);
    },
  });
}

/** Text right after the cursor in the current block (to avoid touching the middle of words). */
function textAfter(state: EditorState, pos: number): string {
  const $pos = state.doc.resolve(pos);
  return $pos.parent.textBetween($pos.parentOffset, $pos.parent.content.size, undefined, " ");
}

/** Is the cursor inside a link? (no capitalization / quote magic in URLs) */
function inLink(state: EditorState, pos: number): boolean {
  return state.doc
    .resolve(pos)
    .marks()
    .some((m) => m.type.name === "link");
}

export type SmartTypographyOptions = { locale: Locale };

export const SmartTypography = Extension.create<SmartTypographyOptions>({
  name: "smartTypography",

  addOptions() {
    return { locale: "ru" };
  },

  addInputRules() {
    const locale = this.options.locale;
    const cyr = locale !== "en";
    const dashSpace = cyr ? NBSP : " ";

    return [
      // ── Quotes & apostrophes ──
      rule(/"$/, (_m, { before, state, range }) => (inLink(state, range.from) ? null : smartDoubleQuote(before, locale))),
      rule(/'$/, (_m, { before, state, range }) => (inLink(state, range.from) ? null : smartSingleQuote(before, locale))),

      // ── Dashes ──
      // "--" → "—" (with a no-break space before it in ru/uk when preceded by a space).
      rule(/( ?)--$/, (m) => (m[1] ? `${dashSpace}—` : "—")),
      // "word - " → "word — " (ru/uk: no-break space before the dash).
      rule(/(\S) - $/, (m) => `${m[1]}${dashSpace}— `),

      // ── Symbols ──
      rule(/\.\.\.$/, () => "…"),
      rule(/\((?:c|с)\)$/i, () => "©"),
      rule(/\(r\)$/i, () => "®"),
      rule(/\(tm\)$/i, () => "™"),
      rule(/->$/, () => "→"),
      rule(/<-$/, () => "←"),
      rule(/\+-$/, () => "±"),
      rule(/<<$/, () => "«"),
      rule(/>>$/, () => "»"),

      // ── Spacing ──
      // No space before , . ! ? (":" and ";" are left alone live because of smileys like " :)").
      rule(/(\S)[ \u00A0]([,.!?])$/, (m) => {
        // After other punctuation (": .", "— .") the space is intentional (e.g. an ellipsis is coming).
        if (/[\p{P}\p{S}]/u.test(m[1])) return null;
        return `${m[1]}${m[2]}`;
      }),
      // Collapse a second consecutive space.
      rule(/([ \u00A0]) $/, (m) => m[1]),
      // Missing space after a comma before a letter: "раз,два" → "раз, два" (not in URLs/numbers).
      rule(/(\S*),(\p{L})$/u, (m) => (/[/@.:=&?#]/.test(m[1]) || m[1] === "" ? null : `${m[1]}, ${m[2]}`)),

      // ── Capitalization ──
      // First letter of a block or a sentence. Never in the middle of a word or inside links.
      rule(/(\p{Ll})$/u, (m, { before, state, range }) => {
        if (inLink(state, range.from)) return null;
        const after = textAfter(state, range.to);
        if (/^[\p{L}\p{N}]/u.test(after)) return null; // editing inside an existing word
        if (/[\p{L}\p{N}]$/u.test(before)) return null; // not a word start
        const core = before.replace(/[«„“"‘(]+$/u, "");
        const blockStart = core.replace(/[\s\u00A0—–-]/g, "") === "";
        if (!blockStart && !(/[\s\u00A0]$/.test(core) && isSentenceStart(core))) return null;
        return m[1].toUpperCase();
      }),
      // English pronoun "i" → "I".
      ...(locale === "en" ? [rule(/(^|\s)i([\s,.!?’'])$/, (m) => `${m[1]}I${m[2]}`)] : []),
    ];
  },
});
