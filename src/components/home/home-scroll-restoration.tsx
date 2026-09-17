"use client";

import { useEffect } from "react";

const positionKey = "ocalcadao_home_scroll_y";
const restoreKey = "ocalcadao_home_restore_scroll";

export function HomeScrollRestoration() {
  useEffect(() => {
    const restore = window.sessionStorage.getItem(restoreKey) === "1";
    const storedPosition = Number(window.sessionStorage.getItem(positionKey));

    if (restore && Number.isFinite(storedPosition) && storedPosition > 0) {
      window.sessionStorage.removeItem(restoreKey);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: storedPosition, behavior: "auto" });
        });
      });
    }

    const rememberPosition = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === "/") return;

      window.sessionStorage.setItem(positionKey, String(window.scrollY));
      window.sessionStorage.setItem(restoreKey, "1");
    };

    document.addEventListener("click", rememberPosition, true);
    return () => document.removeEventListener("click", rememberPosition, true);
  }, []);

  return null;
}
