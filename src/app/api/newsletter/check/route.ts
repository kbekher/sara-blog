/**
 * GET /api/newsletter/check — admin-only diagnostics for the Brevo newsletter setup.
 * Open it in the browser while logged in to /admin. Reports what is misconfigured, in Russian,
 * without ever returning secrets (the API key is never echoed).
 */
import { authorizeAdminRequest } from "@/lib/auth/guard";

const API = "https://api.brevo.com/v3";

type Check = { ok: boolean; item: string; detail: string };

async function brevo(path: string, apiKey: string): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { "api-key": apiKey, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  } catch (error) {
    return { status: 0, body: { message: error instanceof Error ? error.message : String(error) } };
  }
}

export async function GET(request: Request): Promise<Response> {
  const auth = await authorizeAdminRequest(request, { mutating: false });
  if (auth.response) return auth.response;

  const checks: Check[] = [];
  const add = (ok: boolean, item: string, detail: string) => checks.push({ ok, item, detail });

  const apiKey = process.env.BREVO_API_KEY?.trim() ?? "";
  const rawList = process.env.BREVO_LIST_ID?.trim() ?? "";
  const rawTemplate = process.env.BREVO_DOI_TEMPLATE_ID?.trim() ?? "";
  const listId = Number(rawList);
  const templateId = Number(rawTemplate);

  // 1. Env vars present & well-formed.
  add(!!apiKey, "BREVO_API_KEY", apiKey ? (apiKey.startsWith("xkeysib-") ? "задан" : "задан, но не похож на API-ключ (должен начинаться с xkeysib-; SMTP-ключ xsmtpsib- не подходит)") : "не задан в Vercel");
  add(
    Number.isInteger(listId) && listId > 0,
    "BREVO_LIST_ID",
    !rawList ? "не задан" : Number.isInteger(listId) && listId > 0 ? `= ${listId}` : `должен быть ЧИСЛОМ (ID списка), а сейчас: «${rawList}». Brevo → Contacts → Lists → колонка ID`,
  );
  if (rawTemplate) {
    add(
      Number.isInteger(templateId) && templateId > 0,
      "BREVO_DOI_TEMPLATE_ID",
      Number.isInteger(templateId) && templateId > 0 ? `= ${templateId} (двойное подтверждение включено)` : `должен быть ЧИСЛОМ (ID шаблона), а сейчас: «${rawTemplate}»`,
    );
  } else {
    add(true, "BREVO_DOI_TEMPLATE_ID", "не задан — подписчики добавляются сразу, без письма-подтверждения");
  }

  // 2. Live checks against Brevo.
  if (apiKey) {
    const account = await brevo("/account", apiKey);
    if (account.status === 200) {
      add(true, "Ключ Brevo", `принят (аккаунт ${String(account.body.email ?? "")})`);
    } else if (account.status === 401 && /ip/i.test(String(account.body.message ?? ""))) {
      add(false, "Ключ Brevo", "Brevo блокирует запросы с серверов Vercel: выключите «Authorized IPs» в Brevo → Security → Authorized IPs");
    } else if (account.status === 0) {
      add(false, "Ключ Brevo", `не удалось связаться с Brevo: ${String(account.body.message ?? "")}`);
    } else {
      add(false, "Ключ Brevo", `отклонён (HTTP ${account.status}): ${String(account.body.message ?? "")}`);
    }

    if (account.status === 200 && listId > 0) {
      const list = await brevo(`/contacts/lists/${listId}`, apiKey);
      add(
        list.status === 200,
        "Список",
        list.status === 200 ? `«${String(list.body.name)}», подписчиков: ${String(list.body.uniqueSubscribers ?? list.body.totalSubscribers ?? "?")}` : `список #${listId} не найден в Brevo`,
      );
    }

    if (account.status === 200 && templateId > 0) {
      const t = await brevo(`/smtp/templates/${templateId}`, apiKey);
      if (t.status !== 200) {
        add(false, "Шаблон подтверждения", `шаблон #${templateId} не найден в Brevo`);
      } else {
        const html = String(t.body.htmlContent ?? "");
        const tag = String(t.body.tag ?? "");
        const sender = (t.body.sender ?? {}) as { email?: string };
        add(t.body.isActive === true, "Шаблон: активен", t.body.isActive === true ? "да" : "нет — активируйте шаблон в Brevo");
        add(/optin/i.test(tag), "Шаблон: тег optin", /optin/i.test(tag) ? "есть" : "нет — Brevo требует тег «optin» у шаблона двойного подтверждения");
        add(html.includes("doubleoptin"), "Шаблон: ссылка подтверждения", html.includes("doubleoptin") ? "есть {{ doubleoptin }}" : "нет ссылки {{ doubleoptin }} в письме");
        add(!!sender.email, "Шаблон: отправитель", sender.email ? sender.email : "не указан отправитель");
      }
    }
  }

  const allOk = checks.every((c) => c.ok);
  return Response.json(
    { ok: allOk, summary: allOk ? "Всё настроено — подписка должна работать." : "Есть проблемы — см. пункты с ok:false.", checks },
    { headers: { "Cache-Control": "no-store" } },
  );
}
