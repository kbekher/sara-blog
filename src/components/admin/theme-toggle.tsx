"use client";
/**
 * Cycles the theme preference dark → light → system (same localStorage key "theme" as the public site,
 * see src/components/theme-script.tsx). Reads the preference after mount to avoid hydration mismatches.
 */
import { useSyncExternalStore } from "react";
import { Moon, Sun, MonitorSmartphone } from "lucide-react";

type Pref = "dark" | "light" | "system";
const ORDER: Pref[] = ["dark", "light", "system"];
const LABELS: Record<Pref, string> = { dark: "Тёмная тема", light: "Светлая тема", system: "Как в системе" };

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function read(): Pref {
  try {
    const v = localStorage.getItem("theme");
    return v === "dark" || v === "light" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(pref: Pref) {
  try {
    localStorage.setItem("theme", pref);
  } catch {
    /* private mode — still apply for this page */
  }
  const resolved =
    pref === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : pref;
  document.documentElement.dataset.theme = resolved;
  listeners.forEach((l) => l());
}

export function ThemeToggle() {
  const pref = useSyncExternalStore<Pref | null>(subscribe, read, () => null);
  const current = pref ?? "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = current === "dark" ? Moon : current === "light" ? Sun : MonitorSmartphone;
  return (
    <button
      type="button"
      className="admin-icon-btn"
      onClick={() => apply(next)}
      aria-label={`Тема: ${LABELS[current]}. Переключить: ${LABELS[next]}`}
      title={LABELS[current]}
    >
      <Icon className="size-[18px]" aria-hidden />
    </button>
  );
}
