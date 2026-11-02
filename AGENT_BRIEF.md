# Shared brief for all agents (read fully)

Project: "Sara's Blog" — a personal blog (thoughts on life, very uncommon life experience). Next.js 16.4 App Router,
React 19.3, TypeScript, Tailwind v4, Drizzle ORM + Neon Postgres (HTTP driver), Vercel Blob, Tiptap v3. Hosted on Vercel.

## CRITICAL: this Next.js version differs from your training data
Read relevant docs in `node_modules/next/dist/docs/01-app/` BEFORE writing code. Notably:
- `cacheComponents: true` + `partialPrefetching: true` are ON. Data is dynamic by default; use `'use cache'` + `cacheLife` + `cacheTag`
  for cacheable reads; runtime APIs (cookies/headers/searchParams/ uncached DB reads) must be inside `<Suspense>`.
  See 01-getting-started/08-caching.md, 09-revalidating.md, 02-guides/authentication-with-cache-components.md.
  Admin pages may opt out of the static-shell validation with `export const instant = false` (see 02-guides/instant-navigation if present).
- `middleware.ts` is renamed to `proxy.ts` (src/proxy.ts). See 03-api-reference/03-file-conventions/proxy.md.
- `params` / `searchParams` are Promises. Global helpers `PageProps<'/route'>`, `LayoutProps<'/route'>` exist (run `npx next typegen` after adding routes).
- `revalidateTag(tag, 'max')` requires 2 args; `updateTag(tag)` in server actions for read-your-writes.

## Structure (two root layouts, no app/layout.tsx)
- `src/app/[lang]/...` public site, root layout with `<html lang>`; `lang` ∈ ru|uk|en (default ru). `/` → redirect to `/ru` (or Accept-Language match) in `src/proxy.ts`.
- `src/app/admin/...` admin, own root layout, Russian UI (her native language), noindex.
- `src/app/api/...` route handlers.

## Shared, already-written foundation (do NOT rewrite; small additive edits OK if essential — mention them in your report)
- `src/db/schema.ts` — posts, post_translations (per locale: title, excerpt, contentJson, contentHtml (sanitized), plainText, readingMinutes, isMachineTranslated, sourceHash), tags (names per locale), post_tags, login_attempts.
  Status model: draft | published; published with publishedAt > now() == scheduled (auto goes live — public queries must filter `publishedAt <= now()`).
- `src/db/index.ts` — `db` (drizzle, lazy), `hasDatabase`.
- `src/lib/i18n/config.ts` — locales, Locale, defaultLocale, localeNames/Short/Tags, deeplTargets, languageToolCodes, isLocale.
- `src/lib/site.ts` — site name/author/url/description per locale.
- `src/lib/content/` — content pipeline contract (types.ts + pipeline.ts placeholder → implemented by EDITOR agent). TEXT_COLORS palette.
- `src/lib/admin/types.ts` — contract types between admin UI & server actions.
- `src/app/admin/actions.ts` — server action signatures (placeholder → implemented by BACKEND agent). Signatures are fixed.
- `src/app/globals.css` — design tokens. Use the Tailwind color tokens: bg, bg-elevated, bg-sunken, surface, surface-hover, border, border-strong,
  fg, fg-strong, fg-muted, fg-subtle, accent, accent-hover, accent-fg; fonts: `font-serif` (Source Serif 4: titles, italic/display), `font-sans` (system stack: body & UI).
  Themes via `<html data-theme="dark|light">` (dark default) set pre-paint by `src/components/theme-script.tsx` (localStorage "theme": dark|light|system).
  Editor colors are rendered as `<span data-color="red">` and highlights as `<mark data-highlight="yellow">` — CSS already exists; never inline hex colors.
- `src/app/fonts.ts` — `sourceSerif` (variable --font-source-serif).
- `.env.example` — all env vars.

## Design direction
Dark, calm, premium, "Apple-smooth": generous whitespace, subtle borders instead of heavy shadows, glassy sticky header (backdrop-blur, --glass),
soft 200–500ms transitions with --ease-apple / --ease-out-expo, respect prefers-reduced-motion. Reading pages like jovidecroock.com/blog and
openai.com/index articles: narrow centered column (~66ch), big serif title, quiet sans meta line, large cover image, excellent typography.
Reading best practices: body 1.125–1.1875rem, line-height ~1.7, paragraph spacing ~1.25em, hanging punctuation where possible, `text-wrap: pretty` for
paragraphs and `balance` for headings, hyphens: auto with correct `lang`, AA contrast. Fully responsive & accessible (semantic HTML, keyboard, focus-visible, aria labels).

## Rules
- Only create/modify files in YOUR ownership list. If you truly need a change elsewhere, make it minimal and list it in your report.
- Do NOT run `npm install` (all deps are installed; see package.json). If something essential is missing, say so in your report and work around it.
- Do NOT run `next build` or `next dev` (other agents share the tree). Verify with `npx next typegen && npx tsc --noEmit` and `npx eslint <your paths>`.
  Errors in files owned by other agents (in-progress) can be ignored; yours must be clean.
- Do NOT commit; the lead will review and commit.
- No placeholders/TODO stubs in your area — production quality. Keep code idiomatic, typed, and commented where non-obvious.
- Final report: files created/changed, any contract deviations, anything other agents/lead must know, known limitations.
