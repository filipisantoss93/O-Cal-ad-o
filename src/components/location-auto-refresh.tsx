"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  detectCurrentCity,
  readCurrentCoordinates,
  readLocationSelectionMode,
  readSelectedCity,
  saveSelectedCity,
  wasLocationPermissionDeniedThisSession,
  wasLocationRequestHandledThisSession,
} from "@/lib/location-client";

const minimumBackgroundTimeMs = 60_000;

export function LocationAutoRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname?.startsWith("/admin/");
  const refreshingRef = useRef(false);
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (isAdmin) return;
    const refreshLocation = async (allowInitialRequest = false) => {
      const selectionMode = readLocationSelectionMode();
      const previousCity = readSelectedCity();
      const currentCoordinates = readCurrentCoordinates();
      const requestHandled = wasLocationRequestHandledThisSession();
      // No PWA instalado, a primeira permissão é pedida pelo botão visível.
      // No navegador, a tentativa inicial acontece uma única vez por sessão.
      const installed =
        window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
      const shouldRequestInitialLocation =
        allowInitialRequest &&
        !installed &&
        selectionMode === null &&
        !previousCity &&
        !requestHandled;
      const shouldRefreshAutomaticLocation =
        selectionMode === "auto" &&
        !wasLocationPermissionDeniedThisSession() &&
        (Boolean(currentCoordinates) || !requestHandled);

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
  }, [router, isAdmin]);

  return null;
}
