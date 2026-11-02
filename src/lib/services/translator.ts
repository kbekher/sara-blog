import "server-only";
import { randomUUID } from "node:crypto";
import { translatorCodes, type Locale } from "@/lib/i18n/config";
import { PHOTO_CREDIT_CLASS } from "@/lib/content/extensions";

/**
 * Microsoft Translator (Azure AI Translator), Text Translation REST API v3.
 * https://learn.microsoft.com/azure/ai-services/translator/text-translation/reference/v3/translate
 *
 * Env: AZURE_TRANSLATOR_KEY (required), AZURE_TRANSLATOR_REGION (required for regional / multi-service
 * resources, e.g. "westeurope"), AZURE_TRANSLATOR_ENDPOINT (optional; defaults to the global endpoint).
 */

const DEFAULT_ENDPOINT = "https://api.cognitive.microsofttranslator.com";
/** API limits per request: ≤ 1000 array elements and ≤ 50,000 characters in total. */
const MAX_REQUEST_ELEMENTS = 1000;
const MAX_REQUEST_CHARS = 50_000;
/** Long HTML is split at top-level block boundaries into pieces of at most this size. */
const MAX_PIECE_CHARS = 45_000;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
/** Upper bound for a single wait between retries (server actions must not hang for minutes). */
const MAX_RETRY_DELAY_MS = 15_000;

/** Error with a Russian, user-facing message (shown in the admin UI). */
export class TranslationError extends Error {
  constructor(
    readonly userMessage: string,
    options?: { cause?: unknown },
  ) {
    super(userMessage, options);
    this.name = "TranslationError";
  }
}

export function isTranslatorConfigured(): boolean {
  return Boolean(process.env.AZURE_TRANSLATOR_KEY?.trim());
}

function config() {
  const key = process.env.AZURE_TRANSLATOR_KEY?.trim();
  if (!key) throw new TranslationError("Перевод недоступен: не задан AZURE_TRANSLATOR_KEY.");
  const region = process.env.AZURE_TRANSLATOR_REGION?.trim() || undefined;
  const endpoint = (process.env.AZURE_TRANSLATOR_ENDPOINT?.trim() || DEFAULT_ENDPOINT).replace(/\/+$/, "");
  return { key, region, endpoint };
}

/* ───────────────────────── HTML protection ───────────────────────── */

const NOTRANSLATE = "notranslate";

/** Adds `notranslate` to the class attribute of a single opening tag. */
function addNotranslate(tag: string): string {
  const withClass = tag.replace(/\sclass=(["'])(.*?)\1/i, (_m, q: string, value: string) =>
    ` class=${q}${value.split(/\s+/).includes(NOTRANSLATE) ? value : `${value} ${NOTRANSLATE}`.trim()}${q}`,
  );
  if (withClass !== tag) return withClass;
  return tag.replace(/^<([a-z0-9]+)/i, `<$1 class="${NOTRANSLATE}"`);
}

const PROTECTED_TAG = new RegExp(
  `<(?:pre|code)(?:\\s[^>]*)?>|<span\\s[^>]*class=(["'])[^"']*\\b${PHOTO_CREDIT_CLASS}\\b[^"']*\\1[^>]*>`,
  "gi",
);

/** Marks code blocks, inline code and generated photo credits as `class="notranslate"` (honoured by Microsoft). */
export function protectHtml(html: string): string {
  return html.replace(PROTECTED_TAG, addNotranslate);
}

/** Removes the `notranslate` markers again so they never reach stored HTML. */
export function unprotectHtml(html: string): string {
  return html.replace(/\sclass=(["'])(.*?)\1/gi, (whole, q: string, value: string) => {
    const tokens = value.split(/\s+/).filter(Boolean);
    if (!tokens.includes(NOTRANSLATE)) return whole;
    const rest = tokens.filter((t) => t !== NOTRANSLATE);
    return rest.length ? ` class=${q}${rest.join(" ")}${q}` : "";
  });
}

/* ───────────────────────── Chunking ───────────────────────── */

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/**
 * Splits HTML into consecutive pieces of at most `max` characters, cutting only between top-level
 * elements (after a closing tag or a void element such as <hr> at depth 0). Joining the pieces gives
 * back the input. A single top-level block longer than `max` stays one (oversized) piece.
 */
export function splitHtmlBlocks(html: string, max = MAX_PIECE_CHARS): string[] {
  if (html.length <= max) return [html];
  const boundaries: number[] = [];
  let depth = 0;
  for (const m of html.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*?(\/?)>/gi)) {
    const [whole, closing, rawName, selfClosing] = m;
    const name = rawName!.toLowerCase();
    const end = m.index + whole.length;
    if (closing) {
      depth = Math.max(0, depth - 1);
      if (depth === 0) boundaries.push(end);
    } else if (VOID_TAGS.has(name) || selfClosing) {
      if (depth === 0) boundaries.push(end);
    } else {
      depth++;
    }
  }

  const pieces: string[] = [];
  let start = 0;
  let lastCut = -1; // best boundary seen within the current piece
  for (const b of boundaries) {
    if (b - start > max && lastCut > start) {
      pieces.push(html.slice(start, lastCut));
      start = lastCut;
    }
    lastCut = b;
  }
  if (html.length - start > max && lastCut > start && lastCut < html.length) {
    pieces.push(html.slice(start, lastCut));
    start = lastCut;
  }
  pieces.push(html.slice(start));
  return pieces.filter((p) => p.length > 0);
}

/** Groups element indexes into requests that respect the per-request element and character limits. */
function packRequests(elements: string[]): number[][] {
  const requests: number[][] = [];
  let current: number[] = [];
  let chars = 0;
  elements.forEach((text, i) => {
    if (current.length > 0 && (chars + text.length > MAX_REQUEST_CHARS || current.length >= MAX_REQUEST_ELEMENTS)) {
      requests.push(current);
      current = [];
      chars = 0;
    }
    current.push(i);
    chars += text.length;
  });
  if (current.length > 0) requests.push(current);
  return requests;
}

/* ───────────────────────── HTTP ───────────────────────── */

type ApiError = { error?: { code?: number; message?: string } };
type ApiResult = { translations?: { text?: string; to?: string }[] }[];

function userMessageFor(status: number, code?: number): string {
  if (status === 401) {
    return "Microsoft Translator отклонил ключ. Проверьте AZURE_TRANSLATOR_KEY и AZURE_TRANSLATOR_REGION (регион ресурса, например westeurope).";
  }
  if (status === 403) {
    return "Исчерпан лимит Microsoft Translator (бесплатный тариф — 2 млн символов в месяц). Попробуйте в следующем месяце или опубликуйте без перевода.";
  }
  if (status === 429) return "Microsoft Translator временно ограничил число запросов. Подождите минуту и попробуйте снова.";
  if (status === 400) {
    return code === 400050
      ? "Текст слишком длинный для одного запроса к Microsoft Translator."
      : "Microsoft Translator отклонил запрос (неверные параметры). Попробуйте ещё раз или опубликуйте без перевода.";
  }
  if (status === 408 || status >= 500) return "Сервис перевода Microsoft Translator сейчас недоступен. Попробуйте позже.";
  return "Ошибка перевода Microsoft Translator. Попробуйте ещё раз позже.";
}

function retryDelayMs(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    const ms = Number.isFinite(seconds) ? seconds * 1000 : new Date(header).getTime() - Date.now();
    if (Number.isFinite(ms) && ms >= 0) return Math.min(ms, MAX_RETRY_DELAY_MS);
  }
  return Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestTranslations(texts: string[], from: Locale, to: Locale, html: boolean): Promise<string[]> {
  const { key, region, endpoint } = config();
  const params = new URLSearchParams({ "api-version": "3.0", from: translatorCodes[from], to: translatorCodes[to] });
  if (html) params.set("textType", "html");
  const url = `${endpoint}/translate?${params}`;
  const body = JSON.stringify(texts.map((Text) => ({ Text })));

  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          ...(region ? { "Ocp-Apim-Subscription-Region": region } : {}),
          "Content-Type": "application/json; charset=UTF-8",
          "X-ClientTraceId": randomUUID(),
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      throw new TranslationError(
        timedOut
          ? "Microsoft Translator не ответил вовремя. Попробуйте ещё раз."
          : "Не удалось связаться с Microsoft Translator. Проверьте соединение и попробуйте снова.",
        { cause: error },
      );
    }

    if (response.ok) {
      const data = (await response.json().catch(() => null)) as ApiResult | null;
      const out = Array.isArray(data) ? data.map((item) => item.translations?.[0]?.text) : [];
      if (out.length !== texts.length || out.some((t) => typeof t !== "string")) {
        throw new TranslationError("Microsoft Translator вернул неожиданный ответ. Попробуйте ещё раз позже.", {
          cause: new Error(`Unexpected response shape: ${JSON.stringify(data)?.slice(0, 500)}`),
        });
      }
      return out as string[];
    }

    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < MAX_RETRIES) {
      const delay = retryDelayMs(response, attempt);
      await response.body?.cancel().catch(() => {});
      console.warn(`[translator] HTTP ${response.status}, retrying in ${delay} ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(delay);
      continue;
    }

    const raw = await response.text().catch(() => "");
    let parsed: ApiError | null = null;
    try {
      parsed = JSON.parse(raw) as ApiError;
    } catch {
      /* non-JSON body */
    }
    const code = parsed?.error?.code;
    const message = parsed?.error?.message ?? raw.slice(0, 500);
    throw new TranslationError(userMessageFor(response.status, code), {
      cause: new Error(`Microsoft Translator HTTP ${response.status}${code ? ` (${code})` : ""}: ${message}`),
    });
  }
}

/* ───────────────────────── Public API ───────────────────────── */

type BatchOptions = { html: boolean };

/**
 * Translates many strings, normally in ONE API call (more only when the request limits require it,
 * in a stable order). Empty strings are skipped and returned as "". In HTML mode, <pre>/<code> and
 * photo credits are marked `notranslate` for the request (markers are removed from the result), and
 * texts longer than ~45k characters are split at top-level block boundaries and joined back.
 */
export async function translateBatch(texts: string[], from: Locale, to: Locale, { html }: BatchOptions): Promise<string[]> {
  if (from === to) return [...texts];
  const out = texts.map(() => "");

  // Flatten into API elements; `owner[j]` is the index in `texts` that element j belongs to.
  const elements: string[] = [];
  const owner: number[] = [];
  texts.forEach((text, i) => {
    if (!text.trim()) return;
    const prepared = html ? protectHtml(text) : text;
    const pieces = html ? splitHtmlBlocks(prepared) : [prepared];
    for (const piece of pieces) {
      elements.push(piece);
      owner.push(i);
    }
  });
  if (elements.length === 0) return out;

  try {
    const translated: string[] = [];
    for (const group of packRequests(elements)) {
      const result = await requestTranslations(group.map((j) => elements[j]!), from, to, html);
      translated.push(...result);
    }
    translated.forEach((text, j) => {
      out[owner[j]!] += text;
    });
    return html ? out.map(unprotectHtml) : out;
  } catch (error) {
    const translationError =
      error instanceof TranslationError
        ? error
        : new TranslationError("Ошибка перевода Microsoft Translator. Попробуйте ещё раз позже.", { cause: error });
    console.error(`[translator] ${from} → ${to} failed:`, translationError.cause ?? error);
    throw translationError;
  }
}
