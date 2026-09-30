"use client";

import { useEffect, useState, type ChangeEvent } from "react";

type ThemeChoice = "system" | "light" | "dark";

const storageKey = "ocalcadao-theme";

function applyTheme(theme: ThemeChoice) {
  const root = document.documentElement;

  try {
    if (theme === "system") {
      root.removeAttribute("data-theme");
      window.localStorage.removeItem(storageKey);
      return;
    }

    root.dataset.theme = theme;
    window.localStorage.setItem(storageKey, theme);
  } catch {
    // The selected theme still applies if browser storage is unavailable.
    if (theme === "system") root.removeAttribute("data-theme");
    else root.dataset.theme = theme;
  }
}

export function ThemeSelect() {
  const [theme, setTheme] = useState<ThemeChoice>("system");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === "light" || saved === "dark") {
        setTheme(saved);
      }
    } catch {
      // Automatic system preference remains active when storage is unavailable.
    }
  }, []);

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextTheme = event.target.value as ThemeChoice;
    setTheme(nextTheme);
    applyTheme(nextTheme);
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
