import { z } from "zod";
import { getClientIp, isSameOrigin } from "@/lib/auth/request";
import { locales } from "@/lib/i18n/config";
import { NewsletterError, subscribe } from "@/lib/services/brevo";
import { createRateLimiter } from "@/lib/services/rate-limit";

/** Best-effort, per-instance limit (see rate-limit.ts): 5 attempts per IP per 10 minutes. */
const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

const schema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  locale: z.enum(locales).catch("ru"),
  /** honeypot — real users never fill it */
  company: z.string().max(200).optional(),
});

function error(status: number, message: string, headers?: HeadersInit) {
  return Response.json({ ok: false, error: message }, { status, headers });
}

/** POST /api/newsletter { email, locale, company } — public signup → Brevo. */
export async function POST(request: Request): Promise<Response> {
  // Browsers always send Origin on cross-site POSTs; reject other sites embedding our form.
  if (request.headers.has("origin") && !isSameOrigin(request)) return error(403, "Forbidden");

  const limited = limiter(getClientIp(request.headers));
  if (!limited.ok) {
    return error(429, "Too many attempts. Please try again later.", { "Retry-After": String(limited.retryAfterSeconds) });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(400, "Invalid email address.");
  const { email, locale, company } = parsed.data;

  // Bot filled the honeypot: pretend success, do nothing.
  if (company?.trim()) return Response.json({ ok: true, doubleOptIn: true });

  try {
    const { doubleOptIn } = await subscribe(email, locale);
    return Response.json({ ok: true, doubleOptIn });
  } catch (e) {
    if (e instanceof NewsletterError) {
      switch (e.code) {
        case "invalid_email":
          return error(400, "Invalid email address.");
        case "rate_limited":
          return error(429, "Too many attempts. Please try again later.", { "Retry-After": "60" });
        case "not_configured":
          console.error("[newsletter] BREVO_API_KEY / BREVO_LIST_ID are not configured.");
          return error(503, "Newsletter is not available right now.");
        default:
          return error(500, "Could not subscribe right now. Please try again later.");
      }
    }
    console.error("[newsletter]", e);
    return error(500, "Could not subscribe right now. Please try again later.");
  }
}
