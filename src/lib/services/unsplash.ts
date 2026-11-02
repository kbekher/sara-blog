import "server-only";
import { cacheLife } from "next/cache";
import type { UnsplashPhoto } from "@/lib/admin/types";

const API = "https://api.unsplash.com";
/** Unsplash guidelines require UTM params on attribution links back to unsplash.com. */
const UTM = "utm_source=saras_blog&utm_medium=referral";

export class UnsplashError extends Error {
  constructor(
    readonly status: number,
    readonly userMessage: string,
  ) {
    super(userMessage);
    this.name = "UnsplashError";
  }
}

export function isUnsplashConfigured(): boolean {
  return Boolean(process.env.UNSPLASH_ACCESS_KEY?.trim());
}

function withUtm(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}${UTM}`;
}

/* Minimal shape of Unsplash's photo JSON that we use. */
type RawPhoto = {
  id: string;
  description: string | null;
  alt_description: string | null;
  color: string | null;
  width: number;
  height: number;
  blur_hash: string | null;
  urls: { thumb: string; small: string; regular: string; full: string; raw: string };
  links: { html: string; download_location: string };
  user: { name: string; username: string; links: { html: string } };
};

function mapPhoto(p: RawPhoto): UnsplashPhoto {
  return {
    id: p.id,
    description: p.description,
    altDescription: p.alt_description,
    color: p.color,
    width: p.width,
    height: p.height,
    blurHash: p.blur_hash,
    urls: p.urls,
    user: { name: p.user.name, username: p.user.username, profileUrl: withUtm(p.user.links.html) },
    photoUrl: withUtm(p.links.html),
    downloadLocation: p.links.download_location,
  };
}

async function unsplashFetch(path: string, init?: RequestInit): Promise<Response> {
  const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!key) {
    throw new UnsplashError(503, "Unsplash не настроен: задайте UNSPLASH_ACCESS_KEY (см. README).");
  }
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1", ...init?.headers },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.ok) return res;
  if (res.status === 401 || res.status === 403) {
    // 403 is also returned when the hourly rate limit is exhausted.
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      throw new UnsplashError(429, "Достигнут часовой лимит запросов Unsplash. Попробуйте через час.");
    }
    throw new UnsplashError(502, "Unsplash отклонил ключ доступа. Проверьте UNSPLASH_ACCESS_KEY.");
  }
  if (res.status === 429) throw new UnsplashError(429, "Достигнут лимит запросов Unsplash. Попробуйте позже.");
  throw new UnsplashError(502, "Unsplash сейчас недоступен. Попробуйте позже.");
}

export type Orientation = "landscape" | "portrait" | "squarish";

export type UnsplashSearchResult = { results: UnsplashPhoto[]; totalPages: number };

/** Errors can't cross a "use cache" boundary intact (class + message are lost), so the cached fn returns them as data. */
type CachedSearch = { ok: true; data: UnsplashSearchResult } | { ok: false; status: number; message: string };

/**
 * Search (or, for an empty query, popular photos). Cached for a few minutes per (query, page, orientation)
 * to save the 50 req/h demo quota. Failures are cached for only a minute.
 */
export async function searchUnsplash(query: string, page: number, orientation?: Orientation): Promise<UnsplashSearchResult> {
  // Checked outside the cache scope so the "not configured" error is always reported precisely.
  if (!isUnsplashConfigured()) {
    throw new UnsplashError(503, "Unsplash не настроен: задайте UNSPLASH_ACCESS_KEY (см. README).");
  }
  const result = await searchUnsplashCached(query, page, orientation ?? null);
  if (!result.ok) throw new UnsplashError(result.status, result.message);
  return result.data;
}

async function searchUnsplashCached(query: string, page: number, orientation: Orientation | null): Promise<CachedSearch> {
  "use cache";
  try {
    const data = await fetchSearch(query, page, orientation);
    cacheLife({ stale: 300, revalidate: 600, expire: 3600 });
    return { ok: true, data };
  } catch (error) {
    // Short-lived: don't hammer Unsplash while rate-limited / misconfigured, but recover quickly.
    cacheLife({ stale: 30, revalidate: 60, expire: 60 });
    if (error instanceof UnsplashError) return { ok: false, status: error.status, message: error.userMessage };
    console.error("[unsplash] search failed", error);
    return { ok: false, status: 502, message: "Unsplash сейчас недоступен. Попробуйте позже." };
  }
}

async function fetchSearch(query: string, page: number, orientation: Orientation | null): Promise<UnsplashSearchResult> {
  const perPage = 24;
  if (!query) {
    const res = await unsplashFetch(`/photos?order_by=popular&per_page=${perPage}&page=${page}`);
    const photos = (await res.json()) as RawPhoto[];
    const total = Number(res.headers.get("x-total") ?? 0);
    return {
      results: photos.map(mapPhoto),
      totalPages: total > 0 ? Math.ceil(total / perPage) : photos.length === perPage ? page + 1 : page,
    };
  }
  const params = new URLSearchParams({
    query,
    page: String(page),
    per_page: String(perPage),
    content_filter: "high",
  });
  if (orientation) params.set("orientation", orientation);
  const res = await unsplashFetch(`/search/photos?${params}`);
  const json = (await res.json()) as { total_pages: number; results: RawPhoto[] };
  return { results: json.results.map(mapPhoto), totalPages: json.total_pages };
}

/** Required by the Unsplash API guidelines whenever a photo is chosen (counts a "download"). */
export async function trackUnsplashDownload(downloadLocation: string): Promise<void> {
  const url = new URL(downloadLocation);
  if (url.origin !== API) throw new UnsplashError(400, "Некорректная ссылка Unsplash.");
  await unsplashFetch(`${url.pathname}${url.search}`);
}
