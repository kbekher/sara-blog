import "server-only";
import type { LanguageToolMatch } from "@/lib/admin/types";

export const LANGUAGETOOL_LANGUAGES = ["ru-RU", "uk-UA", "en-US"] as const;
export type LanguageToolLanguage = (typeof LANGUAGETOOL_LANGUAGES)[number];
/** Request size limit of the free public API. */
export const LANGUAGETOOL_MAX_CHARS = 20_000;

export class LanguageToolError extends Error {
  constructor(
    readonly status: number,
    readonly userMessage: string,
    readonly retryAfter?: string,
  ) {
    super(userMessage);
    this.name = "LanguageToolError";
  }
}

type RawMatch = {
  message: string;
  shortMessage?: string;
  offset: number;
  length: number;
  replacements?: { value: string }[];
  rule?: { id?: string; issueType?: string };
};

export async function checkText(text: string, language: LanguageToolLanguage): Promise<LanguageToolMatch[]> {
  const base = (process.env.LANGUAGETOOL_API_URL?.trim() || "https://api.languagetool.org/v2").replace(/\/+$/, "");
  const body = new URLSearchParams({ text, language, enabledOnly: "false", level: "picky" });
  const username = process.env.LANGUAGETOOL_USERNAME?.trim();
  const apiKey = process.env.LANGUAGETOOL_API_KEY?.trim();
  if (username && apiKey) {
    body.set("username", username);
    body.set("apiKey", apiKey);
  }

  let res: Response;
  try {
    res = await fetch(`${base}/check`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    throw new LanguageToolError(502, "Сервис проверки текста недоступен. Попробуйте позже.");
  }

  if (res.status === 429) {
    throw new LanguageToolError(429, "Слишком много проверок подряд. Подождите немного.", res.headers.get("retry-after") ?? "60");
  }
  if (res.status === 413) throw new LanguageToolError(413, "Текст слишком длинный для проверки.");
  if (!res.ok) throw new LanguageToolError(502, "Сервис проверки текста вернул ошибку. Попробуйте позже.");

  const json = (await res.json()) as { matches?: RawMatch[] };
  return (json.matches ?? []).map((m) => ({
    message: m.message,
    shortMessage: m.shortMessage ?? "",
    offset: m.offset,
    length: m.length,
    replacements: (m.replacements ?? []).slice(0, 5).map((r) => r.value),
    ruleId: m.rule?.id ?? "",
    issueType: m.rule?.issueType ?? "other",
  }));
}
