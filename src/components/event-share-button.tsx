"use client";

import { useState } from "react";
import { FloatingNotice } from "@/components/floating-notice";
import { ShareIcon } from "@/components/icons";

export function EventShareButton({ title, id }: { title: string; id: number }) {
  const [feedback, setFeedback] = useState<"ok" | "error" | null>(null);

  async function shareEvent() {
    setFeedback(null);
    const url = new URL("/eventos/" + id, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({
          title: title + " | O Calçadão",
          text: "Confira o evento " + title + " no O Calçadão.",
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setFeedback("ok");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFeedback("error");
    }
  }

  return (
    <>
      <button type="button" onClick={shareEvent}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-black text-ink transition hover:border-brand/40"
        aria-label={"Compartilhar evento " + title}>
        <ShareIcon className="size-4" /> Compartilhar
      </button>
      {feedback && <FloatingNotice tone={feedback === "ok" ? "success" : "error"}>
        {feedback === "ok" ? "Link do evento copiado para compartilhar." : "Não foi possível compartilhar o evento."}
      </FloatingNotice>}
    </>
  );
}
