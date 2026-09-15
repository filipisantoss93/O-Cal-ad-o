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

type BusinessCardProps = {
  business: Business;
  compact?: boolean;
};

export function BusinessCard({ business, compact = false }: BusinessCardProps) {
  const isPublicPlace = business.listingType === "public_place";

  return (
    <article
      data-highlight-campaign={business.highlightCampaignId ?? undefined}
      className={`group min-w-0 overflow-hidden bg-surface shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(29,43,40,0.11)] ${compact ? "rounded-2xl sm:rounded-3xl" : "rounded-3xl"} ${
        business.isSponsored
          ? "border-2 border-accent-dark/55 ring-2 ring-accent/15 sm:ring-4"
          : "border border-line"
      }`}
    >
      <div
        className={`relative flex items-end bg-gradient-to-br ${business.palette} text-white ${compact ? "h-28 p-2 sm:h-32 sm:p-3" : "h-36 p-4"}`}
      >
        {business.coverUrl ? (
          <>
            <Image
              src={business.coverUrl}
              alt={`Capa de ${business.name}`}
              fill
              sizes={compact ? "(max-width: 640px) 45vw, 25vw" : "(max-width: 768px) 90vw, 25vw"}
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/65 via-ink/10 to-ink/15" />
          </>
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_25%,rgba(255,255,255,0.12)_25%,rgba(255,255,255,0.12)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.12)_75%)] bg-[length:28px_28px] opacity-30" />
        )}
        {business.isSponsored && (
          <span className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-accent font-black uppercase text-ink shadow-md ${compact ? "px-2 py-1 text-[9px] sm:text-[10px]" : "left-4 top-4 px-3 py-1.5 text-[11px] tracking-[0.08em]"}`}>
            <SparklesIcon className="size-3" />
            Patrocinado
          </span>
        )}
        <span className={`relative grid shrink-0 place-items-center overflow-hidden border border-white/50 bg-white/25 font-black shadow-lg backdrop-blur-sm ${compact ? "size-10 rounded-xl text-sm sm:size-12" : "size-16 rounded-2xl text-xl"}`}>
          {business.logoUrl ? (
            <Image src={business.logoUrl} alt={`Imagem de ${business.name}`} fill sizes={compact ? "48px" : "64px"} className="object-cover" />
          ) : business.initials}
        </span>
        <span className={`relative ml-auto rounded-full text-center font-black shadow-sm ${compact ? "max-w-[82px] px-1.5 py-1 text-[9px] leading-tight sm:max-w-none sm:px-2 sm:text-[10px]" : "px-3 py-1.5 text-xs"} ${
          business.isOpen ? "bg-white text-[#1f6a4a]" : "bg-ink/85 text-white"
        }`}>
          {business.alwaysOpen
            ? "Aberto 24h"
            : business.isOpen
              ? "Aberto agora"
              : "Fechado"}
        </span>
      </div>

      <div className={compact ? "p-3 sm:p-4" : "p-5"}>
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`truncate font-extrabold uppercase text-brand-dark ${compact ? "text-[9px] tracking-[0.06em] sm:text-[10px]" : "text-xs tracking-[0.12em]"}`}>
              {business.categoryName}
            </p>
            <h3 className={`flex items-center gap-1 font-black tracking-tight text-ink ${compact ? "mt-1 text-sm leading-tight sm:text-base" : "mt-1.5 text-xl"}`}>
              <Link
                href={`/loja/${business.slug}`}
                className="line-clamp-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {business.name}
              </Link>
              {business.verified && (
                <>
                  <ShieldCheckIcon className={`shrink-0 text-[#25835f] ${compact ? "size-4" : "size-5"}`} />
                  <span className="sr-only">
                    {isPublicPlace ? "Informações conferidas" : "Comércio verificado"}
                  </span>
                </>
              )}
            </h3>
          </div>
          <span className={`items-center gap-1 font-black text-ink ${compact ? "hidden text-xs sm:inline-flex" : "inline-flex text-sm"}`}>
            <StarIcon className="size-4 fill-accent stroke-accent-dark" />
            {isPublicPlace
              ? "Público"
              : business.reviewCount > 0
              ? business.rating.toLocaleString("pt-BR")
              : "Novo"}
          </span>
        </div>

        <p className={compact ? "mt-2 hidden text-xs leading-5 text-muted sm:line-clamp-2" : "mt-3 line-clamp-2 min-h-12 text-sm leading-6 text-muted"}>
          {business.description}
        </p>

        <div className={`flex flex-wrap font-semibold text-muted ${compact ? "mt-2 gap-1 text-[10px] sm:mt-3 sm:text-xs" : "mt-4 gap-x-4 gap-y-2 text-xs"}`}>
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPinIcon className={`shrink-0 text-brand ${compact ? "size-3.5" : "size-4"}`} />
            <span className={compact ? "truncate" : ""}>{business.neighborhood} · {business.distance}</span>
          </span>
          <span className={compact ? "hidden items-center gap-1 sm:inline-flex" : "inline-flex items-center gap-1.5"}>
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
          className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-ink font-black text-white transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${compact ? "mt-3 min-h-10 px-2 text-xs sm:text-sm" : "mt-5 min-h-11 px-4 text-sm"}`}
        >
          {isPublicPlace ? "Ver local" : compact ? "Ver loja" : "Ver vitrine"}
          <ArrowRightIcon className={`transition-transform group-hover:translate-x-1 ${compact ? "size-3.5" : "size-4"}`} />
        </Link>
      </div>
    </article>
  );
}
