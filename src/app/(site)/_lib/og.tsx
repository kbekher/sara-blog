import { cacheLife } from "next/cache";
import type { ReactNode } from "react";
import { site } from "@/lib/site";

export const OG_SIZE = { width: 1200, height: 630 };

/**
 * A Google Font (TTF) for next/og, subset to the glyphs we render (so Cyrillic works). Without a browser
 * User-Agent the CSS API serves TrueType, which Satori supports. Cached for a long time; failures throw (never
 * cached) and callers fall back to the bundled font.
 */
async function fetchGoogleFont(family: string, axes: string, text: string): Promise<ArrayBuffer> {
  "use cache";
  cacheLife("max");
  const cssUrl = `https://fonts.googleapis.com/css2?family=${family}:${axes}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(cssUrl)).text();
  const src = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
  if (!src) throw new Error(`${family}: no TrueType source in Google Fonts CSS`);
  const res = await fetch(src);
  if (!res.ok) throw new Error(`${family}: font download failed (${res.status})`);
  return res.arrayBuffer();
}

export type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 600 | 800; style: "normal" };

/** Deduplicated, sorted glyph set (keeps the subset and the cache key small). */
function glyphSet(text: string): string {
  return Array.from(new Set(Array.from(text))).sort().join("");
}

/** The brand grotesk (Inter Tight 800) for the wordmark; [] if Google Fonts is unreachable. */
export async function loadBrandFont(text: string = site.name): Promise<OgFont[]> {
  try {
    const data = await fetchGoogleFont("Inter+Tight", "wght@800", glyphSet(text));
    return [{ name: "Inter Tight", data, weight: 800, style: "normal" }];
  } catch {
    return [];
  }
}

/** Source Serif 4 (titles) + Inter Tight (brand) in the weights the OG templates use; [] parts on failure. */
export async function loadOgFonts(text: string): Promise<OgFont[]> {
  // Uppercase forms too: the eyebrow is rendered with text-transform: uppercase.
  const glyphs = glyphSet(`${text}${text.toLocaleUpperCase("ru")}${site.name}·—|0123456789`);
  const serif = async (): Promise<OgFont[]> => {
    try {
      const [regular, semibold] = await Promise.all([
        fetchGoogleFont("Source+Serif+4", "opsz,wght@8..60,400", glyphs),
        fetchGoogleFont("Source+Serif+4", "opsz,wght@8..60,600", glyphs),
      ]);
      return [
        { name: "Source Serif 4", data: regular, weight: 400, style: "normal" },
        { name: "Source Serif 4", data: semibold, weight: 600, style: "normal" },
      ];
    } catch {
      return [];
    }
  };
  const [serifFonts, brandFonts] = await Promise.all([serif(), loadBrandFont(site.name)]);
  return [...serifFonts, ...brandFonts];
}

/** OG / icon palette (the dark theme tokens of globals.css). */
export const OG_COLORS = {
  bg: "#1b1918",
  elevated: "#252220",
  fg: "#ece6e0",
  strong: "#f7f3ef",
  muted: "#a39b93",
  accent: "#4fd1c5",
} as const;

/**
 * Fetches a cover image and returns it as a data URL Satori can embed (JPEG/PNG only — Satori can't
 * decode WebP/AVIF). Unsplash covers are requested as a 1200px JPEG. Returns null on any failure.
 */
export async function loadCoverDataUrl(url: string): Promise<string | null> {
  try {
    const target = new URL(url);
    if (target.hostname === "images.unsplash.com") {
      target.searchParams.set("w", "1200");
      target.searchParams.set("q", "70");
      target.searchParams.set("fm", "jpg");
      target.searchParams.set("fit", "crop");
      target.searchParams.delete("auto");
    }
    const res = await fetch(target, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (type !== "image/jpeg" && type !== "image/png") return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > 4 * 1024 * 1024) return null;
    return `data:${type};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

const BRAND_STACK = '"Inter Tight", sans-serif';

/**
 * Shared dark-ink card: brand wordmark top-left, teal tracked eyebrow, serif title (or, with `brandTitle`, the
 * huge wordmark as on the home hero), optional full-bleed cover under a dark gradient.
 */
export function OgCard({
  eyebrow,
  title,
  subtitle,
  cover,
  brandTitle = false,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  cover?: string | null;
  brandTitle?: boolean;
}): ReactNode {
  const titleSize = title.length > 90 ? 52 : title.length > 50 ? 62 : 74;
  const words = title.split(" ");
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: OG_COLORS.bg,
        color: OG_COLORS.strong,
        fontFamily: '"Source Serif 4", serif',
      }}
    >
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img> only.
        <img
          src={cover}
          alt=""
          width={OG_SIZE.width}
          height={OG_SIZE.height}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background: cover
            ? "linear-gradient(180deg, rgba(27,25,24,0.35) 0%, rgba(27,25,24,0.72) 55%, rgba(27,25,24,0.97) 100%)"
            : "radial-gradient(90% 120% at 100% 0%, rgba(79,209,197,0.16) 0%, rgba(27,25,24,0) 60%)",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "56px 72px 64px",
        }}
      >
        <div style={{ display: "flex", fontFamily: BRAND_STACK, fontWeight: 800, fontSize: 30, letterSpacing: -0.9 }}>
          {brandTitle ? null : site.name}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: OG_COLORS.accent,
              letterSpacing: 4,
              textTransform: "uppercase",
              marginBottom: 22,
            }}
          >
            {eyebrow}
          </div>
          {brandTitle ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontFamily: BRAND_STACK,
                fontWeight: 800,
                fontSize: 150,
                lineHeight: 0.92,
                letterSpacing: -4.5,
              }}
            >
              {words.map((word, i) => (
                <span key={i}>{word}</span>
              ))}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                fontSize: titleSize,
                fontWeight: 600,
                lineHeight: 1.08,
                letterSpacing: -1.2,
                maxWidth: 1040,
              }}
            >
              {title}
            </div>
          )}
          {subtitle && (
            <div style={{ display: "flex", fontSize: 30, lineHeight: 1.35, color: OG_COLORS.muted, marginTop: 24, maxWidth: 960 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
