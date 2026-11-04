import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { eq } from "drizzle-orm";
import { db, hasDatabase } from "@/db";
import { siteSettings, type CoverImage } from "@/db/schema";

/**
 * CONTRACT: site-wide settings edited in the admin («Настройки сайта»).
 * Read with `getSiteSettings()` (cached, tag SITE_SETTINGS_TAG); the admin action that writes them must call
 * `updateTag(SITE_SETTINGS_TAG)`.
 */
export const SITE_SETTINGS_TAG = "site-settings";

export type SiteSettings = {
  /** Tall portrait shown in the home hero (uploaded to Blob or picked from Unsplash). */
  heroPortrait: CoverImage | null;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = { heroPortrait: null };

/** Keys stored in the `site_settings` table. */
export const SITE_SETTING_KEYS = { heroPortrait: "hero_portrait" } as const;

export async function getSiteSettings(): Promise<SiteSettings> {
  "use cache";
  cacheTag(SITE_SETTINGS_TAG);
  cacheLife({ stale: 60, revalidate: 300, expire: 86400 });
  if (!hasDatabase) return DEFAULT_SITE_SETTINGS;
  try {
    const [row] = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, SITE_SETTING_KEYS.heroPortrait))
      .limit(1);
    return { heroPortrait: (row?.value as CoverImage | null | undefined) ?? null };
  } catch (error) {
    console.error("[site-settings] read failed", error);
    return DEFAULT_SITE_SETTINGS;
  }
}
