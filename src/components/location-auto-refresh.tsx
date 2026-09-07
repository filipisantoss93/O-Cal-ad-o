"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  detectCurrentCity,
  readLocationSelectionMode,
  readSelectedCity,
  saveSelectedCity,
} from "@/lib/location-client";

const minimumBackgroundTimeMs = 60_000;

export function LocationAutoRefresh() {
  const router = useRouter();
  const refreshingRef = useRef(false);
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refreshLocation = async () => {
      if (refreshingRef.current || readLocationSelectionMode() !== "auto") return;

      refreshingRef.current = true;
      const previousCity = readSelectedCity();

      try {
        const city = await detectCurrentCity();
        if (cancelled) return;

        saveSelectedCity(city, {
          latitude: city.latitude,
          longitude: city.longitude,
        });

        if (previousCity?.id !== city.id) {
          router.refresh();
        }
      } catch (reason) {
        // A atualização automática não deve apagar a última posição válida nem
        // interromper a navegação caso o GPS esteja temporariamente indisponível.
        console.warn("[location] automatic refresh failed", reason);
      } finally {
        refreshingRef.current = false;
      }
    };

    void refreshLocation();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }

      if (document.visibilityState === "visible") {
        const hiddenAt = hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (
          hiddenAt !== null &&
          Date.now() - hiddenAt >= minimumBackgroundTimeMs
        ) {
          void refreshLocation();
        }
      }
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void refreshLocation();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [router]);

  return null;
}
