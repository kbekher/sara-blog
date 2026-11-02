"use client";
/**
 * Unsplash photo picker (cover or body image).
 *  - search (debounced), initial query from the post title, quick topic chips
 *  - masonry grid with dominant-color placeholders, infinite scroll, photographer credit on hover/focus
 *  - on select: pings download_location (required by the Unsplash API guidelines) and returns a CoverImage
 * Backend endpoints: GET /api/unsplash/search, POST /api/unsplash/download.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Loader2, ImageOff } from "lucide-react";
import type { CoverImage } from "@/db/schema";
import type { UnsplashPhoto } from "@/lib/admin/types";
import { Dialog } from "@/components/admin/dialog";

const UTM = "utm_source=sara_blog&utm_medium=referral";

function withUtm(url: string): string {
  if (!url || url.includes("utm_source=")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${UTM}`;
}

/** Unsplash image URL with sizing params (raw URLs already carry a query string). */
export function unsplashUrl(raw: string, width: number): string {
  return `${raw}${raw.includes("?") ? "&" : "?"}w=${width}&q=80&auto=format&fit=crop`;
}

export function unsplashToCover(photo: UnsplashPhoto, width = 2400): CoverImage {
  const scale = photo.width > width ? width / photo.width : 1;
  return {
    url: unsplashUrl(photo.urls.raw, width),
    alt: (photo.altDescription ?? photo.description ?? "").trim(),
    width: Math.round(photo.width * scale),
    height: Math.round(photo.height * scale),
    color: photo.color ?? undefined,
    source: "unsplash",
    credit: {
      name: photo.user.name,
      username: photo.user.username,
      profileUrl: withUtm(photo.user.profileUrl),
      photoUrl: withUtm(photo.photoUrl),
    },
  };
}

/** Required by Unsplash: trigger a download event when a photo is used. Fire-and-forget. */
function trackDownload(downloadLocation: string) {
  void fetch("/api/unsplash/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ downloadLocation }),
    keepalive: true,
  }).catch(() => {});
}

const TOPICS: { label: string; query: string }[] = [
  { label: "Природа", query: "nature" },
  { label: "Свет", query: "soft light" },
  { label: "Море", query: "sea" },
  { label: "Горы", query: "mountains" },
  { label: "Город", query: "city night" },
  { label: "Небо", query: "sky" },
  { label: "Минимализм", query: "minimal" },
  { label: "Путешествия", query: "travel" },
  { label: "Дом", query: "cozy home" },
  { label: "Люди", query: "people silhouette" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  /** Used for the first search (e.g. the post title). */
  initialQuery?: string;
  title?: string;
  onSelect: (cover: CoverImage, photo: UnsplashPhoto) => void;
  /** Requested image width for the returned URL (cover 2400, body 1600). */
  width?: number;
};

export function UnsplashPicker({ open, onClose, initialQuery, title = "Фото из Unsplash", onSelect, width = 2400 }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description="Бесплатные фотографии. Автор будет указан автоматически." size="xl" bodyClassName="px-4 sm:px-6">
      {open ? <PickerBody initialQuery={initialQuery} onSelect={onSelect} width={width} onClose={onClose} /> : null}
    </Dialog>
  );
}

function PickerBody({
  initialQuery,
  onSelect,
  width,
  onClose,
}: {
  initialQuery?: string;
  onSelect: Props["onSelect"];
  width: number;
  onClose: () => void;
}) {
  const start = (initialQuery ?? "").trim().split(/\s+/).slice(0, 4).join(" ") || "soft light nature";
  const [input, setInput] = useState(initialQuery?.trim() ? start : "");
  const [query, setQuery] = useState(start);
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  // Debounce typing → query.
  useEffect(() => {
    const value = input.trim();
    if (!value) return;
    const t = setTimeout(() => setQuery(value), 450);
    return () => clearTimeout(t);
  }, [input]);

  const load = useCallback(async (q: string, p: number) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ query: q, page: String(p), orientation: "landscape" });
      const res = await fetch(`/api/unsplash/search?${params}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { results: UnsplashPhoto[]; totalPages: number };
      if (id !== requestId.current) return;
      setPhotos((prev) => {
        const merged = p === 1 ? data.results : [...prev, ...data.results];
        const seen = new Set<string>();
        return merged.filter((ph) => (seen.has(ph.id) ? false : (seen.add(ph.id), true)));
      });
      setTotalPages(data.totalPages || 1);
      setPage(p);
    } catch {
      if (id === requestId.current) setError("Не получилось загрузить фотографии. Проверьте интернет и попробуйте ещё раз.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(query, 1), 0);
    return () => clearTimeout(t);
  }, [query, load]);

  // Infinite scroll.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading && !error && page < totalPages) void load(query, page + 1);
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [load, loading, error, page, totalPages, query]);

  const choose = (photo: UnsplashPhoto) => {
    trackDownload(photo.downloadLocation);
    onSelect(unsplashToCover(photo, width), photo);
    onClose();
  };

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-1 bg-bg-elevated px-1 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <input
            type="search"
            className="admin-input pl-10"
            placeholder="Поиск: море, утро, кофе… (лучше по-английски)"
            aria-label="Поиск фотографий"
            value={input}
            data-autofocus
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (input.trim()) setQuery(input.trim());
              }
            }}
          />
        </div>
        <div className="admin-scroll-x mt-2 flex gap-1.5">
          {TOPICS.map((t) => (
            <button
              key={t.query}
              type="button"
              className="admin-btn admin-btn-secondary admin-btn-sm shrink-0"
              aria-pressed={query === t.query}
              onClick={() => {
                setInput(t.query);
                setQuery(t.query);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center text-sm text-fg-muted">
          <ImageOff className="size-6" aria-hidden />
          {error}
          <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => void load(query, page)}>
            Повторить
          </button>
        </div>
      ) : null}

      {!loading && !error && photos.length === 0 ? (
        <p className="py-12 text-center text-sm text-fg-muted">Ничего не нашлось. Попробуйте другое слово или тему выше.</p>
      ) : null}

      <ul className="columns-2 gap-2 sm:columns-3 lg:columns-4" aria-label="Результаты поиска" aria-busy={loading}>
        {photos.map((p) => (
          <li key={p.id} className="mb-2 break-inside-avoid">
            <div className="unsplash-tile group relative overflow-hidden rounded-xl" style={{ backgroundColor: p.color ?? "var(--surface)" }}>
              <button
                type="button"
                onClick={() => choose(p)}
                className="block w-full"
                aria-label={`Выбрать фото${p.altDescription ? `: ${p.altDescription}` : ""}, автор ${p.user.name}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- remote Unsplash thumbnails with their own CDN sizing */}
                <img
                  src={unsplashUrl(p.urls.raw, 480)}
                  alt=""
                  width={480}
                  height={Math.round((480 * p.height) / p.width)}
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full transition-[transform,opacity] duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
                  style={{ aspectRatio: `${p.width} / ${p.height}` }}
                />
              </button>
              <a
                href={withUtm(p.user.profileUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="unsplash-credit absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2.5 pt-6 pb-2 text-xs text-white"
              >
                {p.user.name}
              </a>
            </div>
          </li>
        ))}
      </ul>

      <div ref={sentinel} className="flex h-16 items-center justify-center text-fg-subtle">
        {loading ? <Loader2 className="size-5 animate-spin" aria-label="Загрузка…" /> : null}
      </div>
      <p className="pb-2 text-center text-xs text-fg-subtle">
        Фотографии с{" "}
        <a href={`https://unsplash.com/?${UTM}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-fg">
          Unsplash
        </a>
      </p>
    </div>
  );
}
