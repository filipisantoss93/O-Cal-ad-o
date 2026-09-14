"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LocateIcon, XIcon } from "@/components/icons";
import { detectCurrentCity, readLocationSelectionMode, saveSelectedCity } from "@/lib/location-client";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type Platform = "ios" | "android" | "windows" | "other";
const installDismissedKey = "ocalcadao:install-dismissed-until";
const locationDismissedKey = "ocalcadao:location-dismissed";

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
  const [installed, setInstalled] = useState(true);
  const [platform, setPlatform] = useState<Platform>("other");
  const [showInstall, setShowInstall] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      // O worker existente não armazena páginas; o cadastro global habilita
      // a instalação também para quem nunca acessou o painel.
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }

    const media = window.matchMedia("(display-mode: standalone)");
    const updateDisplayMode = () => setInstalled(installedMode());
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setShowInstall(false);
      setInstallEvent(null);
    };
    setPlatform(devicePlatform());
    updateDisplayMode();
    media.addEventListener("change", updateDisplayMode);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      media.removeEventListener("change", updateDisplayMode);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (installed) {
      setShowInstall(false);
      return;
    }
    let dismissedUntil = 0;
    try {
      dismissedUntil = Number(window.localStorage.getItem(installDismissedKey)) || 0;
    } catch {}
    if (Date.now() < dismissedUntil) return;
    const timer = window.setTimeout(() => setShowInstall(true), 2500);
    return () => window.clearTimeout(timer);
  }, [installed]);

  useEffect(() => {
    if (!installed) {
      setShowLocation(false);
      return;
    }
    try {
      if (window.sessionStorage.getItem(locationDismissedKey)) return;
    } catch {}
    let cancelled = false;
    let status: PermissionStatus | undefined;
    const updatePermission = () => {
      if (!cancelled && status) setShowLocation(status.state !== "granted");
    };

    if (navigator.permissions?.query) {
      void navigator.permissions.query({ name: "geolocation" })
        .then((result) => {
          if (cancelled) return;
          status = result;
          updatePermission();
          status.addEventListener("change", updatePermission);
        })
        .catch(() => {
          if (!cancelled) setShowLocation(readLocationSelectionMode() !== "auto");
        });
    } else {
      setShowLocation(readLocationSelectionMode() !== "auto");
    }
    return () => {
      cancelled = true;
      status?.removeEventListener("change", updatePermission);
    };
  }, [installed]);

  const dismissInstall = () => {
    setShowInstall(false);
    try {
      window.localStorage.setItem(installDismissedKey, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
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
      setLocationError(reason instanceof Error ? reason.message : "Não foi possível obter sua localização.");
    } finally {
      setDetecting(false);
    }
  };

  if (!showInstall && !showLocation) return null;

  return (
    <aside
      aria-label={installed ? "Localização do aplicativo" : "Instalação do aplicativo"}
      className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[90] mx-auto max-w-sm rounded-2xl border border-line bg-surface p-5 text-ink shadow-2xl lg:bottom-6"
    >
      <button
        type="button"
        onClick={installed ? dismissLocation : dismissInstall}
        aria-label="Fechar aviso"
        className="absolute right-3 top-3 grid size-9 place-items-center rounded-full text-muted hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-60"
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
              className="mt-4 min-h-11 w-full rounded-xl bg-brand px-4 text-sm font-bold text-white hover:bg-brand-dark"
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
