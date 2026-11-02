import "server-only";
import type { Locale } from "@/lib/i18n/config";
import { site } from "@/lib/site";

const API = "https://api.brevo.com/v3";

export class NewsletterError extends Error {
  constructor(
    readonly status: number,
    readonly code: "not_configured" | "invalid_email" | "rate_limited" | "upstream",
  ) {
    super(code);
    this.name = "NewsletterError";
  }
}

export function isBrevoConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY?.trim() && Number(process.env.BREVO_LIST_ID) > 0);
}

type BrevoError = { code?: string; message?: string };

async function post(path: string, apiKey: string, payload: unknown): Promise<{ ok: boolean; status: number; body: BrevoError }> {
  try {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const body = res.ok ? {} : ((await res.json().catch(() => ({}))) as BrevoError);
    return { ok: res.ok, status: res.status, body };
  } catch (error) {
    console.error("[brevo] request failed", error);
    throw new NewsletterError(502, "upstream");
  }
}

/**
 * Subscribes an email to the Brevo list. With BREVO_DOI_TEMPLATE_ID set, Brevo first sends a double opt-in
 * confirmation email (recommended for GDPR); otherwise the contact is added directly.
 * An already-existing contact is treated as success (no leak about who is subscribed).
 * The LANGUAGE contact attribute is sent when possible; if it doesn't exist in the Brevo account,
 * the request is retried once without attributes.
 */
export async function subscribe(email: string, locale: Locale): Promise<{ doubleOptIn: boolean }> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const listId = Number(process.env.BREVO_LIST_ID);
  if (!apiKey || !(listId > 0)) throw new NewsletterError(503, "not_configured");

  const templateId = Number(process.env.BREVO_DOI_TEMPLATE_ID);
  const doubleOptIn = templateId > 0;
  const redirectionUrl = process.env.BREVO_DOI_REDIRECT_URL?.trim() || `${site.url.replace(/\/+$/, "")}/${locale}`;

  const build = (attributes?: Record<string, string>) =>
    doubleOptIn
      ? { email, includeListIds: [listId], templateId, redirectionUrl, ...(attributes && { attributes }) }
      : { email, listIds: [listId], updateEnabled: true, ...(attributes && { attributes }) };
  const path = doubleOptIn ? "/contacts/doubleOptinConfirmation" : "/contacts";

  let result = await post(path, apiKey, build({ LANGUAGE: locale.toUpperCase() }));
  if (!result.ok && result.status === 400 && /attribute/i.test(result.body.message ?? "")) {
    result = await post(path, apiKey, build());
  }
  if (result.ok) return { doubleOptIn };

  const { code, message = "" } = result.body;
  if (code === "duplicate_parameter" || /already exist/i.test(message)) return { doubleOptIn };
  if (result.status === 429) throw new NewsletterError(429, "rate_limited");
  if (result.status === 400 && /email/i.test(message)) throw new NewsletterError(400, "invalid_email");
  console.error("[brevo] unexpected response", result.status, result.body);
  throw new NewsletterError(502, "upstream");
}
