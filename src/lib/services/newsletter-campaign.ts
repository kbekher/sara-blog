import "server-only";
import { readSenderEmail } from "./sender-email";
/**
 * "New post" email campaigns via the Brevo API v3 (https://developers.brevo.com/reference/createemailcampaign).
 *
 * The blog emails its subscribers list automatically when a post is published (see `publishPost` in
 * src/app/admin/actions.ts and src/lib/posts/newsletter.ts):
 *  - publish now        → POST /emailCampaigns, then POST /emailCampaigns/{id}/sendNow
 *  - scheduled publish  → POST /emailCampaigns with `scheduledAt` (Brevo sends it at the publish time)
 *  - unpublish/delete   → a scheduled, not-yet-sent campaign is deleted (DELETE /emailCampaigns/{id})
 *
 * The email HTML is a TS port of emails/new-post.html (same look); all dynamic text is escaped.
 */
import type { CoverImage } from "@/db/schema";
import { withUnsplashUtm } from "@/lib/content/extensions";
import { brevoApiUrl } from "@/lib/services/brevo";
import { site } from "@/lib/site";

/* ───────────────────────── Config ───────────────────────── */

type CampaignConfig = { apiKey: string; listId: number; sender: { name: string; email: string } };

function readConfig(): CampaignConfig | null {
  const apiKey = process.env.BREVO_API_KEY?.trim() ?? "";
  const listId = Number(process.env.BREVO_LIST_ID?.trim());
  const email = readSenderEmail();
  if (!apiKey || !Number.isInteger(listId) || listId <= 0 || !email.includes("@")) return null;
  const name = process.env.BREVO_SENDER_NAME?.trim() || site.author;
  return { apiKey, listId, sender: { name, email } };
}

/** True when new-post emails can be sent: BREVO_API_KEY, numeric BREVO_LIST_ID and BREVO_SENDER_EMAIL are set. */
export function isCampaignConfigured(): boolean {
  return readConfig() !== null;
}

/* ───────────────────────── Errors ───────────────────────── */

/** A failed Brevo call. `userMessage` is Russian and safe to show in the admin UI; details are logged. */
export class CampaignError extends Error {
  constructor(
    /** HTTP status from Brevo; 0 = network error / timeout; 503 = not configured. */
    readonly status: number,
    readonly userMessage: string,
    readonly detail = "",
  ) {
    super(`Brevo campaign error ${status}: ${detail || userMessage}`);
    this.name = "CampaignError";
  }
}

function toUserMessage(status: number, message: string): string {
  const ipBlocked = /\bip\b|authori[sz]ed ips?/i.test(message);
  if (status === 0) return "Не удалось связаться с Brevo — письмо не отправлено. Попробуйте позже.";
  if ((status === 401 || status === 403) && ipBlocked) {
    return "Brevo блокирует запросы с сервера: выключите «Authorized IPs» в Brevo → Security → Authorized IPs.";
  }
  if (status === 401) return "Brevo отклонил API-ключ — проверьте BREVO_API_KEY (должен начинаться с xkeysib-).";
  if (status === 402) return "Недостаточно кредитов Brevo для рассылки — пополните или смените тариф.";
  if (status === 403) {
    // Brevo uses 403 for several reasons (account not yet validated for campaigns, plan limits, …) — show its own words.
    return `Brevo запретил отправку${message ? `: «${message}»` : ""}. Обычно это значит, что аккаунт ещё не активирован для рассылок (Brevo → завершите активацию аккаунта) или исчерпан лимит тарифа.`;
  }
  if (status === 429) return "Слишком много запросов к Brevo — попробуйте через минуту.";
  if (status === 400 && /sender/i.test(message)) {
    return `Brevo не принял отправителя BREVO_SENDER_EMAIL${message ? ` («${message}»)` : ""}. Адрес должен в точности совпадать с подтверждённым в Brevo → Senders, Domains & Dedicated IPs → Senders (см. /api/newsletter/check).`;
  }
  if (status === 400) return `Brevo отклонил письмо: ${message || "некорректные данные"}.`;
  if (status === 404) return "Рассылка не найдена в Brevo.";
  return `Ошибка Brevo (HTTP ${status})${message ? `: «${message}»` : ""}. Попробуйте позже.`;
}

/* ───────────────────────── HTTP ───────────────────────── */

type BrevoResponse = { status: number; body: Record<string, unknown> };

async function brevo(
  config: CampaignConfig,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  payload?: unknown,
  { allow = [] as number[] } = {},
): Promise<BrevoResponse> {
  let res: Response;
  try {
    res = await fetch(`${brevoApiUrl()}${path}`, {
      method,
      headers: {
        "api-key": config.apiKey,
        Accept: "application/json",
        ...(payload === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch (error) {
    console.error(`[newsletter] ${method} ${path} failed`, error);
    throw new CampaignError(0, toUserMessage(0, ""), error instanceof Error ? error.message : String(error));
  }
  const text = await res.text().catch(() => "");
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = { message: text.slice(0, 300) };
  }
  if (res.ok || allow.includes(res.status)) return { status: res.status, body };

  const message = typeof body.message === "string" ? body.message : text.slice(0, 200);
  console.error(`[newsletter] ${method} ${path} → HTTP ${res.status}`, body);
  const step = `${method} ${path.replace(/\/\d+/g, "/{id}")}`;
  throw new CampaignError(
    res.status,
    `${toUserMessage(res.status, message)} [шаг: ${step}]`,
    `${body.code ?? ""} ${message}`.trim(),
  );
}

function requireConfig(): CampaignConfig {
  const config = readConfig();
  if (!config) {
    throw new CampaignError(503, "Рассылка не настроена (см. /api/newsletter/check).", "BREVO_* env vars missing");
  }
  return config;
}

/* ───────────────────────── Email HTML ───────────────────────── */

/** What the email needs to know about a post. */
export type CampaignPost = {
  slug: string;
  title: string;
  excerpt: string;
  /** Plain text of the body, blocks separated by blank lines (see extractPlainText). */
  plainText: string;
  cover: CoverImage | null;
};

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
}

function siteBase(): string {
  return site.url.replace(/\/+$/, "");
}

/** Public post URL with newsletter UTM parameters. */
export function postEmailUrl(slug: string): string {
  return `${siteBase()}/posts/${encodeURIComponent(slug)}?utm_source=newsletter&utm_medium=email`;
}

/** Hotlinked Unsplash covers get a sized, compressed rendition (like the site does). */
function coverSrc(cover: CoverImage): string {
  try {
    const url = new URL(cover.url);
    if (/(^|\.)unsplash\.com$/i.test(url.hostname)) {
      for (const [k, v] of [["w", "1200"], ["q", "80"], ["auto", "format"], ["fit", "crop"]] as const) {
        if (!url.searchParams.has(k)) url.searchParams.set(k, v);
      }
    }
    return url.toString();
  } catch {
    return cover.url;
  }
}

const TEASER_MIN = 400;
const TEASER_MAX = 600;

/** Cuts `text` to at most `limit` chars at a sentence end (preferred) or a word boundary, marking the cut with "…". */
function cutText(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const slice = text.slice(0, limit);
  let sentenceEnd = -1;
  for (const m of slice.matchAll(/[.!?…]+["»”)]*(?=\s)/g)) sentenceEnd = m.index + m[0].length;
  if (sentenceEnd >= limit * 0.5) {
    const sentence = slice.slice(0, sentenceEnd).trimEnd();
    return sentence.endsWith(".") && !sentence.endsWith("..") ? `${sentence.slice(0, -1)}…` : sentence;
  }
  const space = slice.lastIndexOf(" ");
  const word = (space > limit * 0.5 ? slice.slice(0, space) : slice).replace(/[\s,;:—–-]+$/, "");
  return `${word}…`;
}

/** The first ~2 paragraphs of the post (≈ 400–600 chars), cut at a sentence/word boundary. */
export function teaserParagraphs(plainText: string): string[] {
  const blocks = plainText
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const out: string[] = [];
  let length = 0;
  for (const block of blocks) {
    if (length >= TEASER_MIN || (out.length >= 2 && length >= TEASER_MIN / 2)) break;
    const room = TEASER_MAX - length;
    if (block.length <= room) {
      out.push(block);
      length += block.length;
      continue;
    }
    if (room >= 80 || out.length === 0) out.push(cutText(block, Math.max(room, 80)));
    break;
  }
  return out;
}

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";
const SERIF = "'Source Serif 4',Georgia,'Times New Roman',serif";

/** Renders the "new post" email (dark, amber accent — same design as emails/new-post.html). */
export function renderPostEmail(post: CampaignPost): string {
  const url = postEmailUrl(post.slug);
  const home = `${siteBase()}/`;
  const title = post.title.trim();
  const excerpt = post.excerpt.trim();
  const paragraphs = teaserParagraphs(post.plainText);
  const preheader = excerpt || paragraphs[0]?.slice(0, 150) || title;

  const cover = post.cover
    ? (() => {
        const c = post.cover;
        const credit =
          c.source === "unsplash" && c.credit?.name
            ? `
                <tr>
                  <td style="padding:8px 40px 0 40px;font-family:${SANS};font-size:12px;line-height:1.5;color:#75726d;">
                    Фото: <a href="${esc(withUnsplashUtm(c.credit.profileUrl))}" target="_blank" style="color:#a3a09b;">${esc(c.credit.name)}</a>
                    на <a href="${esc(withUnsplashUtm("https://unsplash.com/"))}" target="_blank" style="color:#a3a09b;">Unsplash</a>
                  </td>
                </tr>`
            : "";
        return `
                <tr>
                  <td>
                    <a href="${esc(url)}" target="_blank" style="text-decoration:none;">
                      <img src="${esc(coverSrc(c))}" width="600" alt="${esc(c.alt || title)}"
                           style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:20px 20px 0 0;">
                    </a>
                  </td>
                </tr>${credit}`;
      })()
    : "";

  const subtitle = excerpt
    ? `
                    <p style="margin:0 0 22px 0;font-family:${SERIF};font-style:italic;font-size:19px;line-height:1.55;color:#a3a09b;">
                      ${esc(excerpt)}
                    </p>`
    : "";

  const body = paragraphs
    .map(
      (p, i) => `
                    <p style="margin:0 0 ${i === paragraphs.length - 1 ? 28 : 16}px 0;font-family:${SANS};font-size:17px;line-height:1.7;color:#e8e6e3;">
                      ${esc(p).replace(/\n/g, "<br>")}
                    </p>`,
    )
    .join("");

  return `<!doctype html>
<html lang="ru" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${esc(title)} — ${esc(site.name)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&amp;display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; background: #0b0b0c; }
    a { color: #d4a373; }
    @media (max-width: 620px) {
      .pad { padding: 28px 22px !important; }
      .title { font-size: 28px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#0b0b0c;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0b0b0c;">
    ${esc(preheader)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0b0b0c" style="background:#0b0b0c;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
          <tr>
            <td style="padding:0 4px 22px 4px;font-family:${SERIF};font-size:20px;font-weight:600;color:#f5f4f2;">
              <a href="${esc(home)}" style="color:#f5f4f2;text-decoration:none;">${esc(site.name)}</a>
            </td>
          </tr>

          <tr>
            <td bgcolor="#151517" style="background:#151517;border:1px solid #26262a;border-radius:20px;overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cover}
                <tr>
                  <td class="pad" style="padding:36px 40px 40px 40px;">
                    <p style="margin:0 0 12px 0;font-family:${SANS};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#d4a373;">
                      Новая запись
                    </p>
                    <h1 class="title" style="margin:0 0 14px 0;font-family:${SERIF};font-size:34px;line-height:1.12;font-weight:600;color:#f5f4f2;">
                      <a href="${esc(url)}" target="_blank" style="color:#f5f4f2;text-decoration:none;">${esc(title)}</a>
                    </h1>${subtitle}${body}
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td bgcolor="#d4a373" style="background:#d4a373;border-radius:999px;">
                          <a href="${esc(url)}" target="_blank"
                             style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:16px;font-weight:600;color:#1a1208;text-decoration:none;border-radius:999px;">
                            Читать полностью →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 4px 0 4px;font-family:${SANS};font-size:13px;line-height:1.6;color:#75726d;">
              Вы получаете это письмо, потому что подписались на ${esc(site.name)}.<br>
              <a href="{{ unsubscribe }}" style="color:#a3a09b;">Отписаться</a>
              &nbsp;·&nbsp;
              <a href="{{ mirror }}" style="color:#a3a09b;">Открыть в браузере</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/* ───────────────────────── Campaigns ───────────────────────── */

/** Brevo sends `scheduledAt` campaigns itself; anything due sooner than this is sent right away. */
const SCHEDULE_THRESHOLD_MS = 2 * 60_000;

export type CampaignResult = { id: number; status: "sent" | "scheduled"; at: Date };

/**
 * Creates the "new post" campaign for the subscribers list and either schedules it for `sendAt`
 * (when that is more than 2 minutes away) or sends it immediately. Throws CampaignError.
 */
export async function scheduleOrSendCampaign({ post, sendAt }: { post: CampaignPost; sendAt: Date }): Promise<CampaignResult> {
  const config = requireConfig();
  const now = new Date();
  const scheduled = sendAt.getTime() > now.getTime() + SCHEDULE_THRESHOLD_MS;
  const title = post.title.trim();
  const excerpt = post.excerpt.trim();

  // Essentials only. (Extras such as `tag` are paid-plan features: on the free plan Brevo rejects the whole
  // request with HTTP 405 "You are not allowed to avail tag option for your campaign".)
  const essentials = {
    name: `Новая запись: ${title.slice(0, 150)} (${post.slug})`,
    subject: title,
    sender: config.sender,
    htmlContent: renderPostEmail(post),
    recipients: { listIds: [config.listId] },
    ...(scheduled && { scheduledAt: sendAt.toISOString() }),
  };
  const extras = { ...(excerpt && { previewText: excerpt.slice(0, 300) }), inlineImageActivation: false, mirrorActive: true };
  let created: BrevoResponse;
  try {
    created = await brevo(config, "POST", "/emailCampaigns", { ...essentials, ...extras });
  } catch (error) {
    // Plan restriction on an optional field → retry once with the bare minimum.
    if (!(error instanceof CampaignError && (error.status === 405 || error.status === 403))) throw error;
    console.warn("[newsletter] campaign create refused with extras; retrying with essentials only", error.detail);
    created = await brevo(config, "POST", "/emailCampaigns", essentials);
  }
  const id = Number(created.body.id);
  if (!Number.isInteger(id) || id <= 0) {
    console.error("[newsletter] createEmailCampaign returned no id", created.body);
    throw new CampaignError(502, "Brevo не вернул номер рассылки — проверьте раздел Campaigns в Brevo.", "missing id");
  }
  if (scheduled) return { id, status: "scheduled", at: sendAt };

  try {
    await brevo(config, "POST", `/emailCampaigns/${id}/sendNow`);
  } catch (error) {
    // Some accounts refuse the sendNow route (e.g. HTTP 405/403). Fall back to scheduling the same
    // campaign ~1 minute ahead, which Brevo then sends by itself.
    if (error instanceof CampaignError && (error.status === 405 || error.status === 403 || error.status === 400)) {
      const at = new Date(Date.now() + 60_000);
      try {
        await brevo(config, "PUT", `/emailCampaigns/${id}`, { scheduledAt: at.toISOString() });
        console.warn(`[newsletter] sendNow refused (HTTP ${error.status}); campaign ${id} scheduled for ${at.toISOString()} instead`);
        return { id, status: "sent", at };
      } catch (fallbackError) {
        console.error("[newsletter] scheduling fallback failed", fallbackError);
      }
    }
    // Don't leave an unsent draft behind (a retry creates a fresh campaign).
    await brevo(config, "DELETE", `/emailCampaigns/${id}`, undefined, { allow: [404] }).catch(() => {});
    throw error;
  }
  return { id, status: "sent", at: now };
}

/**
 * Cancels a scheduled campaign that hasn't gone out yet by deleting it (Brevo allows deleting unsent campaigns;
 * if deletion is refused it is suspended instead). Returns what happened; a missing campaign is not an error.
 */
export async function cancelCampaign(id: number): Promise<"cancelled" | "not_found" | "already_sent"> {
  const config = requireConfig();
  const info = await brevo(config, "GET", `/emailCampaigns/${id}`, undefined, { allow: [404] });
  if (info.status === 404) return "not_found";
  const status = String(info.body.status ?? "");
  if (status === "sent" || status === "in_process" || status === "archive") return "already_sent";

  const deleted = await brevo(config, "DELETE", `/emailCampaigns/${id}`, undefined, { allow: [400, 403, 404] });
  if (deleted.status === 404) return "not_found";
  if (deleted.status === 400 || deleted.status === 403) {
    const suspended = await brevo(config, "PUT", `/emailCampaigns/${id}/status`, { status: "suspended" }, { allow: [404] });
    if (suspended.status === 404) return "not_found";
  }
  return "cancelled";
}

/** Moves a scheduled campaign to a new time: cancels it and creates a fresh one (never two live campaigns). */
export async function updateCampaignSchedule(
  id: number,
  { post, sendAt }: { post: CampaignPost; sendAt: Date },
): Promise<CampaignResult | { status: "already_sent" }> {
  const cancelled = await cancelCampaign(id);
  if (cancelled === "already_sent") return { status: "already_sent" };
  return scheduleOrSendCampaign({ post, sendAt });
}
