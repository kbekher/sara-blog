import { z } from "zod";
import { authorizeAdminRequest, jsonError } from "@/lib/auth/guard";
import { trackUnsplashDownload, UnsplashError } from "@/lib/services/unsplash";

const schema = z.object({
  downloadLocation: z.string().max(1000).startsWith("https://api.unsplash.com/"),
});

/** POST /api/unsplash/download { downloadLocation } — pings Unsplash's download endpoint (API guideline). */
export async function POST(request: Request): Promise<Response> {
  const auth = await authorizeAdminRequest(request, { mutating: true });
  if (auth.response) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Некорректная ссылка Unsplash.");

  try {
    await trackUnsplashDownload(parsed.data.downloadLocation);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof UnsplashError) return jsonError(error.status, error.userMessage);
    console.error("[unsplash/download]", error);
    return jsonError(502, "Не удалось связаться с Unsplash.");
  }
}
