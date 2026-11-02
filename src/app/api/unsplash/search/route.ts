import type { NextRequest } from "next/server";
import { authorizeAdminRequest, jsonError } from "@/lib/auth/guard";
import { searchUnsplash, UnsplashError, type Orientation } from "@/lib/services/unsplash";

const ORIENTATIONS = new Set<Orientation>(["landscape", "portrait", "squarish"]);

/** GET /api/unsplash/search?query=&page=&orientation= — admin only. */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await authorizeAdminRequest(request, { mutating: false });
  if (auth.response) return auth.response;

  const params = request.nextUrl.searchParams;
  const query = (params.get("query") ?? "").trim().slice(0, 100);
  const page = Math.min(Math.max(Number.parseInt(params.get("page") ?? "1", 10) || 1, 1), 100);
  const rawOrientation = params.get("orientation") as Orientation | null;
  const orientation = rawOrientation && ORIENTATIONS.has(rawOrientation) ? rawOrientation : undefined;

  try {
    const data = await searchUnsplash(query, page, orientation);
    return Response.json(data, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    if (error instanceof UnsplashError) return jsonError(error.status, error.userMessage);
    console.error("[unsplash/search]", error);
    return jsonError(502, "Не удалось загрузить фото из Unsplash. Попробуйте позже.");
  }
}
