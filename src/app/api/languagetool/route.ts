import { z } from "zod";
import { authorizeAdminRequest, jsonError } from "@/lib/auth/guard";
import {
  checkText,
  LANGUAGETOOL_LANGUAGES,
  LANGUAGETOOL_MAX_CHARS,
  LanguageToolError,
} from "@/lib/services/languagetool";

const schema = z.object({
  text: z.string(),
  language: z.enum(LANGUAGETOOL_LANGUAGES),
});

/** POST /api/languagetool { text, language } → { matches } — admin-only proxy (keeps API keys server-side). */
export async function POST(request: Request): Promise<Response> {
  const auth = await authorizeAdminRequest(request, { mutating: true });
  if (auth.response) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Некорректный запрос проверки текста.");
  const { text, language } = parsed.data;
  if (text.length > LANGUAGETOOL_MAX_CHARS) {
    return jsonError(413, `Текст слишком длинный для проверки (максимум ${LANGUAGETOOL_MAX_CHARS.toLocaleString("ru-RU")} символов).`);
  }
  if (!text.trim()) return Response.json({ matches: [] });

  try {
    return Response.json({ matches: await checkText(text, language) });
  } catch (error) {
    if (error instanceof LanguageToolError) {
      return jsonError(error.status, error.userMessage, error.retryAfter ? { headers: { "Retry-After": error.retryAfter } } : undefined);
    }
    console.error("[languagetool]", error);
    return jsonError(502, "Сервис проверки текста недоступен.");
  }
}
