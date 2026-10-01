"use client";

import { useEffect, useRef, useState } from "react";
import { transferAdminBusinessOwnerAction } from "@/app/admin/cadastros/actions";

type AccountSummary = {
  id: string;
  name: string | null;
  email: string | null;
  usedBusinesses: number;
  allowedBusinesses: number;
};

type Props = {
  business: {
    id: number;
    name: string;
  };
  currentOwner: AccountSummary;
  newOwner: AccountSummary;
};

function accountLabel(account: AccountSummary) {
  return account.name || account.email || account.id;
}

function capacityLabel(allowed: number) {
  if (allowed === 1) return "Free";
  if (allowed >= 4) return "Pro / capacidade ampliada";
  return "Capacidade personalizada";
}

export function BusinessOwnerTransferForm({
  business,
  currentOwner,
  newOwner,
}: Props) {
  const [reason, setReason] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const trimmedReason = reason.trim();
  const canPreview = trimmedReason.length >= 5;
  const currentAfter = Math.max(0, currentOwner.usedBusinesses - 1);
  const newAfter = newOwner.usedBusinesses + 1;
  const newRemaining = Math.max(0, newOwner.allowedBusinesses - newAfter);

  useEffect(() => {
    if (!previewOpen) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPreviewOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [previewOpen]);

  function openPreview() {
    if (!canPreview) return;
    setConfirmed(false);
    setPreviewOpen(true);
  }

  return (
    <>
      <div className="mt-3 space-y-3">
        <label className="block min-w-0 text-sm font-bold text-ink">
          Motivo obrigatório
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={5}
            maxLength={1000}
            required
            className="mt-1.5 min-h-24 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
            placeholder="Ex.: venda da empresa, troca de responsável ou correção de vínculo."
          />
        </label>
        <button
          type="button"
          onClick={openPreview}
          disabled={!canPreview}
          className="min-h-11 rounded-xl bg-brand px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Revisar transferência
        </button>
        {!canPreview && reason.length > 0 && (
          <p className="text-xs font-semibold text-brand-dark">
            Informe pelo menos 5 caracteres no motivo para abrir a prévia.
          </p>
        )}
      </div>

      {previewOpen && (
        <div
          className="fixed inset-0 z-[190] flex items-end justify-center bg-ink/75 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="transfer-preview-title"
            aria-describedby="transfer-preview-description"
            className="max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-[1.75rem] bg-surface p-5 shadow-[0_28px_90px_rgba(0,0,0,0.38)] sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
                  Etapa final
                </p>
                <h2 id="transfer-preview-title" className="mt-2 text-2xl font-black tracking-tight text-ink">
                  Prévia da transferência
                </h2>
                <p id="transfer-preview-description" className="mt-2 text-sm leading-6 text-muted">
                  Revise os dados abaixo. A transferência só acontece depois da confirmação final.
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-white text-xl font-bold text-ink"
                aria-label="Fechar prévia"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <section className="rounded-2xl border border-line bg-canvas p-4">
                <p className="text-xs font-black uppercase tracking-wider text-muted">Empresa</p>
                <p className="mt-2 text-lg font-black text-ink">{business.name}</p>
                <p className="mt-1 text-xs text-muted">ID #{business.id}</p>
              </section>

              <div className="grid gap-4 sm:grid-cols-2">
                <section className="rounded-2xl border border-line bg-canvas p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-muted">Responsável atual</p>
                  <p className="mt-2 text-sm font-black text-ink">{accountLabel(currentOwner)}</p>
                  <p className="mt-1 break-all text-xs text-muted">{currentOwner.email || currentOwner.id}</p>
                  <div className="mt-4 rounded-xl bg-surface p-3">
                    <p className="text-xs font-bold text-muted">{capacityLabel(currentOwner.allowedBusinesses)}</p>
                    <p className="mt-1 text-sm font-black text-ink">
                      {currentOwner.usedBusinesses}/{currentOwner.allowedBusinesses} → {currentAfter}/{currentOwner.allowedBusinesses} lojas
                    </p>
                    <p className="mt-1 text-xs text-positive">Libera 1 vaga na conta atual.</p>
                  </div>
                </section>

                <section className="rounded-2xl border border-brand/25 bg-canvas p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-brand-dark">Novo responsável</p>
                  <p className="mt-2 text-sm font-black text-ink">{accountLabel(newOwner)}</p>
                  <p className="mt-1 break-all text-xs text-muted">{newOwner.email || newOwner.id}</p>
                  <div className="mt-4 rounded-xl bg-surface p-3">
                    <p className="text-xs font-bold text-muted">{capacityLabel(newOwner.allowedBusinesses)}</p>
                    <p className="mt-1 text-sm font-black text-ink">
                      {newOwner.usedBusinesses}/{newOwner.allowedBusinesses} → {newAfter}/{newOwner.allowedBusinesses} lojas
                    </p>
                    <p className={"mt-1 text-xs font-bold " + (newRemaining === 0 ? "text-brand-dark" : "text-positive")}>
                      {newRemaining === 0
                        ? "A conta ficará no limite do plano."
                        : `Restarão ${newRemaining} vaga${newRemaining === 1 ? "" : "s"}.`}
                    </p>
                  </div>
                </section>
              </div>

              <section className="rounded-2xl border border-line bg-canvas p-4">
                <p className="text-xs font-black uppercase tracking-wider text-muted">Motivo informado</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{trimmedReason}</p>
              </section>

              <section className="rounded-2xl border border-brand/20 bg-brand/5 p-4">
                <p className="text-sm font-black text-ink">Impacto da confirmação</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-muted">
                  O responsável atual perde o acesso a esta empresa, o novo responsável passa a administrá-la imediatamente,
                  reivindicações relacionadas são reconciliadas e a operação fica registrada no histórico de auditoria.
                </p>
              </section>
            </div>

            <form action={transferAdminBusinessOwnerAction} className="mt-6">
              <input type="hidden" name="business_id" value={business.id} />
              <input type="hidden" name="new_owner_id" value={newOwner.id} />
              <input type="hidden" name="reason" value={trimmedReason} />
              <label className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-4 text-sm font-semibold text-ink">
                <input
                  type="checkbox"
                  name="confirm_transfer"
                  value="1"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  required
                  className="mt-1 size-4 shrink-0"
                />
                <span>
                  Confirmo que revisei a empresa, o responsável atual, o novo responsável, o impacto no plano e o motivo desta transferência.
                </span>
              </label>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-black text-ink"
                >
                  Voltar e editar
                </button>
                <button
                  type="submit"
                  disabled={!confirmed}
                  className="min-h-11 rounded-xl bg-brand px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Confirmar transferência final
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
