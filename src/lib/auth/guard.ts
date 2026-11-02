import "server-only";
import { getSession, type SessionPayload } from "./session";
import { isSameOrigin } from "./request";

/** JSON error response helper shared by the admin route handlers. */
export function jsonError(status: number, error: string, init?: ResponseInit): Response {
  return Response.json({ ok: false, error }, { ...init, status });
}

/**
 * Re-verifies the admin session inside a Route Handler (defense in depth — the proxy is not enough).
 * For mutating methods also enforces a same-origin `Origin` header (CSRF).
 * Returns either the session or a ready-to-return error Response.
 */
export async function authorizeAdminRequest(
  request: Request,
  { mutating }: { mutating: boolean },
): Promise<{ session: SessionPayload; response?: never } | { session?: never; response: Response }> {
  if (mutating && !isSameOrigin(request)) {
    return { response: jsonError(403, "Запрос отклонён (неверный источник).") };
  }
  const session = await getSession();
  if (!session) return { response: jsonError(401, "Требуется вход в админку.") };
  return { session };
}
