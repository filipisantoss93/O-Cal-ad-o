"use client";

import { useEffect, useState } from "react";
import { subscribeAdminPush, unsubscribeAdminPush } from "@/app/painel/admin/notificacoes/actions";

function decodeBase64Url(input: string) {
  const raw = atob(input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - input.length % 4) % 4));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export function AdminPushManager({ publicKey }: { publicKey: string | null }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const available = !!publicKey && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!available) {
      queueMicrotask(() => setSupported(false));
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        setSupported(true);
        setEnabled(!!subscription && Notification.permission === "granted");
      })
      .catch(() => setSupported(false));
  }, [publicKey]);

  async function enable() {
    if (!publicKey || busy) return;
    setBusy(true);
    setMessage("");
    try {
      // The permission prompt must originate from this button tap, including on iOS.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Permissão de notificações não concedida.");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription() ??
        await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeBase64Url(publicKey).buffer as ArrayBuffer });
      const result = await subscribeAdminPush(subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
      if (!result.ok) throw new Error(result.message);
      setEnabled(true);
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível ativar as notificações.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const result = await unsubscribeAdminPush(subscription.endpoint);
        if (!result.ok) throw new Error("Não foi possível desativar as notificações.");
        await subscription.unsubscribe();
      }
      setEnabled(false);
      setMessage("Notificações desativadas neste dispositivo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao desativar notificações.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
    <h2 className="text-lg font-black text-ink">Notificações no dispositivo</h2>
    <p className="mt-2 text-sm leading-6 text-muted">Receba avisos de cadastros, suporte e denúncias mesmo quando o aplicativo estiver fechado.</p>
    {supported === false ? <p className="mt-3 text-sm font-semibold text-muted">Para receber avisos no iPhone, abra este site pelo ícone adicionado à Tela de Início. Permita as notificações nas configurações do aparelho.</p> : null}
    {supported && <button type="button" disabled={busy} onClick={enabled ? disable : enable} className="mt-4 min-h-11 rounded-xl bg-ink px-4 text-sm font-black text-white disabled:opacity-50">
      {busy ? "Aguarde..." : enabled ? "Desativar neste dispositivo" : "Ativar notificações"}
    </button>}
    {message && <p role="status" className="mt-3 text-sm font-semibold text-ink">{message}</p>}
  </section>;
}
