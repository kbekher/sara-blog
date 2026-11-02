import "server-only";
import * as deepl from "deepl-node";
import type { Locale } from "@/lib/i18n/config";

/** deepl-node uses lowercase codes (the API is case-insensitive). English targets need a variant. */
const SOURCE_CODES: Record<Locale, deepl.SourceLanguageCode> = { ru: "ru", uk: "uk", en: "en" };
const TARGET_CODES: Record<Locale, deepl.TargetLanguageCode> = { ru: "ru", uk: "uk", en: "en-US" };

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

export function isDeepLConfigured(): boolean {
  return Boolean(process.env.DEEPL_API_KEY?.trim());
}

let translator: deepl.Translator | undefined;
function getTranslator(): deepl.Translator {
  const key = process.env.DEEPL_API_KEY?.trim();
  if (!key) throw new TranslationError("Перевод недоступен: не задан DEEPL_API_KEY.");
  // Free keys end with ":fx" — deepl-node picks the right endpoint automatically.
  translator ??= new deepl.Translator(key, { maxRetries: 2, minTimeout: 10_000 });
  return translator;
}

function toTranslationError(error: unknown): TranslationError {
  if (error instanceof TranslationError) return error;
  if (error instanceof deepl.QuotaExceededError) {
    return new TranslationError("Превышен месячный лимит символов DeepL. Попробуйте в следующем месяце или опубликуйте без перевода.", { cause: error });
  }
  if (error instanceof deepl.TooManyRequestsError) {
    return new TranslationError("DeepL временно ограничил число запросов. Подождите минуту и попробуйте снова.", { cause: error });
  }
  if (error instanceof deepl.AuthorizationError) {
    return new TranslationError("DeepL отклонил ключ API. Проверьте DEEPL_API_KEY.", { cause: error });
  }
  if (error instanceof deepl.ConnectionError) {
    return new TranslationError("Не удалось связаться с DeepL. Проверьте соединение и попробуйте снова.", { cause: error });
  }
  return new TranslationError("Ошибка перевода DeepL. Попробуйте ещё раз позже.", { cause: error });
}

type BatchOptions = { html: boolean };

/**
 * Translates many strings in ONE API call. Empty strings are skipped (DeepL rejects them) and
 * returned as "". In HTML mode, <code>/<pre> contents are left untranslated and markup/attributes
 * (data-color, data-highlight, href, src…) are preserved by DeepL's tag handling.
 */
export async function translateBatch(texts: string[], from: Locale, to: Locale, { html }: BatchOptions): Promise<string[]> {
  if (from === to) return [...texts];
  const indexes: number[] = [];
  const payload: string[] = [];
  texts.forEach((text, i) => {
    if (text.trim()) {
      indexes.push(i);
      payload.push(text);
    }
  });
  const out = texts.map(() => "");
  if (payload.length === 0) return out;

  try {
    const results = await getTranslator().translateText(payload, SOURCE_CODES[from], TARGET_CODES[to], {
      ...(html
        ? { tagHandling: "html" as const, ignoreTags: ["code", "pre"], preserveFormatting: true }
        : { preserveFormatting: true }),
    });
    results.forEach((r, j) => {
      out[indexes[j]!] = r.text;
    });
    return out;
  } catch (error) {
    const translated = toTranslationError(error);
    console.error(`[deepl] ${from} → ${to} failed:`, error);
    throw translated;
  }
}
