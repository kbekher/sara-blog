# Sara's Blog

A calm, dark personal blog — thoughts on life and a very uncommon life experience.

**Russian-only site; readers use browser translation.** Sara writes in Russian and the whole site (posts and UI) is
Russian, served with `<html lang="ru">`. Readers who want Ukrainian, English or anything else use their browser's
built-in page translation (Chrome/Edge/Safari *Translate this page*) — see [Browser translation](#browser-translation).
The blog name («Блог Сары»), author («Сара») and description live in `src/lib/site.ts`.

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS v4 · Drizzle ORM + Neon Postgres · Vercel Blob · Tiptap v3 · Unsplash · LanguageTool · Brevo. Hosted on Vercel.

## Features

- **Public site** in Russian at plain URLs: `/`, `/posts/<slug>`, `/tags`, `/tags/<slug>`, `/search`, `/rss.xml`.
  Old multilingual URLs (`/ru`, `/uk`, `/en` and `/ru|uk|en/…`) permanently redirect (308) to these.
- **Admin** at `/admin` (Russian UI, single author, email + password):
  - rich editor (headings, lists, quotes, links, images, text colors & highlights, alignment) with spell/grammar checking via LanguageTool;
  - cover images from **Unsplash** search (with required attribution) or uploads to **Vercel Blob**;
  - drafts, **publish now** or **schedule** for later, unpublish, delete;
  - tags (auto-transliterated URLs).
- **Newsletter** signup (Brevo, optional double opt-in), RSS, sitemap, SEO/OG images.
- Security: signed httpOnly session cookie, bcrypt password, brute-force throttling, every server action / admin API re-checks the session, CSRF origin checks, security headers, sanitized HTML.

## Local setup

Requirements: Node.js 20.9+ (22 recommended), a Neon (or any Postgres) database.

```bash
corepack enable    # once per machine: makes the pinned pnpm version available
pnpm install
cp .env.example .env.local        # then fill it in (see table below)
pnpm hash-password             # prints ADMIN_PASSWORD_HASH (prompts for the password)
pnpm db:migrate                # create tables
pnpm db:seed                   # optional: sample post "Привет, мир"
pnpm dev                       # http://localhost:3000  ·  admin: http://localhost:3000/admin
```

Tip: once the project is linked to Vercel (`pnpm dlx vercel link`), `pnpm dlx vercel env pull .env.local` downloads all variables.

## Environment variables

| Variable | Required | What / where to get it |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | yes | Public URL, e.g. `https://sarasblog.com` (canonical URLs, RSS, sitemap, newsletter redirect). |
| `DATABASE_URL` | yes | Neon Postgres. Vercel → **Storage** → *Create Database* → **Neon** (Marketplace). Injected automatically into the project. |
| `BLOB_READ_WRITE_TOKEN` | for uploads | Vercel → **Storage** → *Create* → **Blob** → connect to the project. Injected automatically. |
| `ADMIN_EMAIL` | yes | Sara's login email. |
| `ADMIN_PASSWORD_HASH` | yes | Output of `pnpm hash-password`. **Use the `b64:` form** (see note below). |
| `SESSION_SECRET` | yes | Random string ≥ 32 chars: `openssl rand -base64 32`. Changing it signs everyone out. |
| `UNSPLASH_ACCESS_KEY` | for Unsplash covers | [unsplash.com/developers](https://unsplash.com/developers) → *Your apps* → *New Application* → **Access Key**. New apps are in *Demo* mode (**50 requests/hour**). Once the site is live, click *Apply for Production* (needs attribution + download tracking, both implemented) to get **5,000 requests/hour**. |
| `LANGUAGETOOL_API_URL` | no | Defaults to the free public API `https://api.languagetool.org/v2` (20 req/min, 20k chars/request). Point to a self-hosted server or keep default. |
| `LANGUAGETOOL_USERNAME`, `LANGUAGETOOL_API_KEY` | no | LanguageTool Premium credentials (higher limits, more rules). |
| `BREVO_API_KEY` | for newsletter | [app.brevo.com](https://app.brevo.com) → *Settings* → **SMTP & API** → *API keys* → Generate. |
| `BREVO_LIST_ID` | for newsletter | *Contacts* → *Lists* → create a list → its numeric **ID**. |
| `BREVO_DOI_TEMPLATE_ID` | no | Enables **double opt-in** (recommended in the EU): *Campaigns → Templates* → create a template from the "Double opt-in" type → its ID. |
| `BREVO_DOI_REDIRECT_URL` | no | Where the confirmation link sends people (defaults to the site's home page). |
| `BREVO_SENDER_EMAIL` | for post emails | Sender address for the automatic "new post" emails. Must be added **and verified** in Brevo → *Senders, Domains & Dedicated IPs* → **Senders**. Without it posts are published but not emailed. |
| `BREVO_SENDER_NAME` | no | Sender name shown in the inbox (defaults to the site author, «Сара»). |

Optional Brevo nicety: create a contact attribute `LANGUAGE` (text); every subscriber gets `RU`. It's silently skipped if absent.

### Newsletter: new posts are emailed automatically

When Sara publishes a post, the blog emails the Brevo list automatically (a Brevo email campaign styled like
`emails/new-post.html`: cover, title, subtitle, the first paragraphs and a «Читать полностью →» button to the post).

- **Publish now** → the email goes out immediately. **Scheduled post** → the campaign is scheduled in Brevo for the
  publish time, so subscribers get it when the post appears.
- **Never twice:** each post is emailed at most once. «Обновить», re-publishing or changing the date of an
  already-sent post sends nothing. Moving a *scheduled* post moves its email; unpublishing or deleting a scheduled
  post cancels its email.
- The publish dialog has a checkbox «Отправить письмо подписчикам» (on by default) to skip the email for a post.
- An email failure never blocks publishing: the post goes live and the admin shows why the email wasn't sent.
- Needs `BREVO_API_KEY`, `BREVO_LIST_ID` and a verified `BREVO_SENDER_EMAIL`; check everything at
  `/api/newsletter/check` while logged in. Brevo's free plan allows 300 emails/day.

### ⚠ The `$` in password hashes

bcrypt hashes look like `$2b$12$...`. Next.js expands `$VARIABLES` inside `.env` files — **even in quotes** — which silently corrupts the hash and makes login impossible. Therefore:

- In `.env` / `.env.local`: use the **`b64:`** value printed by `pnpm hash-password` (e.g. `ADMIN_PASSWORD_HASH=b64:JDJiJDEy...`). Escaping every `$` as `\$` also works.
- In the Vercel dashboard values are not expanded, so either form works — `b64:` is simplest everywhere.

To change the password: run `pnpm hash-password` again, update the variable, redeploy. All existing sessions are invalidated automatically.

## Database & migrations

Schema: `src/db/schema.ts`. Migrations are SQL files in `drizzle/`.

```bash
pnpm db:generate   # after changing schema.ts → creates a new drizzle/NNNN_*.sql
pnpm db:migrate    # applies pending migrations (uses DATABASE_URL from .env.local / .env)
pnpm db:studio     # browse data
```

**On Vercel, migrations run automatically on every deploy**: `vercel.json` sets the build command to `pnpm vercel-build` = `tsx scripts/migrate.ts && next build`. If `DATABASE_URL` is missing, a **production** build fails loudly; preview/local builds just skip migrations with a warning.

## Browser translation

The blog does not translate posts itself. Everything is written for the browser's own translator instead:

- every page is `<html lang="ru">`, so Chrome/Edge/Safari offer *Translate this page* automatically;
- nothing opts out of translation (no `translate="no"`, `notranslate` or `<meta name="google" content="notranslate">`);
  photo credits and the cover attribution are ordinary text, and older posts that still carry `translate="no"` on the
  credit line have it stripped when they are read;
- all visible text is real DOM text (no text in CSS `content:` or in images), so the translator can see it;
- translators replace text nodes with `<font>` elements, which normally makes React crash later with
  *"Failed to execute 'removeChild' on 'Node'"* ([facebook/react#11538](https://github.com/facebook/react/issues/11538)).
  `src/components/translate-guard.tsx` (an inline script in the site's `<head>`) patches `Node.prototype.removeChild`
  / `insertBefore` to ignore nodes that are no longer children of the parent, and interactive components keep
  changing text in its own (keyed) element so React replaces whole elements rather than translated text nodes.

The database schema is unchanged from the multilingual version: post text lives in the `ru` row of
`post_translations`; old `uk`/`en` rows, if any, are simply ignored.

## How Sara writes

1. Go to `/admin` → sign in with email + password (5 wrong attempts from one IP lock login for 15 minutes).
2. **Новый пост** → write in Russian (spellcheck, typography and LanguageTool are set up for Russian). Pick a cover (Unsplash search or upload), add tags. Drafts are saved with **Сохранить**.
3. The URL (slug) is generated from the title by transliteration (`Привет, мир` → `privet-mir`). It stays fixed once the post has been published, unless changed by hand.
4. **Опубликовать**: the post goes live at `/posts/<slug>`. For a published post, **Обновить** saves and refreshes the public page.
5. **Schedule**: choose a date/time in the future when publishing. The post is stored as *published* with a future date, shows as *Запланирован* in the admin, and appears on the site automatically once that time passes (no cron needed — public queries only show posts whose publish time is in the past).
6. *Снять с публикации* hides a post again (it keeps its URL); *Удалить* removes it and its uploaded images.

## Deploying to Vercel

1. Push the repo to GitHub and **Import** it at [vercel.com/new](https://vercel.com/new) (framework: Next.js — detected automatically).
2. In the project: **Storage → Create → Neon Postgres** and **Storage → Create → Blob**; connect both to all environments. This injects `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN`.
   For Neon pick the **Free** plan, region **Frankfurt (aws-eu-central-1)**, and leave **Auth** and **Realtime** off (the blog has its own admin login). Server functions are pinned to `fra1` (Frankfurt) in `vercel.json` so they sit next to the database — if you choose another DB region, change `regions` there to match.
3. **Settings → Environment Variables**: add `NEXT_PUBLIC_SITE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, and the optional service keys (Unsplash, Brevo, LanguageTool).
4. **Deploy.** The build runs migrations, then `next build`. Optionally seed once from your machine: `pnpm dlx vercel env pull .env.local && pnpm db:seed`.
5. Add your domain under **Settings → Domains**, update `NEXT_PUBLIC_SITE_URL`, redeploy.
6. Apply for Unsplash *Production* access once the site is public.

## Project layout

```
src/app/(site)/        public site (route group with its own root layout, <html lang="ru">); _lib/ = SEO & OG helpers
src/app/admin/         admin (own root layout); actions.ts = all admin server actions; login/
src/app/api/           upload (Vercel Blob), unsplash/search|download, languagetool, newsletter
src/app/global-not-found.tsx  404 for URLs that match no route (there is no top-level app/layout.tsx)
src/proxy.ts           admin auth gate (Next 16's "middleware")
next.config.ts         security headers + permanent redirects from the old /ru|/uk|/en URLs
src/db/                Drizzle schema & client
src/lib/auth/          JWT session, password check, login throttling, request guards
src/lib/content/       Tiptap JSON ⇄ sanitized HTML pipeline (shared by editor, actions, site)
src/lib/services/      Unsplash, Brevo, LanguageTool, slugs, rate limit
src/lib/i18n/          the Russian UI dictionary + formatting helpers (dates, plurals)
src/lib/posts/         public (cached) and admin (uncached) queries
scripts/               hash-password, migrate, seed
drizzle/               SQL migrations
```

## Notes & limits

- The newsletter endpoint's rate limit is in-memory (per serverless instance, best-effort); add a Vercel Firewall rate-limit rule on `/api/newsletter` for stronger protection.
- Unsplash search results are cached for ~10 minutes to save quota.
