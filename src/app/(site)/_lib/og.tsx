import { cacheLife } from "next/cache";
import type { ReactNode } from "react";
import { site } from "@/lib/site";

export const OG_SIZE = { width: 1200, height: 630 };

/**
 * Source Serif 4 (TTF) for next/og, fetched from Google Fonts and subset to the glyphs we render
 * (so Cyrillic works). Without a browser User-Agent the CSS API serves TrueType, which Satori supports.
 * Cached for a long time; failures throw (never cached) and callers fall back to the bundled font.
 */
async function fetchSerifFont(weight: 400 | 600, text: string): Promise<ArrayBuffer> {
  "use cache";
  cacheLife("max");
  const cssUrl = `https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(cssUrl)).text();
  const src = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
  if (!src) throw new Error("Source Serif 4: no TrueType source in Google Fonts CSS");
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Source Serif 4: font download failed (${res.status})`);
  return res.arrayBuffer();
}

export type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 600; style: "normal" };

/** Loads the serif in the weights used by the OG templates; returns [] if Google Fonts is unreachable. */
export async function loadOgFonts(text: string): Promise<OgFont[]> {
  // Deduplicate characters to keep the subset (and the cache key) small.
  const glyphs = Array.from(new Set(Array.from(`${text}${site.name}·—0123456789`))).sort().join("");
  try {
    const [regular, semibold] = await Promise.all([fetchSerifFont(400, glyphs), fetchSerifFont(600, glyphs)]);
    return [
      { name: "Source Serif 4", data: regular, weight: 400, style: "normal" },
      { name: "Source Serif 4", data: semibold, weight: 600, style: "normal" },
    ];
  } catch {
    return [];
  }
}

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

/** Shared dark card: optional full-bleed cover with a gradient, serif title, blog name. */
export function OgCard({
  eyebrow,
  title,
  subtitle,
  cover,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  cover?: string | null;
}): ReactNode {
  const titleSize = title.length > 90 ? 52 : title.length > 50 ? 62 : 74;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: "#142030",
        color: "#f5f4f2",
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
            ? "linear-gradient(180deg, rgba(11,11,12,0.25) 0%, rgba(11,11,12,0.7) 55%, rgba(11,11,12,0.96) 100%)"
            : "radial-gradient(90% 120% at 15% 0%, rgba(212,163,115,0.18) 0%, rgba(11,11,12,0) 60%)",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          width: "100%",
          height: "100%",
          padding: "64px 72px",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, color: "#ff5c8d", letterSpacing: 1, marginBottom: 22 }}>
          {eyebrow}
        </div>
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
        {subtitle && (
          <div style={{ display: "flex", fontSize: 30, lineHeight: 1.35, color: "#a3a09b", marginTop: 24, maxWidth: 960 }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
