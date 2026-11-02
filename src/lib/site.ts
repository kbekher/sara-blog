/** Central site settings — edit freely. */
export const site = {
  /** Blog name (header, footer, titles, OG images, RSS, JSON-LD). */
  name: "Блог Сары",
  /** Author name (bylines, metadata, RSS, JSON-LD). */
  author: "Сара",
  /** IANA time zone used to display post dates (and the admin scheduler hint). */
  timeZone: process.env.NEXT_PUBLIC_SITE_TIMEZONE || "Europe/Paris",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  description: "Здесь будет то, о чём неловко говорить.",
} as const;
