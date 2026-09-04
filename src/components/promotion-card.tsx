import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import type { Promotion } from "@/types/catalog";

type PromotionCardProps = {
  promotion: Promotion;
};

export function PromotionCard({ promotion }: PromotionCardProps) {
  return (
    <article
      className={`flex min-h-64 flex-col rounded-3xl border border-ink/5 p-5 ${promotion.palette}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="grid size-12 place-items-center rounded-2xl bg-white/80 text-2xl shadow-sm"
          aria-hidden="true"
        >
          {promotion.symbol}
        </span>
        <span className="rounded-full bg-ink px-3 py-1.5 text-[0.7rem] font-black tracking-wider text-white">
          {promotion.badge}
        </span>
      </div>
      <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.12em] text-muted">
        {promotion.businessName}
      </p>
      <h3 className="mt-2 text-xl font-black tracking-tight text-ink">
        {promotion.title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted">{promotion.description}</p>
      <div className="mt-auto flex items-end justify-between gap-3 pt-5">
        <span className="text-xs font-bold text-muted">
          {promotion.expiresLabel}
        </span>
        <Link
          href={`/loja/${promotion.businessSlug}`}
          className="inline-flex items-center gap-1.5 rounded-lg text-sm font-black text-ink outline-none hover:text-brand-dark focus-visible:ring-2 focus-visible:ring-brand"
        >
          Ver oferta
          <ArrowRightIcon className="size-4" />
        </Link>
      </div>
    </article>
  );
}
