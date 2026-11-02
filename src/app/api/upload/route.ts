/**
 * Vercel Blob client-upload endpoint (used by `upload()` from `@vercel/blob/client` in the editor).
 *  - "blob.generate-client-token": sent by the admin's browser → requires a valid admin session + same origin.
 *  - "blob.upload-completed": sent by Vercel Blob's servers (no cookie); authenticity is verified by
 *    `handleUpload` via the request signature.
 */
import { list } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { authorizeAdminRequest, jsonError } from "@/lib/auth/guard";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const MAX_BYTES = 10 * 1024 * 1024;
/** posts/ (spec) and images/ (used by the editor's uploader). */
const ALLOWED_PREFIXES = ["posts/", "images/"];

export async function POST(request: Request): Promise<Response> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return jsonError(503, "Хранилище изображений не настроено: подключите Vercel Blob (BLOB_READ_WRITE_TOKEN).");
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return jsonError(400, "Некорректный запрос.");
  }

  if (body?.type === "blob.generate-client-token") {
    const auth = await authorizeAdminRequest(request, { mutating: true });
    if (auth.response) return auth.response;
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Uploads live under a fixed set of folders; the random suffix makes names unguessable & unique.
        if (!ALLOWED_PREFIXES.some((p) => pathname.startsWith(p)) || pathname.includes("..") || pathname.length > 300) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          // Uploaded images are immutable (unique names) → cache for a year.
          cacheControlMaxAge: 60 * 60 * 24 * 365,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // Not reachable on localhost (Vercel can't call back); purely informational.
        console.info("[upload] completed", blob.pathname, blob.contentType);
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error("[upload] failed", error);
    return jsonError(400, "Не удалось загрузить изображение. Допустимы JPEG, PNG, WebP, GIF, AVIF до 10 МБ.");
  }
}

/**
 * GET /api/upload — admin-only readiness check (used by the editor to explain a failed upload,
 * and handy to open in the browser while logged in). Never returns the token itself.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await authorizeAdminRequest(request, { mutating: false });
  if (auth.response) return auth.response;
  const headers = { "Cache-Control": "no-store" };

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      {
        ok: false,
        error:
          "хранилище изображений не подключено. Vercel → Storage → Create → Blob → Connect to project (все окружения), затем Redeploy.",
      },
      { headers },
    );
  }
  try {
    await list({ limit: 1 });
    return Response.json({ ok: true, message: "Хранилище Vercel Blob подключено и отвечает." }, { headers });
  } catch (error) {
    console.error("[upload] Blob check failed", error);
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      {
        ok: false,
        error: `Vercel Blob отклонил токен (${message}). Переподключите Blob-хранилище к проекту и сделайте Redeploy.`,
      },
      { headers },
    );
  }
}
