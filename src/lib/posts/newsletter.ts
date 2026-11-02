import "server-only";
/**
 * Keeps a post's "new post" email in sync with its publication (called by the admin actions).
 *
 * State lives on the post row:
 *   newsletterSentAt = null                         → never emailed
 *   newsletterSentAt ≤ now                          → sent (or a send is in progress) — never sent again
 *   newsletterSentAt > now and newsletterCampaignId → scheduled in Brevo for that time, not sent yet
 *
 * A send first "claims" the post with a compare-and-set on newsletterSentAt, so a double click or two tabs can't
 * email subscribers twice. Everything here is best-effort: failures are reported, never thrown.
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { posts, type Post } from "@/db/schema";
import type { NewsletterOutcome } from "@/lib/admin/types";
import {
  CampaignError,
  cancelCampaign,
  isCampaignConfigured,
  scheduleOrSendCampaign,
  type CampaignPost,
} from "@/lib/services/newsletter-campaign";

type NewsletterFields = Pick<Post, "id" | "newsletterCampaignId" | "newsletterSentAt">;

/** Persistence used by the sync (the DB by default; swappable for tests). */
export type NewsletterStore = {
  /** Atomically moves newsletterSentAt from `expected` to `next` (campaign id cleared). False if it changed meanwhile. */
  claim(postId: string, expected: Date | null, next: Date): Promise<boolean>;
  set(postId: string, fields: { newsletterCampaignId: number | null; newsletterSentAt: Date | null }): Promise<void>;
};

export const dbNewsletterStore: NewsletterStore = {
  async claim(postId, expected, next) {
    const rows = await db
      .update(posts)
      .set({ newsletterSentAt: next, newsletterCampaignId: null })
      .where(and(eq(posts.id, postId), expected ? eq(posts.newsletterSentAt, expected) : isNull(posts.newsletterSentAt)))
      .returning({ id: posts.id });
    return rows.length > 0;
  },
  async set(postId, fields) {
    await db.update(posts).set(fields).where(eq(posts.id, postId));
  },
};

function errorMessage(error: unknown): string {
  if (error instanceof CampaignError) return error.userMessage;
  console.error("[newsletter] unexpected error", error);
  return "Не удалось отправить письмо подписчикам. Попробуйте позже.";
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

function isScheduled(post: NewsletterFields, now: Date): boolean {
  return post.newsletterCampaignId != null && !!post.newsletterSentAt && post.newsletterSentAt.getTime() > now.getTime();
}

/**
 * After a successful publish: emails the subscribers (now, or scheduled for `publishedAt`) unless the post was
 * already emailed; moves/cancels a still-scheduled email when the date changed or `notify` is off.
 */
export async function syncNewsletterOnPublish(
  {
    post,
    content,
    publishedAt,
    notify,
    now = new Date(),
  }: { post: NewsletterFields; content: CampaignPost; publishedAt: Date; notify: boolean; now?: Date },
  store: NewsletterStore = dbNewsletterStore,
): Promise<NewsletterOutcome> {
  const sentAt = post.newsletterSentAt;
  const scheduled = isScheduled(post, now);

  if (sentAt && !scheduled) return { status: "skipped", reason: "already_sent", newsletterSentAt: iso(sentAt) };

  if (!notify) {
    if (!scheduled) return { status: "skipped", reason: "disabled", newsletterSentAt: null };
    const result = await cancelScheduledNewsletter(post, { now, store });
    if (result === "failed") {
      return {
        status: "failed",
        message: "Не удалось отменить запланированное письмо — отмените его вручную в Brevo → Campaigns.",
        newsletterSentAt: iso(sentAt),
      };
    }
    if (result === "already_sent") return { status: "skipped", reason: "already_sent", newsletterSentAt: iso(sentAt) };
    return { status: "skipped", reason: "cancelled", message: "Запланированное письмо отменено.", newsletterSentAt: null };
  }

  if (!isCampaignConfigured()) {
    return { status: "skipped", reason: "not_configured", newsletterSentAt: iso(sentAt) };
  }

  if (scheduled) {
    // Same date → the scheduled email is still right.
    if (sentAt!.getTime() === publishedAt.getTime()) {
      return { status: "scheduled", newsletterSentAt: iso(sentAt) };
    }
    // Date changed → cancel the old campaign first; never create a second one while the first may still go out.
    try {
      const cancelled = await cancelCampaign(post.newsletterCampaignId!);
      if (cancelled === "already_sent") {
        return { status: "skipped", reason: "already_sent", newsletterSentAt: iso(sentAt) };
      }
    } catch (error) {
      return {
        status: "failed",
        message: `Не удалось перенести письмо (оно уйдёт в прежнее время): ${errorMessage(error)}`,
        newsletterSentAt: iso(sentAt),
      };
    }
  }

  // Claim the post (compare-and-set), then talk to Brevo.
  const target = publishedAt.getTime() > now.getTime() ? publishedAt : now;
  let claimed: boolean;
  try {
    claimed = await store.claim(post.id, scheduled ? sentAt : null, target);
  } catch (error) {
    console.error("[newsletter] claim failed", error);
    return { status: "failed", message: "Не удалось отправить письмо: ошибка базы данных.", newsletterSentAt: iso(sentAt) };
  }
  if (!claimed) return { status: "skipped", reason: "in_progress", newsletterSentAt: iso(sentAt) };

  let result: Awaited<ReturnType<typeof scheduleOrSendCampaign>>;
  try {
    result = await scheduleOrSendCampaign({ post: content, sendAt: publishedAt });
  } catch (error) {
    const message = errorMessage(error);
    await store
      .set(post.id, { newsletterCampaignId: null, newsletterSentAt: null })
      .catch((e) => console.error("[newsletter] could not release claim", e));
    return { status: "failed", message, newsletterSentAt: null };
  }

  try {
    await store.set(post.id, { newsletterCampaignId: result.id, newsletterSentAt: result.at });
  } catch (error) {
    // The email went out / is scheduled; only the bookkeeping failed. The claim (newsletterSentAt) still blocks resends.
    console.error(`[newsletter] campaign ${result.id} created but not saved for post ${post.id}`, error);
  }
  return { status: result.status, newsletterSentAt: result.at.toISOString() };
}

/**
 * Cancels a scheduled, not-yet-sent email (on unpublish/delete) and clears the post's newsletter fields
 * (pass `store: null` when the row is being deleted). Best-effort: returns "failed" instead of throwing.
 */
export async function cancelScheduledNewsletter(
  post: NewsletterFields,
  { now = new Date(), store = dbNewsletterStore }: { now?: Date; store?: NewsletterStore | null } = {},
): Promise<"none" | "cancelled" | "already_sent" | "failed"> {
  if (!isScheduled(post, now)) return "none";
  try {
    const result = await cancelCampaign(post.newsletterCampaignId!);
    if (result === "already_sent") return "already_sent";
    await store?.set(post.id, { newsletterCampaignId: null, newsletterSentAt: null });
    return "cancelled";
  } catch (error) {
    console.error(`[newsletter] could not cancel campaign ${post.newsletterCampaignId} for post ${post.id}`, error);
    return "failed";
  }
}
