import { Inter_Tight, Source_Serif_4 } from "next/font/google";

/** Titles, display & italic text. Body/UI uses the system stack (see globals.css --font-sans). */
export const sourceSerif = Source_Serif_4({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-source-serif",
});

/** Heavy grotesk for the brand wordmark only ("Yuki Diaries": header, hero, footer). Tailwind: `font-brand`. */
export const brandFont = Inter_Tight({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["700", "800"],
  display: "swap",
  // Not "--font-brand": that name is the Tailwind theme token (globals.css), which reads this variable.
  variable: "--font-inter-tight",
});

/** Both font variables, for the root <html> className. */
export const fontVariables = `${sourceSerif.variable} ${brandFont.variable}`;
