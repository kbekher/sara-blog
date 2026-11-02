# Sara's Blog

A calm, dark, multilingual personal blog — thoughts on life and a very uncommon life experience.
Sara writes in Russian; posts are machine-translated to Ukrainian and English with DeepL and can be hand-edited.

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS v4 · Drizzle ORM + Neon Postgres · Vercel Blob · Tiptap v3 · DeepL · Unsplash · LanguageTool · Brevo. Hosted on Vercel.

## Features

- **Public site** in `ru` / `uk` / `en` (`/ru/...`, `/uk/...`, `/en/...`). Visitors hitting `/` are redirected to their language (cookie → browser `Accept-Language` → Russian).
- **Admin** at `/admin` (Russian UI, single author, email + password):
  - rich editor (headings, lists, quotes, links, images, text colors & highlights, alignment) with spell/grammar checking via LanguageTool;
  - cover images from **Unsplash** search (with required attribution) or uploads to **Vercel Blob**;
  - **one-click translation** to the other two languages (DeepL, HTML-aware so formatting survives); translations are editable and marked *stale* when the source changes;
  - drafts, **publish now** or **schedule** for later, unpublish, delete;
  - tags (auto-transliterated URLs, names auto-translated).
- **Newsletter** signup (Brevo, optional double opt-in), RSS, sitemap, SEO/OG images.
- Security: signed httpOnly session cookie, bcrypt password, brute-force throttling, every server action / admin API re-checks the session, CSRF origin checks, security headers, sanitized HTML.

## Local setup

Requirements: Node.js 20.9+ (22 recommended), a Neon (or any Postgres) database.

```bash
npm install
cp .env.example .env.local        # then fill it in (see table below)
npm run hash-password             # prints ADMIN_PASSWORD_HASH (prompts for the password)
npm run db:migrate                # create tables
npm run db:seed                   # optional: sample post "Привет, мир"
npm run dev                       # http://localhost:3000  ·  admin: http://localhost:3000/admin
```

Tip: once the project is linked to Vercel (`npx vercel link`), `npx vercel env pull .env.local` downloads all variables.

## Environment variables

| Variable | Required | What / where to get it |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | yes | Public URL, e.g. `https://sarasblog.com` (canonical URLs, RSS, sitemap, newsletter redirect). |
| `DATABASE_URL` | yes | Neon Postgres. Vercel → **Storage** → *Create Database* → **Neon** (Marketplace). Injected automatically into the project. |
| `BLOB_READ_WRITE_TOKEN` | for uploads | Vercel → **Storage** → *Create* → **Blob** → connect to the project. Injected automatically. |
| `ADMIN_EMAIL` | yes | Sara's login email. |
| `ADMIN_PASSWORD_HASH` | yes | Output of `npm run hash-password`. **Use the `b64:` form** (see note below). |
| `SESSION_SECRET` | yes | Random string ≥ 32 chars: `openssl rand -base64 32`. Changing it signs everyone out. |
| `UNSPLASH_ACCESS_KEY` | for Unsplash covers | [unsplash.com/developers](https://unsplash.com/developers) → *Your apps* → *New Application* → **Access Key**. New apps are in *Demo* mode (**50 requests/hour**). Once the site is live, click *Apply for Production* (needs attribution + download tracking, both implemented) to get **5,000 requests/hour**. |
| `DEEPL_API_KEY` | for translation | [deepl.com/pro-api](https://www.deepl.com/pro-api) → **DeepL API Free** (500,000 chars/month; key ends in `:fx`). Without it, posts publish in Russian only and the other languages fall back to Russian. |
| `LANGUAGETOOL_API_URL` | no | Defaults to the free public API `https://api.languagetool.org/v2` (20 req/min, 20k chars/request). Point to a self-hosted server or keep default. |
| `LANGUAGETOOL_USERNAME`, `LANGUAGETOOL_API_KEY` | no | LanguageTool Premium credentials (higher limits, more rules). |
| `BREVO_API_KEY` | for newsletter | [app.brevo.com](https://app.brevo.com) → *Settings* → **SMTP & API** → *API keys* → Generate. |
| `BREVO_LIST_ID` | for newsletter | *Contacts* → *Lists* → create a list → its numeric **ID**. |
| `BREVO_DOI_TEMPLATE_ID` | no | Enables **double opt-in** (recommended in the EU): *Campaigns → Templates* → create a template from the "Double opt-in" type → its ID. |
| `BREVO_DOI_REDIRECT_URL` | no | Where the confirmation link sends people (defaults to the site's home page in their language). |

Optional Brevo nicety: create a contact attribute `LANGUAGE` (text) to store each subscriber's language (`RU`/`UK`/`EN`); it's silently skipped if absent.

### ⚠ The `$` in password hashes

bcrypt hashes look like `$2b$12$...`. Next.js expands `$VARIABLES` inside `.env` files — **even in quotes** — which silently corrupts the hash and makes login impossible. Therefore:

- In `.env` / `.env.local`: use the **`b64:`** value printed by `npm run hash-password` (e.g. `ADMIN_PASSWORD_HASH=b64:JDJiJDEy...`). Escaping every `$` as `\$` also works.
- In the Vercel dashboard values are not expanded, so either form works — `b64:` is simplest everywhere.

To change the password: run `npm run hash-password` again, update the variable, redeploy. All existing sessions are invalidated automatically.

## Database & migrations

Schema: `src/db/schema.ts`. Migrations are SQL files in `drizzle/`.

```bash
npm run db:generate   # after changing schema.ts → creates a new drizzle/NNNN_*.sql
npm run db:migrate    # applies pending migrations (uses DATABASE_URL from .env.local / .env)
npm run db:studio     # browse data
```

**On Vercel, migrations run automatically on every deploy**: `vercel.json` sets the build command to `npm run vercel-build` = `tsx scripts/migrate.ts && next build`. If `DATABASE_URL` is missing, a **production** build fails loudly; preview/local builds just skip migrations with a warning.

## How Sara writes

1. Go to `/admin` → sign in with email + password (5 wrong attempts from one IP lock login for 15 minutes).
2. **Новый пост** → write in Russian. Pick a cover (Unsplash search or upload), add tags. Drafts are saved with **Сохранить**.
3. The URL (slug) is generated from the title by transliteration (`Привет, мир` → `privet-mir`). It stays fixed once the post has been published, unless changed by hand.
4. **Опубликовать**: translations to Ukrainian and English are created (or refreshed if the Russian text changed) by DeepL, then the post goes live. Translations can be opened and edited; hand-edited translations are never overwritten automatically — use *Перевести заново* to refresh them explicitly.
5. **Schedule**: choose a date/time in the future when publishing. The post is stored as *published* with a future date, shows as *Запланирован* in the admin, and appears on the site automatically once that time passes (no cron needed — public queries only show posts whose publish time is in the past).
6. *Снять с публикации* hides a post again (it keeps its URL); *Удалить* removes it and its uploaded images.

## Deploying to Vercel

1. Push the repo to GitHub and **Import** it at [vercel.com/new](https://vercel.com/new) (framework: Next.js — detected automatically).
2. In the project: **Storage → Create → Neon Postgres** and **Storage → Create → Blob**; connect both to all environments. This injects `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN`.
3. **Settings → Environment Variables**: add `NEXT_PUBLIC_SITE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, and the optional service keys (Unsplash, DeepL, Brevo, LanguageTool).
4. **Deploy.** The build runs migrations, then `next build`. Optionally seed once from your machine: `npx vercel env pull .env.local && npm run db:seed`.
5. Add your domain under **Settings → Domains**, update `NEXT_PUBLIC_SITE_URL`, redeploy.
6. Apply for Unsplash *Production* access once the site is public.

## Project layout

```
src/app/[lang]/        public site (root layout per language)
src/app/admin/         admin (own root layout); actions.ts = all admin server actions; login/
src/app/api/           upload (Vercel Blob), unsplash/search|download, languagetool, newsletter
src/proxy.ts           locale redirects + admin auth gate (Next 16's "middleware")
src/db/                Drizzle schema & client
src/lib/auth/          JWT session, password check, login throttling, request guards
src/lib/content/       Tiptap JSON ⇄ sanitized HTML pipeline (shared by editor, actions, site)
src/lib/services/      DeepL, translation, Unsplash, Brevo, LanguageTool, slugs, hashing, rate limit
src/lib/posts/         public (cached) and admin (uncached) queries
scripts/               hash-password, migrate, seed
drizzle/               SQL migrations
```

## Notes & limits

- The newsletter endpoint's rate limit is in-memory (per serverless instance, best-effort); add a Vercel Firewall rate-limit rule on `/api/newsletter` for stronger protection.
- Unsplash search results are cached for ~10 minutes to save quota.
- DeepL Free allows 500k characters/month; a typical post (≈ 8k characters) costs ≈ 16k characters to translate into both languages.
