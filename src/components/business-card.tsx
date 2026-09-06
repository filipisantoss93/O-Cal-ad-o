import Link from "next/link";
import {
  ArrowRightIcon,
  ClockIcon,
  MapPinIcon,
  ShieldCheckIcon,
  StarIcon,
} from "@/components/icons";
import type { Business } from "@/types/catalog";

type BusinessCardProps = {
  business: Business;
};

export function BusinessCard({ business }: BusinessCardProps) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-line bg-surface shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(29,43,40,0.11)]">
      <div
        className={`relative flex h-36 items-end bg-gradient-to-br ${business.palette} p-4 text-white`}
      >
        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_25%,rgba(255,255,255,0.12)_25%,rgba(255,255,255,0.12)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.12)_75%)] bg-[length:28px_28px] opacity-30" />
        <span className="relative grid size-16 place-items-center rounded-2xl border border-white/35 bg-white/20 text-xl font-black shadow-lg backdrop-blur-sm">
          {business.initials}
        </span>
        <span
          className={`relative ml-auto rounded-full px-3 py-1.5 text-xs font-black shadow-sm ${
            business.isOpen
              ? "bg-white text-[#1f6a4a]"
              : "bg-ink/85 text-white"
          }`}
        >
          {business.alwaysOpen
            ? "Aberto 24h"
            : business.isOpen
              ? "Aberto agora"
              : "Fechado"}
        </span>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-brand-dark">
              {business.categoryName}
            </p>
            <h3 className="mt-1.5 flex items-center gap-1.5 text-xl font-black tracking-tight text-ink">
              <Link
                href={`/loja/${business.slug}`}
                className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {business.name}
              </Link>
              {business.verified && (
                <>
                  <ShieldCheckIcon className="size-5 shrink-0 text-[#25835f]" />
                  <span className="sr-only">Comércio verificado</span>
                </>
              )}
            </h3>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-black text-ink">
            <StarIcon className="size-4 fill-accent stroke-accent-dark" />
            {business.reviewCount > 0
              ? business.rating.toLocaleString("pt-BR")
              : "Novo"}
          </span>
        </div>

        <p className="mt-3 line-clamp-2 min-h-12 text-sm leading-6 text-muted">
          {business.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-muted">
          <span className="inline-flex items-center gap-1.5">
            <MapPinIcon className="size-4 text-brand" />
            {business.neighborhood} · {business.distance}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon className="size-4 text-brand" />
            {business.alwaysOpen
              ? "Aberto 24 horas"
              : business.hoursAvailable === false
              ? business.closesAt
              : business.isOpen
                ? `Até ${business.closesAt}`
                : business.closesAt}
          </span>
        </div>

        <Link
          href={`/loja/${business.slug}`}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-black text-white transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          Ver vitrine
          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </article>
  );
}
