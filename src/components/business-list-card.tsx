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
      <Link
        href={`/loja/${business.slug}`}
        className={`relative block h-28 overflow-visible bg-gradient-to-br ${business.palette} text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset sm:h-36`}
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
              <span className="absolute inset-0 bg-gradient-to-t from-ink/55 via-ink/5 to-ink/10" />
            </>
          ) : (
            <span className="absolute inset-0 bg-[linear-gradient(135deg,transparent_25%,rgba(255,255,255,0.12)_25%,rgba(255,255,255,0.12)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.12)_75%)] bg-[length:26px_26px] opacity-30" />
          )}
        </span>

        {business.isSponsored ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[8px] font-black uppercase tracking-wide text-ink shadow-sm sm:text-[9px]">
            <SparklesIcon className="size-3" />
            Destaque
          </span>
        ) : null}

        <span
          className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[9px] font-black leading-tight shadow-sm sm:text-[10px] ${
            business.isOpen
              ? "bg-white text-positive"
              : "bg-ink/90 text-white"
          }`}
        >
          {business.alwaysOpen
            ? "Aberto 24h"
            : business.isOpen
              ? "Aberto"
              : "Fechado"}
        </span>

        <span className="absolute -bottom-7 left-3 grid size-14 place-items-center overflow-hidden rounded-2xl border-2 border-surface bg-white/95 text-base font-black text-ink shadow-lg sm:-bottom-8 sm:left-4 sm:size-16">
          {business.logoUrl ? (
            <Image
              src={business.logoUrl}
              alt={`Logo de ${business.name}`}
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : (
            business.initials
          )}
        </span>
      </Link>

      <div className="p-3 pt-3 sm:p-4 sm:pt-4">
        <div className="min-h-12 pl-16 sm:min-h-14 sm:pl-20">
          <p className="truncate text-[9px] font-extrabold uppercase tracking-[0.07em] text-brand-dark sm:text-[10px]">
            {isPublicPlace ? "Local público" : business.categoryName}
          </p>
          <div className="mt-1 flex min-w-0 items-start gap-1.5">
            <h3 className="min-w-0 text-base font-black leading-tight tracking-tight text-ink sm:text-lg">
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

        <div className="mt-3 border-t border-line/70 pt-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-semibold text-muted sm:text-xs">
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPinIcon className="size-3.5 shrink-0 text-brand" />
              <span className="truncate">{business.neighborhood}</span>
            </span>
            <span className="font-black text-brand-dark">
              {business.distance}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] font-semibold text-muted sm:text-xs">
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
              <span className="font-bold">
                Google Maps{business.reviewCount < 5 ? " · poucas avaliações" : ""}
              </span>
            ) : null}

            <span className="inline-flex items-center gap-1">
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
        </div>

        <Link
          href={`/loja/${business.slug}`}
          className="mt-3 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-ink px-4 text-xs font-black text-white transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          {isPublicPlace ? "Ver local" : "Ver loja"}
          <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </article>
  );
}
