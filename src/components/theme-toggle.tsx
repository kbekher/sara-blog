"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import clsx from "clsx";

export type ThemePreference = "dark" | "light" | "system";

const STORAGE_KEY = "theme";
const ORDER: ThemePreference[] = ["dark", "light", "system"];
const CHANGE_EVENT = "sara:theme-change";
const lightQuery = () => window.matchMedia("(prefers-color-scheme: light)");

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "dark" || value === "light" || value === "system" ? value : "system";
  } catch {
    return "system";
  }
}

/** Mirrors theme-script.tsx: "system" follows the OS, everything else is explicit. */
function applyTheme(preference: ThemePreference) {
  const resolved = preference === "system" ? (lightQuery().matches ? "light" : "dark") : preference;
  document.documentElement.dataset.theme = resolved;
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      applyTheme(readPreference());
      onChange();
    }
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage); // other tabs
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export type ThemeToggleLabels = {
  label: string;
  dark: string;
  light: string;
  system: string;
  /** "Theme: {theme}. Click to switch" */
  current: string;
};

/**
 * Cycles dark → light → system. Persists to localStorage "theme" and updates <html data-theme> immediately
 * (color transitions come from `html.theme-ready` in globals.css). While on "system", follows OS changes live.
 */
export function ThemeToggle({ labels, className }: { labels: ThemeToggleLabels; className?: string }) {
  // Server snapshot is null: the stored preference is unknown until hydration, so render a neutral state.
  const preference = useSyncExternalStore<ThemePreference | null>(subscribe, readPreference, () => null);

  useEffect(() => {
    if (preference !== "system") return;
    const media = lightQuery();
    const onOsChange = () => applyTheme("system");
    media.addEventListener("change", onOsChange);
    return () => media.removeEventListener("change", onOsChange);
  }, [preference]);

  function cycle() {
    const current = preference ?? readPreference();
    const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable (private mode); the theme still applies for this page view.
    }
    applyTheme(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  const Icon = preference === "light" ? Sun : preference === "system" ? Monitor : Moon;
  const name = preference ? labels[preference] : labels.label;
  const ariaLabel = preference ? labels.current.replace("{theme}", name.toLocaleLowerCase()) : labels.label;

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={ariaLabel}
      title={preference ? name : labels.label}
      className={clsx(
        "inline-flex size-9 items-center justify-center rounded-full text-fg-muted transition-colors duration-300 ease-apple hover:bg-surface-hover hover:text-fg-strong",
        className,
      )}
    >
      <Icon
        key={preference ?? "unknown"}
        aria-hidden
        className={clsx("size-[18px] motion-safe:animate-[theme-icon_400ms_var(--ease-out-expo)]", !preference && "opacity-0")}
        strokeWidth={1.75}
      />
    </button>
  );
}
