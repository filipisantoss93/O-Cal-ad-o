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
    const refreshLocation = async (allowInitialRequest = false) => {
      const selectionMode = readLocationSelectionMode();
      const previousCity = readSelectedCity();
      const shouldRequestInitialLocation =
        allowInitialRequest && selectionMode === null && !previousCity;
      const shouldRefreshAutomaticLocation = selectionMode === "auto";

      if (
        refreshingRef.current ||
        (!shouldRequestInitialLocation && !shouldRefreshAutomaticLocation)
      ) {
        return;
      }

      refreshingRef.current = true;

      try {
        // No primeiro acesso, detectCurrentCity dispara a solicitação nativa de
        // permissão do navegador. Depois que o usuário permite, a localização
        // passa a ser atualizada automaticamente nas próximas visitas.
        const city = await detectCurrentCity();

        saveSelectedCity(city, {
          latitude: city.latitude,
          longitude: city.longitude,
        });

        if (previousCity?.id !== city.id || selectionMode !== "auto") {
          router.refresh();
        }
      } catch (reason) {
        // Se o usuário negar ou o GPS estiver indisponível, mantemos o site
        // navegável e não substituímos uma cidade escolhida manualmente.
        console.warn("[location] automatic refresh failed", reason);
      } finally {
        refreshingRef.current = false;
      }
    };

    // Visitantes novos recebem a solicitação de localização assim que entram
    // no site. Quem escolheu uma cidade manualmente continua com essa escolha.
    void refreshLocation(true);

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
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [router]);

  return null;
}
