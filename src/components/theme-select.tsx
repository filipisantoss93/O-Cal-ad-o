"use client";

import { useEffect, useState } from "react";

type ThemeChoice = "system" | "light" | "dark";

const storageKey = "ocalcadao-theme";

function applyTheme(theme: ThemeChoice) {
  const root = document.documentElement;

  if (theme === "system") {
    root.removeAttribute("data-theme");
    window.localStorage.removeItem(storageKey);
    return;
  }

  root.dataset.theme = theme;
  window.localStorage.setItem(storageKey, theme);
}

export function ThemeSelect() {
  const [theme, setTheme] = useState<ThemeChoice>("system");

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    }
  }, []);

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextTheme = event.target.value as ThemeChoice;
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <label className="sr-only" htmlFor="site-theme">
      Tema de cores
      <select
        id="site-theme"
        aria-label="Tema de cores"
        title="Tema de cores"
        value={theme}
        onChange={handleChange}
        className="absolute h-px w-px overflow-hidden opacity-0"
      >
        <option value="system">Automático</option>
        <option value="light">Claro</option>
        <option value="dark">Escuro</option>
      </select>
    </label>
  );
}
