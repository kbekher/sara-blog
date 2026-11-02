"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeAdminRedirect } from "@/lib/auth/config";
import { isAuthConfigured, verifyCredentials } from "@/lib/auth/password";
import { getClientIp } from "@/lib/auth/request";
import { createSession } from "@/lib/auth/session";
import { clearLoginFailures, isLoginThrottled, recordLoginFailure } from "@/lib/auth/throttle";

export type LoginState = {
  error?: string;
  /** echoed back so the field isn't cleared after a failed attempt */
  email?: string;
};

const schema = z.object({
  email: z.string().trim().max(254),
  password: z.string().min(1).max(256),
  next: z.string().max(2048).optional(),
});

const GENERIC_ERROR = "Неверный email или пароль.";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Small random delay on failures blunts automated guessing and timing analysis. */
function failureDelay() {
  return sleep(400 + Math.floor(Math.random() * 400));
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
    next: formData.get("next") ?? undefined,
  });
  const email = typeof formData.get("email") === "string" ? String(formData.get("email")).slice(0, 254) : "";
  if (!parsed.success || !z.email().safeParse(parsed.data.email).success) {
    await failureDelay();
    return { error: "Введите email и пароль.", email };
  }

  if (!isAuthConfigured()) {
    console.error("[auth] Login attempted but ADMIN_EMAIL / ADMIN_PASSWORD_HASH / SESSION_SECRET are not configured.");
    return { error: "Вход не настроен на сервере. Проверьте переменные окружения (см. README).", email };
  }

  const ip = getClientIp(await headers());

  try {
    if (await isLoginThrottled(ip)) {
      await sleep(1500);
      return { error: "Слишком много неудачных попыток. Подождите 15 минут и попробуйте снова.", email };
    }
  } catch (error) {
    // Fail closed: without the throttle table we can't protect against brute force.
    console.error("[auth] Login throttle check failed", error);
    return { error: "Сервис временно недоступен. Попробуйте позже.", email };
  }

  const ok = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!ok) {
    await recordLoginFailure(ip).catch((error) => console.error("[auth] Could not record failed login", error));
    await failureDelay();
    return { error: GENERIC_ERROR, email };
  }

  await clearLoginFailures(ip).catch((error) => console.error("[auth] Could not clear login attempts", error));
  await createSession(parsed.data.email.trim().toLowerCase());
  redirect(safeAdminRedirect(parsed.data.next));
}
