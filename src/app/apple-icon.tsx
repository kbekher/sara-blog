import { ImageResponse } from "next/og";
import { loadBrandFont, OG_COLORS } from "./(site)/_lib/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: teal brand-grotesk "Y" on dark ink (falls back to the bundled font offline). */
export default async function AppleIcon() {
  const fonts = await loadBrandFont("Y");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: OG_COLORS.bg,
          color: OG_COLORS.accent,
          fontSize: 124,
          fontWeight: 800,
          letterSpacing: -4,
          fontFamily: '"Inter Tight", sans-serif',
          paddingBottom: 6,
        }}
      >
        Y
      </div>
    ),
    { ...size, fonts },
  );
}
