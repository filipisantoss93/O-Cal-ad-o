"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LocateIcon, XIcon } from "@/components/icons";
import {
  detectCurrentCity,
  isLocationPermissionDeniedError,
  readLocationSelectionMode,
  saveSelectedCity,
  wasLocationPermissionDeniedThisSession,
  wasLocationRequestHandledThisSession,
} from "@/lib/location-client";
import {
  cityChangeEventName,
  locationPermissionDeniedEventName,
} from "@/lib/location";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type Platform = "ios" | "android" | "windows" | "other";
const installDismissedKey = "ocalcadao:install-dismissed-until";
const installDismissedSessionKey = "ocalcadao:install-dismissed";
const locationDismissedKey = "ocalcadao:location-dismissed";
const visitCountKey = "ocalcadao:visit-count";
const visitRecordedKey = "ocalcadao:visit-recorded-this-session";

function installedMode() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

function devicePlatform(): Platform {
  const agent = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(agent)) return "android";
  if (/Windows/.test(agent)) return "windows";
  return "other";
}

const manualInstallSteps: Record<Platform, string> = {
  ios: "No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.",
  android: "No menu do navegador, toque em Instalar aplicativo ou Adicionar à tela inicial.",
  windows: "No menu do Edge ou Chrome, escolha Instalar este site como aplicativo.",
  other: "Abra o menu do navegador e procure Instalar aplicativo.",
};

export function PwaExperience() {
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname?.startsWith("/admin/");
  const [installed, setInstalled] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [showInstall, setShowInstall] = useState(false);
  const [installEligible, setInstallEligible] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [locationError, setLocationError] = useState("");
  const installSuppressedRef = useRef(false);

  useEffect(() => {
    if (isAdmin) return;
    if ("serviceWorker" in navigator && window.isSecureContext) {
      // O worker existente não armazena páginas; o cadastro global habilita
      // a instalação também para quem nunca acessou o painel.
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }

    const media = window.matchMedia("(display-mode: standalone)");
    const updateDisplayMode = () => {
      const nextInstalled = installedMode();
      setInstalled(nextInstalled);
      if (nextInstalled) setShowInstall(false);
      else setShowLocation(false);
    };
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setShowInstall(false);
      setInstallEvent(null);
    };
    const initializationTimer = window.setTimeout(() => {
      setPlatform(devicePlatform());
      updateDisplayMode();
      setInitialized(true);
    }, 0);
    media.addEventListener("change", updateDisplayMode);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(initializationTimer);
      media.removeEventListener("change", updateDisplayMode);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    try {
      const existing = Number(window.localStorage.getItem(visitCountKey)) || 0;
      const alreadyRecorded = window.sessionStorage.getItem(visitRecordedKey) === "1";
      const count = alreadyRecorded ? existing : Math.min(existing + 1, 2);
      if (!alreadyRecorded) {
        window.sessionStorage.setItem(visitRecordedKey, "1");
        window.localStorage.setItem(visitCountKey, String(count));
      }
      setInstallEligible(count >= 2);
    } catch {
      // Sem armazenamento, a instalação só é sugerida após uma navegação.
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin || !initialized || installed || installSuppressedRef.current) return;
    // No primeiro acesso, permita que a pessoa explore antes da sugestão.
    if (!installEligible && pathname === "/") return;
    let dismissedUntil = 0;
    let dismissedThisSession = false;
    try {
      dismissedUntil = Number(window.localStorage.getItem(installDismissedKey)) || 0;
    } catch {}
    try {
      dismissedThisSession =
        window.sessionStorage.getItem(installDismissedSessionKey) === "1";
    } catch {}
    if (dismissedThisSession || Date.now() < dismissedUntil) {
      installSuppressedRef.current = true;
      return;
    }
    const timer = window.setTimeout(() => setShowInstall(true), 2500);
    return () => window.clearTimeout(timer);
  }, [initialized, installed, isAdmin, installEligible, pathname]);

  useEffect(() => {
    if (isAdmin || !initialized || !installed) return;
    let cancelled = false;
    let status: PermissionStatus | undefined;
    const locationNoticeWasHandled = () => {
      try {
        if (window.sessionStorage.getItem(locationDismissedKey)) return true;
      } catch {}
      return (
        readLocationSelectionMode() === "manual" ||
        wasLocationRequestHandledThisSession() ||
        wasLocationPermissionDeniedThisSession()
      );
    };
    const updatePermission = () => {
      if (!cancelled && status) {
        setShowLocation(
          status.state !== "granted" && !locationNoticeWasHandled(),
        );
      }
    };
    const handleCityChange = () => {
      if (readLocationSelectionMode() === "manual") setShowLocation(false);
    };
    const handlePermissionDenied = () => setShowLocation(false);

    if (navigator.permissions?.query) {
      void navigator.permissions.query({ name: "geolocation" })
        .then((result) => {
          if (cancelled) return;
          status = result;
          updatePermission();
          status.addEventListener("change", updatePermission);
        })
        .catch(() => {
          if (!cancelled) {
            setShowLocation(
              readLocationSelectionMode() !== "auto" &&
                !locationNoticeWasHandled(),
            );
          }
        });
    } else {
      const timer = window.setTimeout(
        () =>
          setShowLocation(
            readLocationSelectionMode() !== "auto" &&
              !locationNoticeWasHandled(),
          ),
        0,
      );
      window.addEventListener(cityChangeEventName, handleCityChange);
      window.addEventListener(
        locationPermissionDeniedEventName,
        handlePermissionDenied,
      );
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener(cityChangeEventName, handleCityChange);
        window.removeEventListener(
          locationPermissionDeniedEventName,
          handlePermissionDenied,
        );
      };
    }
    window.addEventListener(cityChangeEventName, handleCityChange);
    window.addEventListener(
      locationPermissionDeniedEventName,
      handlePermissionDenied,
    );
    return () => {
      cancelled = true;
      status?.removeEventListener("change", updatePermission);
      window.removeEventListener(cityChangeEventName, handleCityChange);
      window.removeEventListener(
        locationPermissionDeniedEventName,
        handlePermissionDenied,
      );
    };
  }, [initialized, installed, isAdmin]);

  const dismissInstall = () => {
    installSuppressedRef.current = true;
    setShowInstall(false);
    setInstallEvent(null);
    try {
      window.localStorage.setItem(installDismissedKey, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    } catch {}
    try {
      window.sessionStorage.setItem(installDismissedSessionKey, "1");
    } catch {}
  };

  const dismissLocation = () => {
    setShowLocation(false);
    try {
      window.sessionStorage.setItem(locationDismissedKey, "1");
    } catch {}
  };

  const requestInstall = async () => {
    if (!installEvent) return;
    setInstallEvent(null);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "dismissed") dismissInstall();
      else setShowInstall(false);
    } catch {
      // O menu do navegador continua disponível como alternativa.
    }
  };

  const requestLocation = async () => {
    setDetecting(true);
    setLocationError("");
    try {
      const city = await detectCurrentCity();
      saveSelectedCity(city, { latitude: city.latitude, longitude: city.longitude });
      setShowLocation(false);
      router.refresh();
    } catch (reason) {
      if (isLocationPermissionDeniedError(reason)) {
        dismissLocation();
      } else {
        setLocationError(reason instanceof Error ? reason.message : "Não foi possível obter sua localização.");
      }
    } finally {
      setDetecting(false);
    }
  };

  if (isAdmin || (!showInstall && !showLocation)) return null;

  return (
    <aside
      aria-label={installed ? "Localização do aplicativo" : "Instalação do aplicativo"}
      className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[90] mx-auto max-w-sm rounded-2xl border border-line bg-surface p-5 text-ink shadow-2xl lg:bottom-6"
    >
      <button
        type="button"
        onClick={installed ? dismissLocation : dismissInstall}
        aria-label="Fechar aviso"
        className="absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-full text-muted hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <XIcon className="size-4" />
      </button>
      {installed ? (
        <>
          <h2 className="pr-9 text-base font-black">Ative sua localização</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Permita o acesso para encontrar comércios e ofertas da sua cidade. Você também pode escolher a cidade manualmente.
          </p>
          <button
            type="button"
            onClick={() => void requestLocation()}
            disabled={detecting}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-dark px-4 text-sm font-bold text-white hover:bg-ink disabled:opacity-60"
          >
            <LocateIcon className="size-4" />
            {detecting ? "Localizando…" : "Ativar localização"}
          </button>
          {locationError && <p role="alert" className="mt-3 text-xs leading-5 text-brand-dark">{locationError}</p>}
        </>
      ) : (
        <>
          <h2 className="pr-9 text-base font-black">Instale O Calçadão</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Acesse o catálogo direto da tela inicial, como um aplicativo.
          </p>
          {installEvent ? (
            <button
              type="button"
              onClick={() => void requestInstall()}
              className="mt-4 min-h-11 w-full rounded-xl bg-brand-dark px-4 text-sm font-bold text-white hover:bg-ink"
            >
              Instalar aplicativo
            </button>
          ) : (
            <p className="mt-3 rounded-xl bg-canvas p-3 text-sm leading-6 text-ink">
              {manualInstallSteps[platform]}
            </p>
          )}
        </>
      )}
    </aside>
  );
}
