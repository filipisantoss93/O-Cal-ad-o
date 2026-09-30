"use client";

import { useLayoutEffect, useSyncExternalStore, type ChangeEvent } from "react";

type ThemeChoice = "system" | "light" | "dark";

const storageKey = "ocalcadao-theme";
const themeChangeEvent = "ocalcadao-theme-change";

function readTheme(): ThemeChoice {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Automatic system preference remains active when storage is unavailable.
  }
  return "system";
}

function subscribeToTheme(onChange: () => void) {
  window.addEventListener(themeChangeEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(themeChangeEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function applyTheme(theme: ThemeChoice) {
  const root = document.documentElement;

  try {
    if (theme === "system") {
      root.removeAttribute("data-theme");
      window.localStorage.removeItem(storageKey);
    } else {
      root.dataset.theme = theme;
      window.localStorage.setItem(storageKey, theme);
    }
  } catch {
    if (theme === "system") root.removeAttribute("data-theme");
    else root.dataset.theme = theme;
  }

  window.dispatchEvent(new Event(themeChangeEvent));
}

export function ThemeSelect() {
  useLayoutEffect(() => {
    const savedTheme = readTheme();
    if (savedTheme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.dataset.theme = savedTheme;
    }
  }, []);

  const theme = useSyncExternalStore(
    subscribeToTheme,
    readTheme,
    () => "system" as ThemeChoice,
  );

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    applyTheme(event.target.value as ThemeChoice);
  }

  return (
    <label className="inline-flex shrink-0 items-center">
      <span className="sr-only">Tema de cores</span>
      <select
        aria-label="Tema de cores"
        title="Tema de cores"
        value={theme}
        onChange={handleChange}
        className="h-10 w-[82px] rounded-xl border border-line bg-surface px-2 text-xs font-extrabold text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <option value="system">Auto</option>
        <option value="light">Claro</option>
        <option value="dark">Escuro</option>
      </select>
    </label>
  );
}
