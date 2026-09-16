"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { BusinessSharePayload } from "@/app/painel/loja/actions";
import { FloatingNotice } from "@/components/floating-notice";
import {
  DownloadIcon,
  InstagramIcon,
  SparklesIcon,
  WhatsAppIcon,
  XIcon,
} from "@/components/icons";

type Feedback = {
  tone: "success" | "error";
  message: string;
} | null;

function safeFilename(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return normalized || "minha-loja";
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function BusinessShareDialog({
  share,
}: {
  share: BusinessSharePayload;
}) {
  const [open, setOpen] = useState(true);
  const [working, setWorking] = useState<"instagram" | "download" | null>(
    null,
  );
  const [feedback, setFeedback] = useState<Feedback>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const imageUrl = `/api/cartao-loja/${encodeURIComponent(share.slug)}`;
  const storeUrl = `https://ocalcadao.com.br/loja/${encodeURIComponent(share.slug)}`;
  const shareText = `Agora você também encontra ${share.businessName} no O Calçadão! Conheça a vitrine: ${storeUrl}`;
  const filename = `${safeFilename(share.businessName)}-no-o-calcadao.png`;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  async function loadCard() {
    const response = await fetch(imageUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Não foi possível gerar a imagem agora.");
    }
    const blob = await response.blob();
    return new File([blob], filename, { type: "image/png" });
  }

  async function shareOnInstagram() {
    if (working) return;
    setWorking("instagram");
    setFeedback(null);
    try {
      const file = await loadCard();
      const shareData = {
        files: [file],
        title: `${share.businessName} no O Calçadão`,
        text: `Agora você também encontra ${share.businessName} no O Calçadão.`,
      };

      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        saveBlob(file, filename);
        setFeedback({
          tone: "success",
          message:
            "Imagem baixada. Abra o Instagram e publique no feed ou nos stories.",
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível preparar o compartilhamento.",
      });
    } finally {
      setWorking(null);
    }
  }

  function shareOnWhatsApp() {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  async function downloadCard() {
    if (working) return;
    setWorking("download");
    setFeedback(null);
    try {
      const file = await loadCard();
      saveBlob(file, filename);
      setFeedback({ tone: "success", message: "Imagem salva no dispositivo." });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível baixar a imagem.",
      });
    } finally {
      setWorking(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[180] flex items-end justify-center bg-ink/75 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="business-share-title"
        aria-describedby="business-share-description"
        className="relative grid max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl overflow-y-auto rounded-[1.75rem] bg-surface shadow-[0_28px_90px_rgba(0,0,0,0.38)] md:grid-cols-[minmax(280px,0.92fr)_minmax(320px,1.08fr)]"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-full border border-line bg-white/95 text-ink shadow-sm transition hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-label="Fechar convite de compartilhamento"
        >
          <XIcon className="size-5" />
        </button>

        <div className="bg-canvas p-4 pt-16 sm:p-7 sm:pt-7">
          <div className="mx-auto max-w-[26rem] overflow-hidden rounded-2xl border border-line bg-white shadow-md">
            <Image
              src={imageUrl}
              alt={`Imagem para divulgar ${share.businessName} no O Calçadão`}
              width={1080}
              height={1080}
              sizes="(max-width: 767px) calc(100vw - 3.5rem), 420px"
              className="aspect-square h-auto w-full object-cover"
              unoptimized
            />
          </div>
        </div>

        <div className="flex flex-col justify-center p-5 sm:p-8 md:p-10">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-positive-soft px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-positive">
            <SparklesIcon className="size-4" />
            Loja publicada
          </span>
          <h2
            id="business-share-title"
            className="mt-5 pr-10 text-3xl font-black tracking-[-0.04em] text-ink"
          >
            Sua loja está no O Calçadão
          </h2>
          <p
            id="business-share-description"
            className="mt-3 text-sm font-semibold leading-6 text-muted"
          >
            Divulgue a novidade para seus clientes. A imagem já foi criada com
            a identidade da plataforma e o nome da sua loja.
          </p>

          <div className="mt-7 grid gap-3">
            <button
              type="button"
              onClick={shareOnInstagram}
              disabled={working !== null}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#c13584] px-5 text-sm font-black text-white transition hover:bg-[#a52d70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c13584] focus-visible:ring-offset-2 disabled:opacity-60"
            >
              <InstagramIcon className="size-5" />
              {working === "instagram"
                ? "Preparando imagem..."
                : "Compartilhar no Instagram"}
            </button>
            <button
              type="button"
              onClick={shareOnWhatsApp}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-positive px-5 text-sm font-black text-white transition hover:bg-[#176645] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-positive focus-visible:ring-offset-2"
            >
              <WhatsAppIcon className="size-5" />
              Compartilhar no WhatsApp
            </button>
            <button
              type="button"
              onClick={downloadCard}
              disabled={working !== null}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-black text-ink transition hover:border-brand/35 hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60"
            >
              <DownloadIcon className="size-5" />
              {working === "download" ? "Baixando..." : "Baixar imagem"}
            </button>
          </div>

          <p className="mt-4 text-xs font-semibold leading-5 text-muted">
            No celular, o Instagram aparece na tela de compartilhamento. No
            WhatsApp, o link da sua vitrine acompanha a mensagem.
          </p>
          <Link
            href={`/loja/${share.slug}`}
            target="_blank"
            rel="noreferrer"
            className="mt-5 text-center text-sm font-black text-brand-dark underline underline-offset-4"
          >
            Ver minha vitrine publicada
          </Link>
        </div>
      </section>

      {feedback && (
        <FloatingNotice tone={feedback.tone}>{feedback.message}</FloatingNotice>
      )}
    </div>
  );
}
