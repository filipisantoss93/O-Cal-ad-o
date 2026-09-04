"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef } from "react";
import {
  deletePromotionAction,
  savePromotionAction,
  togglePromotionAction,
} from "@/app/painel/promocoes/actions";
import {
  EditIcon,
  ImageIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import {
  type ActionState,
  initialActionState,
} from "@/lib/action-state";

export type PromotionFormValue = {
  id: number;
  title: string;
  description: string;
  originalPrice: number | null;
  offerPrice: number;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
  imageUrl: string | null;
};

type PromotionManagerProps = {
  promotions: PromotionFormValue[];
  today: string;
  suggestedEndDate: string;
};

const inputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink outline-none transition placeholder:text-muted/65 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-canvas";
const labelClass = "block text-sm font-extrabold text-ink";

function Feedback({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <div
      role={state.status === "success" ? "status" : "alert"}
      className={
        state.status === "success"
          ? "rounded-xl border border-positive/20 bg-positive-soft p-4 text-sm font-bold leading-6 text-positive"
          : "rounded-xl border border-brand/20 bg-brand/8 p-4 text-sm font-bold leading-6 text-brand-dark"
      }
    >
      {state.message}
    </div>
  );
}

function FieldError({
  state,
  name,
}: {
  state: ActionState;
  name: string;
}) {
  const error = state.fieldErrors?.[name]?.[0];
  return error ? (
    <p className="mt-1.5 text-sm font-semibold text-brand-dark">{error}</p>
  ) : null;
}

export function PromotionManager({
  promotions,
  today,
  suggestedEndDate,
}: PromotionManagerProps) {
  return (
    <div className="grid gap-8 xl:grid-cols-[0.92fr_1.08fr] xl:items-start">
      <section
        id="nova-promocao"
        className="scroll-mt-40 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-7"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-brand/10 text-brand-dark">
            <PlusIcon className="size-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
              Nova oferta
            </p>
            <h2 className="text-xl font-black text-ink">Criar promoção</h2>
          </div>
        </div>
        <div className="mt-6">
          <PromotionForm
            mode="create"
            today={today}
            suggestedEndDate={suggestedEndDate}
          />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
              Suas ofertas
            </p>
            <h2 className="mt-1 text-2xl font-black text-ink">
              Promoções cadastradas
            </h2>
          </div>
          <span className="rounded-full bg-ink px-3 py-1.5 text-xs font-black text-white">
            {promotions.length}
          </span>
        </div>

        {promotions.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-line bg-surface p-8 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-canvas text-muted">
              <ImageIcon className="size-6" />
            </span>
            <h3 className="mt-4 text-lg font-black text-ink">
              Nenhuma promoção ainda
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Preencha o formulário para publicar sua primeira oferta.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {promotions.map((promotion) => (
              <PromotionItem
                key={promotion.id}
                promotion={promotion}
                today={today}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PromotionForm({
  promotion,
  mode,
  today,
  suggestedEndDate,
}: {
  promotion?: PromotionFormValue;
  mode: "create" | "edit";
  today?: string;
  suggestedEndDate?: string;
}) {
  const [state, action, pending] = useActionState(
    savePromotionAction,
    initialActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (mode === "create" && state.status === "success") {
      formRef.current?.reset();
    }
  }, [mode, state]);

  return (
    <form ref={formRef} action={action} className="space-y-5">
      {promotion && (
        <input type="hidden" name="promotion_id" value={promotion.id} />
      )}
      <Feedback state={state} />
      <fieldset className="space-y-5" disabled={pending}>
        <div>
          <label className={labelClass} htmlFor={`promotion-title-${promotion?.id ?? "new"}`}>
            Título
          </label>
          <input
            className={inputClass}
            id={`promotion-title-${promotion?.id ?? "new"}`}
            name="title"
            type="text"
            defaultValue={promotion?.title}
            required
            minLength={2}
            maxLength={160}
            placeholder="Ex.: 20% de desconto nesta semana"
          />
          <FieldError state={state} name="title" />
        </div>

        <div>
          <label className={labelClass} htmlFor={`promotion-description-${promotion?.id ?? "new"}`}>
            Descrição <span className="font-semibold text-muted">(opcional)</span>
          </label>
          <textarea
            className="mt-2 min-h-24 w-full resize-y rounded-xl border border-line bg-white px-4 py-3 text-base leading-7 text-ink outline-none transition placeholder:text-muted/65 focus:border-brand focus:ring-4 focus:ring-brand/10"
            id={`promotion-description-${promotion?.id ?? "new"}`}
            name="description"
            defaultValue={promotion?.description}
            maxLength={1200}
            placeholder="Explique o que está incluído e as condições."
          />
          <FieldError state={state} name="description" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor={`promotion-original-${promotion?.id ?? "new"}`}>
              Preço original <span className="font-semibold text-muted">(opcional)</span>
            </label>
            <input
              className={inputClass}
              id={`promotion-original-${promotion?.id ?? "new"}`}
              name="original_price"
              type="text"
              inputMode="decimal"
              defaultValue={promotion?.originalPrice ?? ""}
              placeholder="99,90"
            />
            <FieldError state={state} name="original_price" />
          </div>
          <div>
            <label className={labelClass} htmlFor={`promotion-offer-${promotion?.id ?? "new"}`}>
              Preço da oferta
            </label>
            <input
              className={inputClass}
              id={`promotion-offer-${promotion?.id ?? "new"}`}
              name="offer_price"
              type="text"
              inputMode="decimal"
              defaultValue={promotion?.offerPrice ?? ""}
              required
              placeholder="79,90"
            />
            <FieldError state={state} name="offer_price" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor={`promotion-start-${promotion?.id ?? "new"}`}>
              Começa em
            </label>
            <input
              className={inputClass}
              id={`promotion-start-${promotion?.id ?? "new"}`}
              name="starts_on"
              type="date"
              defaultValue={promotion?.startsOn ?? today}
              required
            />
            <FieldError state={state} name="starts_on" />
          </div>
          <div>
            <label className={labelClass} htmlFor={`promotion-end-${promotion?.id ?? "new"}`}>
              Termina em
            </label>
            <input
              className={inputClass}
              id={`promotion-end-${promotion?.id ?? "new"}`}
              name="ends_on"
              type="date"
              defaultValue={promotion?.endsOn ?? suggestedEndDate}
              required
            />
            <FieldError state={state} name="ends_on" />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor={`promotion-image-${promotion?.id ?? "new"}`}>
            Imagem <span className="font-semibold text-muted">(opcional)</span>
          </label>
          {promotion?.imageUrl && (
            <div className="relative mt-2 aspect-[16/7] overflow-hidden rounded-2xl border border-line">
              <Image
                src={promotion.imageUrl}
                alt={`Imagem atual de ${promotion.title}`}
                fill
                sizes="(max-width: 1280px) 100vw, 45vw"
                className="object-cover"
              />
            </div>
          )}
          <input
            className="mt-2 block w-full rounded-xl border border-line bg-white p-2 text-sm font-semibold text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-black file:text-white"
            id={`promotion-image-${promotion?.id ?? "new"}`}
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
          />
          <p className="mt-1.5 text-xs font-semibold text-muted">
            JPG, PNG, WebP ou AVIF, até 5 MB.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-4">
          <input
            className="mt-1 size-4 accent-brand"
            name="is_active"
            type="checkbox"
            defaultChecked={promotion?.isActive ?? true}
          />
          <span>
            <span className="block text-sm font-black text-ink">
              Promoção ativa
            </span>
            <span className="mt-1 block text-xs font-semibold leading-5 text-muted">
              Ela aparece apenas durante o período escolhido e quando a loja estiver publicada.
            </span>
          </span>
        </label>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 text-base font-black text-white shadow-[0_10px_24px_rgba(185,61,37,0.2)] transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65"
      >
        {pending
          ? "Salvando..."
          : mode === "create"
            ? "Criar promoção"
            : "Salvar promoção"}
      </button>
    </form>
  );
}

function PromotionItem({
  promotion,
  today,
}: {
  promotion: PromotionFormValue;
  today: string;
}) {
  const hasStarted = promotion.startsOn <= today;
  const hasEnded = promotion.endsOn < today;
  const state = !promotion.isActive
    ? "Pausada"
    : hasEnded
      ? "Encerrada"
      : hasStarted
        ? "Ativa"
        : "Agendada";
  const stateClass =
    state === "Ativa"
      ? "bg-positive-soft text-positive"
      : state === "Agendada"
        ? "bg-accent/25 text-accent-dark"
        : "bg-canvas text-muted";

  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-line bg-surface shadow-sm">
      {promotion.imageUrl && (
        <div className="relative aspect-[16/6]">
          <Image
            src={promotion.imageUrl}
            alt={promotion.title}
            fill
            sizes="(max-width: 1280px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${stateClass}`}>
              {state}
            </span>
            <h3 className="mt-3 text-lg font-black text-ink">{promotion.title}</h3>
          </div>
          <div className="text-right">
            {promotion.originalPrice !== null && (
              <p className="text-xs font-bold text-muted line-through">
                {formatCurrency(promotion.originalPrice)}
              </p>
            )}
            <p className="text-xl font-black text-brand-dark">
              {formatCurrency(promotion.offerPrice)}
            </p>
          </div>
        </div>
        {promotion.description && (
          <p className="mt-3 text-sm leading-6 text-muted">
            {promotion.description}
          </p>
        )}
        <p className="mt-3 text-xs font-bold text-muted">
          {formatDate(promotion.startsOn)} a {formatDate(promotion.endsOn)}
        </p>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
          <form action={togglePromotionAction}>
            <input type="hidden" name="promotion_id" value={promotion.id} />
            <input
              type="hidden"
              name="next_active"
              value={String(!promotion.isActive)}
            />
            <button
              type="submit"
              className="inline-flex min-h-10 items-center rounded-xl border border-line px-3 text-sm font-black text-ink transition hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {promotion.isActive ? "Pausar" : "Ativar"}
            </button>
          </form>
          <details className="group flex-1">
            <summary className="inline-flex min-h-10 list-none items-center gap-2 rounded-xl border border-line px-3 text-sm font-black text-ink transition hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              <EditIcon className="size-4" />
              Editar
            </summary>
            <div className="mt-4 rounded-2xl border border-line bg-canvas p-4">
              <PromotionForm promotion={promotion} mode="edit" />
            </div>
          </details>
          <form
            action={deletePromotionAction}
            onSubmit={(event) => {
              if (!window.confirm("Excluir esta promoção definitivamente?")) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="promotion_id" value={promotion.id} />
            <button
              type="submit"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand/20 px-3 text-sm font-black text-brand-dark transition hover:bg-brand/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <TrashIcon className="size-4" />
              Excluir
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
