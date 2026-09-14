import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import type { Promotion } from "@/types/catalog";

type PromotionCardProps = {
  promotion: Promotion;
};

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function PromotionCard({ promotion }: PromotionCardProps) {
  return (
    <article
      className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border border-ink/5 sm:rounded-3xl ${promotion.palette}`}
    >
      {promotion.imageUrl ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-white/50 sm:aspect-[16/10]">
          <Image
            src={promotion.imageUrl}
            alt={promotion.title}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 25vw"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="flex items-start justify-between gap-1">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-xl bg-white/80 text-lg shadow-sm sm:size-10 sm:text-xl"
            aria-hidden="true"
          >
            {promotion.symbol}
          </span>
          <span className="rounded-full bg-ink px-1.5 py-1 text-[9px] font-black text-white sm:px-2 sm:text-[10px]">
            {promotion.badge}
          </span>
        </div>
        <p className="mt-3 truncate text-[10px] font-extrabold uppercase tracking-wide text-muted">
          {promotion.businessName}
        </p>
        <h3 className="mt-1.5 line-clamp-2 text-sm font-black leading-tight text-ink sm:text-base">
          {promotion.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-muted sm:text-xs sm:leading-5">{promotion.description}</p>
        {promotion.offerPrice !== undefined ? (
          <div className="mt-3">
            {promotion.originalPrice !== null && promotion.originalPrice !== undefined ? (
              <span className="block text-[10px] font-bold text-muted line-through">
                {money(promotion.originalPrice)}
              </span>
            ) : null}
            <span className="text-sm font-black text-ink sm:text-base">
              {money(promotion.offerPrice)}
            </span>
          </div>
        ) : null}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-1 pt-3">
          <span className="text-[10px] font-bold text-muted sm:text-xs">
            {promotion.expiresLabel}
          </span>
          <Link
            href={`/loja/${promotion.businessSlug}`}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg text-xs font-black text-ink outline-none hover:text-brand-dark focus-visible:ring-2 focus-visible:ring-brand"
          >
            Ver oferta
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
