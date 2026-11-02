/**
 * Locale-aware typography ("типограф") — pure string functions, no DOM, no ProseMirror.
 *
 * Used by:
 *  - the editor's live input rules (small, conservative helpers: `smartQuote`, `shouldCapitalize`, …)
 *  - the "Типограф" button, which runs `typographText` over every text block and applies the diff
 *    as a single ProseMirror transaction (see src/components/editor/extensions/typograph.ts)
 *
 * Text handed to `typographText` may contain OBJECT_CHAR (U+FFFC) for things that must never change
 * (inline code, hard breaks, inline nodes). Rules never create or remove that character.
 */
import type { Locale } from "@/lib/i18n/config";

export const NBSP = "\u00A0";
export const OBJECT_CHAR = "\uFFFC";

const L = "\\p{L}";
const LU = "\\p{Lu}";
const LL = "\\p{Ll}";

/* ───────────────────────── Quotes ───────────────────────── */

type QuoteSet = { open: [string, string]; close: [string, string] };

/** Outer and nested quote marks per locale. ru/uk: «ёлочки» with nested „лапки“; en: “curly” with nested ‘single’. */
export const QUOTES: Record<Locale, QuoteSet> = {
  ru: { open: ["«", "„"], close: ["»", "“"] },
  uk: { open: ["«", "„"], close: ["»", "“"] },
  en: { open: ["“", "‘"], close: ["”", "’"] },
};

/** Characters after which a quote is an OPENING one (locale-specific opening quotes included). */
const OPENING_CONTEXT: Record<Locale, RegExp> = {
  ru: /[\s([{<«„—–\-/\u00A0\uFFFC]/,
  uk: /[\s([{<«„—–\-/\u00A0\uFFFC]/,
  en: /[\s([{<“‘—–\-/\u00A0\uFFFC]/,
};

/** Is a straight quote typed after `before` an opening quote? */
export function isOpeningContext(before: string, locale: Locale): boolean {
  if (before.length === 0) return true;
  return OPENING_CONTEXT[locale].test(before[before.length - 1]);
}

/**
 * Current nesting depth of double quotes in `text` (count of unclosed outer/inner quotes),
 * considering both locale-specific marks and straight quotes.
 */
export function quoteDepth(text: string, locale: Locale): number {
  const { open, close } = QUOTES[locale];
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === open[0] || (locale !== "en" && ch === open[1])) depth++;
    else if ((ch === close[0] || (locale !== "en" && ch === close[1])) && depth > 0) depth--;
  }
  return depth;
}

/** Replacement for a straight double quote typed at the end of `before` (live input rule). */
export function smartDoubleQuote(before: string, locale: Locale): string {
  const { open, close } = QUOTES[locale];
  const depth = quoteDepth(before, locale);
  if (isOpeningContext(before, locale)) {
    // en nests “ … ‘ … ’ … ” but single quotes are typed separately; keep double quotes double in en.
    return locale === "en" ? open[0] : open[Math.min(depth, 1)];
  }
  if (depth <= 0) return close[0];
  return locale === "en" ? close[0] : close[Math.min(depth - 1, 1)];
}

/** Replacement for a straight single quote typed at the end of `before`: apostrophe or (en) opening ‘. */
export function smartSingleQuote(before: string, locale: Locale): string {
  if (locale === "en" && isOpeningContext(before, locale)) return "‘";
  return "’";
}

/**
 * Normalize all double quotes in a block of text: straight and "foreign" curly quotes become the locale's
 * marks with correct nesting. Leaves the text unchanged when quotes are unbalanced (conservative).
 */
export function normalizeQuotes(text: string, locale: Locale): string {
  const { open, close } = QUOTES[locale];
  // Quote-like characters we are allowed to re-derive.
  const candidates = locale === "en" ? /["“”«»„]/ : /["“”„«»]/;
  if (!candidates.test(text)) return text;

  type Tok = { index: number; role: "open" | "close" };
  const tokens: Tok[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!candidates.test(ch)) continue;
    if (locale === "en" && (ch === "«" || ch === "»")) continue; // guillemets in English text are intentional
    let role: Tok["role"];
    if (ch === "«" || ch === "„") role = "open";
    else if (ch === "»") role = "close";
    else {
      const prev = tokens[tokens.length - 1];
      // Directly after an opening quote ("«„…") a quote opens again; otherwise decide by the preceding char.
      const afterOpen = prev && prev.index === i - 1 && prev.role === "open";
      role = afterOpen || i === 0 || /[\s([{<—–\-/\u00A0\uFFFC]/.test(text[i - 1]) ? "open" : "close";
    }
    tokens.push({ index: i, role });
  }

  // Validate balance & assign depth.
  const out = text.split("");
  let depth = 0;
  for (const tok of tokens) {
    if (tok.role === "open") {
      out[tok.index] = locale === "en" ? open[0] : open[Math.min(depth, 1)];
      depth++;
    } else {
      if (depth === 0) return text; // stray closing quote: don't guess
      depth--;
      out[tok.index] = locale === "en" ? close[0] : close[Math.min(depth, 1)];
    }
  }
  return depth === 0 ? out.join("") : text;
}

/* ───────────────────────── Capitalization ───────────────────────── */

/** Abbreviations after which a period does not end a sentence. Lowercase, without the trailing dot. */
const ABBREVIATIONS = new Set([
  // ru / uk
  "т", "е", "д", "п", "пр", "др", "г", "гг", "в", "вв", "см", "им", "ул", "стр", "рис", "тыс", "млн", "млрд", "руб",
  "коп", "мин", "сек", "напр", "проф", "доц", "акад", "св", "кв", "обл", "р", "ч", "с", "т.е", "т.д", "т.п", "т.к", "і", "ін", "тис", "грн",
  // en
  "e.g", "i.e", "etc", "vs", "mr", "mrs", "ms", "dr", "st", "no", "jr", "sr", "approx", "inc", "ltd", "fig", "p", "pp",
]);

/**
 * Does `before` (the text preceding a word) end a sentence — i.e. should the next word be capitalized?
 * Conservative: abbreviations, initials, numbers, ellipses and URLs never count as sentence ends.
 */
export function isSentenceStart(before: string): boolean {
  const text = before.replace(/\u00A0/g, " ");
  if (text.trim() === "") return true;
  const tail = /(\S*?)([.!?…])[»”"’)]*\s+$/u.exec(text);
  if (!tail) return false;
  const [, word, mark] = tail;
  if (mark === "…") return false; // the thought continues
  if (mark !== ".") return true;
  if (word.endsWith(".")) return false; // ".." / "..."
  const bare = word.replace(/^[«„“"(\[]+/u, "").toLowerCase();
  if (bare === "") return true;
  if (/\d$/.test(bare)) return false; // "10. сентября", list numbers
  if (/^\p{L}$/u.test(bare)) return false; // initials "А. С. Пушкин"
  if (ABBREVIATIONS.has(bare)) return false;
  if (/[./@:]/.test(bare)) return false; // URLs, emails, "т.е"
  return true;
}

/* ───────────────────────── No-break spaces (ru/uk) ───────────────────────── */

const SHORT_WORDS: Partial<Record<Locale, string[]>> = {
  ru: [
    "а", "в", "во", "и", "к", "ко", "о", "об", "от", "с", "со", "у", "я", "не", "ни", "на", "по", "за", "из", "до",
    "но", "да", "же", "ли", "бы", "мы", "вы", "он", "то", "из-за", "из-под",
  ],
  uk: ["а", "в", "і", "й", "з", "у", "о", "та", "на", "до", "за", "по", "не", "ні", "із", "зі", "що", "як", "я", "ви", "ми", "он", "це"],
};
/** Particles bound to the PREVIOUS word (no-break space before them). */
const TRAILING_PARTICLES: Partial<Record<Locale, string[]>> = {
  ru: ["же", "ли", "бы", "ль", "б", "ж"],
  uk: ["ж", "же", "б", "би", "бо"],
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ───────────────────────── Full pass ───────────────────────── */

export type TypographOptions = {
  /** Insert no-break spaces after short words / before dashes (ru/uk). Default true. */
  nbsp?: boolean;
  /** Capitalize sentence starts. Default true. */
  capitalize?: boolean;
};

type Rule = [RegExp, string | ((...args: string[]) => string)];

/**
 * Full typographic cleanup of ONE text block (paragraph/heading). Pure and idempotent:
 * `typographText(typographText(x)) === typographText(x)`.
 */
export function typographText(input: string, locale: Locale, options: TypographOptions = {}): string {
  const { nbsp = true, capitalize = true } = options;
  const cyr = locale !== "en";
  let text = input;

  // Never touch anything that looks like a URL or e-mail: protect them first.
  const protectedTokens: string[] = [];
  text = text.replace(/\b(?:https?:\/\/|www\.)[^\s«»"“”]+|[\w.+-]+@[\w-]+\.[\w.-]+/gi, (m) => {
    protectedTokens.push(m);
    return `\u0000${protectedTokens.length - 1}\u0000`;
  });

  const rules: Rule[] = [
    // Whitespace: tabs → space, collapse runs (keeping a no-break space if one was there), trim block.
    [/\t/g, " "],
    [/[ \u00A0]{2,}/g, (m) => (m.includes(NBSP) ? NBSP : " ")],
    [/^[ \u00A0]+|[ \u00A0]+$/g, ""],

    // Symbols.
    [/\.{3,}/g, "…"],
    [/\((?:c|с)\)/gi, "©"], // latin c or cyrillic с
    [/\(r\)/gi, "®"],
    [/\(tm\)/gi, "™"],
    [/->/g, "→"],
    [/<-/g, "←"],
    [/\+-/g, "±"],
    [/(^|[\s(])1\/2(?=$|[\s,.;:!?)])/g, "$1½"],
    [/<</g, "«"],
    [/>>/g, "»"],

    // Dashes: "--" and spaced hyphen → em dash; dialogue dash at block start; number ranges → en dash.
    [/(\S)[ \u00A0]*--[ \u00A0]*/g, "$1 — "],
    [/(\S)[ \u00A0]+[-–][ \u00A0]+/g, "$1 — "],
    [/(\S)[ \u00A0]+—(?=\S)/g, "$1 — "],
    [/^(?:-|–|--)[ \u00A0]+/g, `—${NBSP}`],
    [/(^|[^\d\-–\p{L}])(\d{1,4})-(\d{1,4})(?![\d\-–])/gu, "$1$2–$3"],

    // Punctuation spacing: no space before , . ! ? : ; … ) » ” (but keep smileys like " :)" " ;)").
    [/[ \u00A0]+([,.!?;:…])(?![)(DPdp])/g, "$1"],
    [/[ \u00A0]+([)\]»”])/g, "$1"],
    [/([(\[«„])[ \u00A0]+/g, "$1"],
    // Space after , ; : ! ? when directly followed by a letter.
    [new RegExp(`([,;!?])(?=${L})`, "gu"), "$1 "],
    [new RegExp(`(${L}{2,}):(?=${L}{2,})`, "gu"), "$1: "],
    [new RegExp(`(${L})…(?=${L})`, "gu"), "$1… "],
    // Space after a period between a lowercase word and a capitalized word: "конец.Начало".
    [new RegExp(`(${LL}{2,})\\.(?=${LU}${LL})`, "gu"), "$1. "],
    // Apostrophes inside words.
    [new RegExp(`(${L})'(?=${L})`, "gu"), "$1’"],
  ];

  for (const [pattern, replacement] of rules) {
    text = text.replace(pattern, replacement as string);
  }

  // Quotes (balanced only).
  text = normalizeQuotes(text, locale);
  if (locale === "en") {
    // Remaining single straight quotes: opening ‘ after whitespace, otherwise apostrophe/closing ’.
    text = text.replace(/(^|[\s(\[“])'/g, "$1‘").replace(/'/g, "’");
  }

  if (cyr) {
    // Em dash binds to the previous word with a no-break space: "слово — слово".
    text = text.replace(/(\S) —/g, `$1${NBSP}—`);
  }

  if (nbsp && cyr) {
    const words = SHORT_WORDS[locale] ?? [];
    const particles = TRAILING_PARTICLES[locale] ?? [];
    if (words.length) {
      const re = new RegExp(
        `(^|[\\s(«„"—\\u00A0])(${words.map(escapeRegExp).join("|")}) (?=[\\p{L}\\p{N}«„"(])`,
        "giu",
      );
      // Run twice so chains like "и в доме" get both spaces.
      text = text.replace(re, `$1$2${NBSP}`).replace(re, `$1$2${NBSP}`);
    }
    if (particles.length) {
      const re = new RegExp(`(\\p{L}) (${particles.map(escapeRegExp).join("|")})(?=$|[\\s,.!?;:…»)])`, "giu");
      text = text.replace(re, `$1${NBSP}$2`);
    }
    // Numbers bind to the following word/unit: "5 км", "2024 год", "10 %".
    text = text.replace(/(\d) (?=[\p{L}%‰°№])/gu, `$1${NBSP}`);
    // "№ 5", "§ 3".
    text = text.replace(/([№§]) ?(?=\d)/g, `$1${NBSP}`);
  }

  if (capitalize) {
    text = capitalizeSentences(text);
  }

  // Restore protected tokens.
  text = text.replace(/\u0000(\d+)\u0000/g, (_, i: string) => protectedTokens[Number(i)] ?? "");
  return text;
}

/** Uppercase the first letter of each sentence (conservative, see `isSentenceStart`). */
export function capitalizeSentences(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\p{Ll}/u.test(ch) && !/[\p{L}\p{N}]/u.test(out[out.length - 1] ?? "") && shouldCapitalizeAt(out, text.slice(i))) {
      out += ch.toUpperCase();
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Should the word starting `rest` (preceded by `before`) be capitalized?
 * Skips words with inner capitals ("iPhone") and one-letter words.
 */
export function shouldCapitalizeAt(before: string, rest: string): boolean {
  const word = /^\p{L}+/u.exec(rest)?.[0] ?? "";
  if (word.length === 0 || /\p{Lu}/u.test(word.slice(1))) return false;
  // One-letter words ("в", "я", "I") only when they are real words, not list markers like "a)".
  if (word.length === 1 && !/^[\s\u00A0]/.test(rest.slice(1))) return false;
  if (/^[a-z]/.test(word) && /[\/@.]/.test(rest.slice(word.length, word.length + 1))) return false; // "example.com"
  const core = before.replace(/[«„“"(]+$/u, "");
  if (core.replace(/[\s\u00A0—–-]/g, "") === "") return true; // block start (incl. dialogue dash)
  if (!/[\s\u00A0]$/.test(core)) return false;
  return isSentenceStart(core);
}

/** Count of the differences between two strings, as hunks (for "N fixes" toasts). */
export function countChanges(a: string, b: string): number {
  return diffChars(a, b).length;
}

/* ───────────────────────── Character diff ───────────────────────── */

export type Hunk = {
  /** start offset in the OLD string */
  from: number;
  /** end offset (exclusive) in the OLD string */
  to: number;
  /** replacement text */
  insert: string;
};

/**
 * Myers O(ND) diff on characters, returning replacement hunks against the old string (in ascending order).
 * Typograph edits are small and sparse, so D stays tiny even for long paragraphs.
 */
export function diffChars(a: string, b: string): Hunk[] {
  if (a === b) return [];
  // Trim common prefix/suffix for speed.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const A = a.slice(start, endA);
  const B = b.slice(start, endB);
  const n = A.length;
  const m = B.length;
  const max = n + m;
  // Too different (shouldn't happen for typograph) → one hunk.
  if (max > 20000) return [{ from: start, to: endA, insert: B }];

  const offset = max;
  const v = new Int32Array(2 * max + 2);
  const trace: Int32Array[] = [];
  let found = false;
  for (let d = 0; d <= max && !found; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) x = v[offset + k + 1];
      else x = v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && A[x] === B[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = true;
        break;
      }
    }
  }
  trace.push(v.slice());

  // Backtrack to an edit script of (op, aIndex, bIndex).
  type Op = { type: "del"; ai: number } | { type: "ins"; ai: number; bi: number };
  const ops: Op[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 2; d >= 0 && (x > 0 || y > 0); d--) {
    const vd = trace[d];
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && vd[offset + k - 1] < vd[offset + k + 1])) prevK = k + 1;
    else prevK = k - 1;
    const prevX = vd[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      x--;
      y--;
    }
    if (d === 0) break;
    if (x === prevX) ops.push({ type: "ins", ai: x, bi: prevY });
    else ops.push({ type: "del", ai: prevX });
    x = prevX;
    y = prevY;
  }
  ops.reverse();

  // Merge adjacent ops into hunks.
  const hunks: Hunk[] = [];
  for (const op of ops) {
    const last = hunks[hunks.length - 1];
    if (op.type === "del") {
      if (last && last.to === start + op.ai) last.to++;
      else hunks.push({ from: start + op.ai, to: start + op.ai + 1, insert: "" });
    } else {
      const ch = B[op.bi];
      if (last && last.to === start + op.ai) last.insert += ch;
      else hunks.push({ from: start + op.ai, to: start + op.ai, insert: ch });
    }
  }
  return hunks;
}
