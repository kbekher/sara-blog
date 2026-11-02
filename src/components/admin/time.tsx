"use client";
/**
 * Hydration-safe time helpers. Server and client render different time zones, so anything that depends on
 * "now" or on the viewer's time zone renders only on the client (useSyncExternalStore with a null server snapshot).
 */
import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** true on the client after hydration, false during SSR. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

let now = 0;
const nowListeners = new Set<() => void>();
let nowTimer: ReturnType<typeof setInterval> | null = null;
function subscribeNow(cb: () => void) {
  nowListeners.add(cb);
  if (!nowTimer) {
    now = Date.now();
    nowTimer = setInterval(() => {
      now = Date.now();
      nowListeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    nowListeners.delete(cb);
    if (nowListeners.size === 0 && nowTimer) {
      clearInterval(nowTimer);
      nowTimer = null;
    }
  };
}

/** Current time (ms), refreshed every 30 s on the client; 0 during SSR. */
export function useNow(): number {
  return useSyncExternalStore(
    subscribeNow,
    () => now || (now = Date.now()),
    () => 0,
  );
}

export function formatDateTime(iso: string | Date, opts: Intl.DateTimeFormatOptions = {}): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...opts,
  }).format(date);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(date);
}

/** Local date/time text, rendered on the client only (placeholder during SSR). */
export function LocalTime({ iso, options, fallback = "…" }: { iso: string; options?: Intl.DateTimeFormatOptions; fallback?: string }) {
  const client = useIsClient();
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {client ? formatDateTime(iso, options) : fallback}
    </time>
  );
}

/** "Europe/Moscow (UTC+3)" for the viewer's time zone. */
export function timeZoneLabel(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -new Date().getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "−";
    const h = Math.floor(Math.abs(offset) / 60);
    const m = Math.abs(offset) % 60;
    return `${tz} (UTC${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""})`;
  } catch {
    return "местное время";
  }
}
