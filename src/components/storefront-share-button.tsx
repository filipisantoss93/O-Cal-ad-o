"use client";

import { useState } from "react";
import { FloatingNotice } from "@/components/floating-notice";
import { ShareIcon } from "@/components/icons";

type StorefrontShareButtonProps = {
  businessName: string;
  slug: string;
};

type Feedback = {
  tone: "success" | "error";
  message: string;
} | null;

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Não foi possível copiar o link.");
}

export function StorefrontShareButton({
  businessName,
  slug,
}: StorefrontShareButtonProps) {
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function shareStore() {
    setFeedback(null);
    const url = new URL(`/loja/${encodeURIComponent(slug)}`, window.location.origin).toString();
    const shareData = {
      title: `${businessName} está no O Calçadão`,
      text: `Conheça a vitrine de ${businessName} no O Calçadão.`,
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await copyText(url);
      setFeedback({
        tone: "success",
        message: "Link da loja copiado. Agora é só compartilhar.",
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFeedback({
        tone: "error",
        message: "Não foi possível compartilhar a loja agora.",
      });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={shareStore}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/35 bg-ink/35 px-3 text-sm font-black text-white shadow-sm backdrop-blur-md transition hover:border-white/60 hover:bg-ink/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:px-4"
        aria-label={`Compartilhar a loja ${businessName}`}
      >
        <ShareIcon className="size-5 shrink-0" />
        <span className="hidden sm:inline">Compartilhar loja</span>
        <span className="sm:hidden">Compartilhar</span>
      </button>
      {feedback && (
        <FloatingNotice tone={feedback.tone}>{feedback.message}</FloatingNotice>
      )}
    </>
  );
}
