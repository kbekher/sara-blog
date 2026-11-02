# Email templates (Brevo)

Styled like the blog (dark, Source Serif 4 / Georgia headings, navy `#142030` + Stellar Strawberry accent `#FF5C8D`).

| File | Use in Brevo | Required tag |
|---|---|---|
| `double-opt-in.html` | Contacts → Forms/Double opt-in → template id → `BREVO_DOI_TEMPLATE_ID` | `{{ doubleoptin }}` (confirmation link) |
| `new-post.html` | Campaigns → Create email → "Paste your code" for each new post; edit the ✏️ parts | `{{ unsubscribe }}` |

How to add: Brevo → **Campaigns → Templates → New template → Paste your code** → paste the file contents → Save & activate.
For the double opt-in template also set the template's **Sender** to your verified sender and tick
**"Double opt-in (DOI) template"** if Brevo shows that option.
