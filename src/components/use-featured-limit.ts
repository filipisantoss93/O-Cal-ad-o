"use client";

import { useSyncExternalStore } from "react";

const desktopQuery = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useFeaturedLimit() {
  const desktop = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(desktopQuery).matches,
    () => false,
  );
  return desktop ? 20 : 10;
}
