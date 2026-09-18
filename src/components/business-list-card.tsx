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
      className={`group overflow-hidden rounded-2xl bg-surface shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        business.isSponsored
          ? "border-2 border-accent-dark/55 ring-2 ring-accent/15"
          : "border border-line"
      }`}
    >
      <Link
        href={`/loja/${business.slug}`}
        className={`relative block h-20 overflow-visible bg-gradient-to-br ${business.palette} text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset sm:h-24`}
        aria-label={`Abrir vitrine de ${business.name}`}
      >
        <span className="absolute inset-0 overflow-hidden">
          {business.coverUrl ? (
            <>
              <Image
                src={business.coverUrl}
                alt={`Capa de ${business.name}`}
                fill
                sizes="(max-width: 768px) 100vw, 900px"
                className="object-cover transition duration-300 group-hover:scale-[1.02]"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-ink/10" />
            </>
          ) : (
            <span className="absolute inset-0 bg-[linear-gradient(135deg,transparent_25%,rgba(255,255,255,0.12)_25%,rgba(255,255,255,0.12)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.12)_75%)] bg-[length:24px_24px] opacity-30" />
          )}
        </span>

        {business.isSponsored ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-[8px] font-black uppercase tracking-wide text-ink shadow-sm">
            <SparklesIcon className="size-3" />
            Destaque
          </span>
        ) : null}

        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[8px] font-black leading-tight shadow-sm sm:text-[9px] ${
            business.isOpen ? "bg-white text-positive" : "bg-ink/90 text-white"
          }`}
        >
          {business.alwaysOpen
            ? "Aberto 24h"
            : business.isOpen
              ? "Aberto"
              : "Fechado"}
        </span>

        <span className="absolute -bottom-6 left-3 grid size-12 place-items-center overflow-hidden rounded-xl border-2 border-surface bg-white/95 text-sm font-black text-ink shadow-lg sm:-bottom-7 sm:size-14 sm:rounded-2xl">
          {business.logoUrl ? (
            <Image
              src={business.logoUrl}
              alt={`Logo de ${business.name}`}
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : (
            business.initials
          )}
        </span>
      </Link>

      <div className="px-3 pb-3 pt-2.5 sm:px-4 sm:pb-3.5 sm:pt-3">
        <div className="min-h-11 pl-14 sm:min-h-12 sm:pl-16">
          <p className="truncate text-[8px] font-extrabold uppercase tracking-[0.06em] text-brand-dark sm:text-[9px]">
            {isPublicPlace ? "Local público" : business.categoryName}
          </p>
          <div className="mt-0.5 flex min-w-0 items-center gap-1">
            <h3 className="min-w-0 flex-1 text-sm font-black leading-tight tracking-tight text-ink sm:text-base">
              <Link
                href={`/loja/${business.slug}`}
                className="line-clamp-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {business.name}
              </Link>
            </h3>
            {business.verified ? (
              <>
                <ShieldCheckIcon className="size-4 shrink-0 text-positive" />
                <span className="sr-only">
                  {isPublicPlace ? "Informações conferidas" : "Comércio verificado"}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-2 border-t border-line/70 pt-2">
          <div className="flex min-w-0 items-center gap-2 text-[10px] font-semibold text-muted sm:text-[11px]">
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPinIcon className="size-3.5 shrink-0 text-brand" />
              <span className="truncate">{business.neighborhood}</span>
            </span>
            <span className="shrink-0 font-black text-brand-dark">
              {business.distance}
            </span>
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-semibold text-muted sm:text-[10px]">
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

              <span className="inline-flex items-center gap-1">
                <ClockIcon className="size-3.5 text-brand" />
                <span className="max-w-[8.5rem] truncate sm:max-w-none">
                  {business.alwaysOpen
                    ? "Aberto 24 horas"
                    : business.hoursAvailable === false
                      ? business.closesAt
                      : business.isOpen
                        ? `Até ${business.closesAt}`
                        : business.closesAt}
                </span>
              </span>

              {hasRating && business.ratingSource === "google" ? (
                <span className="hidden font-bold sm:inline">
                  Google Maps{business.reviewCount < 5 ? " · poucas avaliações" : ""}
                </span>
              ) : null}
            </div>

            <Link
              href={`/loja/${business.slug}`}
              className="inline-flex min-h-8 shrink-0 items-center justify-center gap-1 rounded-lg bg-ink px-2.5 text-[10px] font-black text-white transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:min-h-9 sm:px-3 sm:text-[11px]"
            >
              {isPublicPlace ? "Ver local" : "Ver loja"}
              <ArrowRightIcon className="size-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
