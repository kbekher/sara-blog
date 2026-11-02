import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: amber serif "S" on the dark background (Latin only, so the bundled font suffices). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0b0c",
          color: "#d4a373",
          fontSize: 120,
          fontWeight: 600,
          fontFamily: "Georgia, serif",
          paddingBottom: 8,
        }}
      >
        S
      </div>
    ),
    size,
  );
}
