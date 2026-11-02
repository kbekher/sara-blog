import { Source_Serif_4 } from "next/font/google";

/** Titles, display & italic text. Body/UI uses the system stack (see globals.css --font-sans). */
export const sourceSerif = Source_Serif_4({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-source-serif",
});
