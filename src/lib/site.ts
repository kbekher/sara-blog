/** Central site settings — edit freely. */
export const site = {
  name: "Sara's Blog",
  author: "Sara",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  description: {
    ru: "Мысли о разных сторонах жизни и очень необычный жизненный опыт.",
    uk: "Думки про різні сторони життя та дуже незвичайний життєвий досвід.",
    en: "Thoughts on different sides of life, and a very uncommon life experience.",
  },
} as const;
