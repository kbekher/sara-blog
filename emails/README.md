# Email templates (Brevo)

Styled like the blog (dark, Source Serif 4 / Georgia headings, warm amber accent `#D4A373`).

| File | Use in Brevo | Required tag |
|---|---|---|
| `double-opt-in.html` | Contacts → Forms/Double opt-in → template id → `BREVO_DOI_TEMPLATE_ID` | `{{ doubleoptin }}` (confirmation link) |
| `new-post.html` | Campaigns → Create email → "Paste your code" for each new post; edit the ✏️ parts | `{{ unsubscribe }}` |

> **`new-post.html` is now only for manual campaigns.** Publishing a post emails subscribers automatically with
> the same design, generated in code (`src/lib/services/newsletter-campaign.ts` — edit the look there). Use this
> file only for one-off emails you send by hand from Brevo.

How to add: Brevo → **Campaigns → Templates → New template → Paste your code** → paste the file contents → Save & activate.
For the double opt-in template also set the template's **Sender** to your verified sender and tick
**"Double opt-in (DOI) template"** if Brevo shows that option.

## Automatic setup (recommended)

From the repo on your computer (needs a verified sender in Brevo):

```bash
BREVO_API_KEY=xkeysib-... pnpm brevo:setup -- --sender her@email.com --name "Сара"
```

Creates/updates both templates (double opt-in gets the required `optin` tag) and prints
`BREVO_DOI_TEMPLATE_ID` and `BREVO_LIST_ID` to paste into Vercel. Safe to re-run after editing the HTML.
