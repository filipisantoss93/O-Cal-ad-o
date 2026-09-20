"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

function installInstructions() {
  const agent = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1)) {
    return "No Safari, toque em Compartilhar → Adicionar à Tela de Início e confirme o nome Calçadão Admin.";
  }
  if (/Android/.test(agent)) {
    return "No Chrome, abra o menu ⋮ e selecione Instalar aplicativo ou Adicionar à tela inicial.";
  }
  return "No Chrome ou Edge, abra o menu do navegador e selecione Instalar este site como aplicativo.";
}

export function AdminPwaInstall() {
  const [ready, setReady] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [promptEvent, setPromptEvent] = useState<InstallEvent | null>(null);
  const [instructions, setInstructions] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    const updateStandalone = () => setStandalone(isStandalone());
    const onInstallAvailable = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallEvent);
    };
    const onInstalled = () => {
      setStandalone(true);
      setPromptEvent(null);
      setNotice("O aplicativo foi instalado. Abra-o pelo ícone Calçadão Admin.");
    };
    queueMicrotask(() => {
      if (!active) return;
      updateStandalone();
      setInstructions(installInstructions());
      setReady(true);
    });
    if ("serviceWorker" in navigator && window.isSecureContext) {
      // O worker sem cache de páginas mantém o push administrativo existente.
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        setNotice("Não foi possível registrar o serviço de notificações neste navegador.");
      });
    }
    window.addEventListener("beforeinstallprompt", onInstallAvailable);
    window.addEventListener("appinstalled", onInstalled);
    const media = window.matchMedia("(display-mode: standalone)");
    media.addEventListener("change", updateStandalone);
    return () => {
      active = false;
      window.removeEventListener("beforeinstallprompt", onInstallAvailable);
      window.removeEventListener("appinstalled", onInstalled);
      media.removeEventListener("change", updateStandalone);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;
    setPromptEvent(null);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") setNotice("Instalação aceita. Abra o aplicativo pelo novo ícone.");
      else setNotice("Instalação cancelada. Você pode tentar pelo menu do navegador.");
    } catch {
      setNotice("Use a opção Instalar aplicativo no menu do navegador.");
    }
  }

  return <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-7">
    <h2 className="text-xl font-black text-ink">Instalar o painel administrativo</h2>
    <p className="mt-2 text-sm leading-6 text-muted">
      Crie um atalho exclusivo chamado Calçadão Admin, com ícone próprio. Ele abre diretamente no Dashboard,
      sem abrir o catálogo público. A conta administrativa continua protegida por login.
    </p>
    {ready && standalone ? (
      <div className="mt-4 space-y-3 rounded-2xl bg-positive-soft p-4 text-sm font-semibold text-ink">
        <p>Você está usando o modo aplicativo. Se abriu esta página dentro do aplicativo público,
          abra o endereço do painel no navegador para instalar um segundo ícone.</p>
        <Link href="/admin/dashboard" className="inline-flex min-h-10 items-center rounded-xl bg-ink px-4 font-black text-white">
          Abrir Dashboard
        </Link>
      </div>
    ) : (
      <div className="mt-4 space-y-3">
        {promptEvent && <button type="button" onClick={() => void install()}
          className="min-h-11 rounded-xl bg-brand px-5 text-sm font-black text-white hover:bg-brand-dark">
          Instalar Calçadão Admin
        </button>}
        <p className="rounded-xl bg-canvas p-4 text-sm leading-6 text-ink">
          {ready ? instructions : "Verificando a instalação disponível…"}
        </p>
        <p className="text-xs leading-5 text-muted">No iPhone, abra esta página no Safari antes de adicionar à Tela de Início.
          Se já tiver instalado o app público, instale este painel separadamente a partir do endereço /admin/instalar.</p>
      </div>
    )}
    {notice && <p role="status" className="mt-3 text-sm font-semibold text-ink">{notice}</p>}
    <div className="mt-5 border-t border-line pt-4">
      <p className="text-sm font-black text-ink">Notificações no aplicativo</p>
      <p className="mt-1 text-sm leading-6 text-muted">
        Depois de instalar, abra Notificações e toque em Ativar notificações para receber avisos de reivindicações,
        cadastros, suporte e denúncias. O aplicativo não salva o conteúdo das páginas administrativas para uso offline.
      </p>
      <Link href="/admin/notificacoes" className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-line px-4 text-sm font-bold text-ink">
        Configurar notificações
      </Link>
    </div>
  </section>;
}
