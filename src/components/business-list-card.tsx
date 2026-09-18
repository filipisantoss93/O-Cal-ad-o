import Image from "next/image";
import Link from "next/link";
import {
  ArrowRightIcon,
  ClockIcon,
  MapPinIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StarIcon,
} from "@/components/icons";
import type { Business } from "@/types/catalog";

type BusinessListCardProps = {
  business: Business;
};

export function BusinessListCard({ business }: BusinessListCardProps) {
  const isPublicPlace = business.listingType === "public_place";
  const hasRating =
    !isPublicPlace &&
    Number.isFinite(business.rating) &&
    business.rating > 0 &&
    business.reviewCount > 0;

  return (
    <article
      data-highlight-campaign={business.highlightCampaignId ?? undefined}
      className={`group overflow-hidden rounded-2xl bg-surface shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:rounded-3xl ${
        business.isSponsored
          ? "border-2 border-accent-dark/55 ring-2 ring-accent/15"
          : "border border-line"
      }`}
    >
      <div className="grid min-h-[9.5rem] grid-cols-[7rem_minmax(0,1fr)] sm:min-h-[10.5rem] sm:grid-cols-[10rem_minmax(0,1fr)]">
        <Link
          href={`/loja/${business.slug}`}
          className={`relative block overflow-hidden bg-gradient-to-br ${business.palette} text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset`}
          aria-label={`Abrir vitrine de ${business.name}`}
        >
          {business.coverUrl ? (
            <>
              <Image
                src={business.coverUrl}
                alt={`Capa de ${business.name}`}
                fill
                sizes="(max-width: 640px) 112px, 160px"
                className="object-cover transition duration-300 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-ink/10" />
            </>
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_25%,rgba(255,255,255,0.12)_25%,rgba(255,255,255,0.12)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.12)_75%)] bg-[length:26px_26px] opacity-30" />
          )}

          {business.isSponsored ? (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-[8px] font-black uppercase tracking-wide text-ink shadow-sm">
              <SparklesIcon className="size-3" />
              Destaque
            </span>
          ) : null}

          <span className="absolute bottom-2 left-2 grid size-11 place-items-center overflow-hidden rounded-xl border border-white/55 bg-white/20 text-sm font-black shadow-lg backdrop-blur-sm sm:size-13 sm:rounded-2xl">
            {business.logoUrl ? (
              <Image
                src={business.logoUrl}
                alt={`Logo de ${business.name}`}
                fill
                sizes="52px"
                className="object-cover"
              />
            ) : (
              business.initials
            )}
          </span>
        </Link>

        <div className="flex min-w-0 flex-col p-3 sm:p-4">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[9px] font-extrabold uppercase tracking-[0.07em] text-brand-dark sm:text-[10px]">
                {isPublicPlace ? "Local público" : business.categoryName}
              </p>
              <div className="mt-1 flex min-w-0 items-start gap-1">
                <h3 className="min-w-0 text-[0.98rem] font-black leading-tight tracking-tight text-ink sm:text-lg">
                  <Link
                    href={`/loja/${business.slug}`}
                    className="line-clamp-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {business.name}
                  </Link>
                </h3>
                {business.verified ? (
                  <>
                    <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-positive sm:size-5" />
                    <span className="sr-only">
                      {isPublicPlace ? "Informações conferidas" : "Comércio verificado"}
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            <span
              className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black leading-tight sm:text-[10px] ${
                business.isOpen
                  ? "bg-positive-soft text-positive"
                  : "bg-ink text-white"
              }`}
            >
              {business.alwaysOpen
                ? "Aberto 24h"
                : business.isOpen
                  ? "Aberto"
                  : "Fechado"}
            </span>
          </div>

          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-muted sm:text-xs">
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPinIcon className="size-3.5 shrink-0 text-brand" />
              <span className="truncate">{business.neighborhood}</span>
            </span>
            <span className="font-black text-brand-dark">
              {business.distance}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-muted sm:text-xs">
            <span className="inline-flex items-center gap-1">
              <StarIcon className="size-3.5 fill-accent stroke-accent-dark" />
              {isPublicPlace
                ? "Público"
                : hasRating
                  ? `${business.rating.toLocaleString("pt-BR", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })} (${business.reviewCount.toLocaleString("pt-BR")})`
                  : "Novo"}
            </span>
            {hasRating && business.ratingSource === "google" ? (
              <span className="font-bold">Google Maps</span>
            ) : null}
            <span className="hidden items-center gap-1 sm:inline-flex">
              <ClockIcon className="size-3.5 text-brand" />
              {business.alwaysOpen
                ? "Aberto 24 horas"
                : business.hoursAvailable === false
                  ? business.closesAt
                  : business.isOpen
                    ? `Até ${business.closesAt}`
                    : business.closesAt}
            </span>
          </div>

          <div className="mt-auto pt-3">
            <Link
              href={`/loja/${business.slug}`}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-ink px-3 text-[11px] font-black text-white transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:min-h-10 sm:px-4 sm:text-xs"
            >
              {isPublicPlace ? "Ver local" : "Ver loja"}
              <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
