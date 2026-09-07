import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, StarIcon, WhatsAppIcon } from "@/components/icons";
import {
  catalogConversionLabel,
  catalogWhatsappHref,
} from "@/lib/catalog-conversion";
import { catalogPricePresentation } from "@/lib/catalog-pricing";
import type { FeaturedCatalogItem } from "@/types/catalog";

export function FeaturedItemCard({ item }: { item: FeaturedCatalogItem }) {
  const price = catalogPricePresentation(
    item.priceMode,
    item.price,
    item.promotionalPrice,
  );
  const whatsappHref = catalogWhatsappHref(item.whatsapp, item.businessName, item);
  const conversionLabel = catalogConversionLabel(item);
  const storeHref = `/loja/${item.businessSlug}?item=${encodeURIComponent(item.id)}#item-${encodeURIComponent(item.id)}`;

  return (
    <article className="flex min-h-64 flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
      {item.imageUrl ? (
        <div className="relative aspect-[16/9] overflow-hidden bg-canvas">
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="(max-width: 768px) 90vw, 30vw"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-brand-dark">
            {item.kind === "service" ? "Serviço em destaque" : "Produto em destaque"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/30 px-2.5 py-1 text-[0.68rem] font-black text-ink">
            <StarIcon className="size-3.5" />
            DESTAQUE
          </span>
        </div>
        <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.1em] text-muted">
          {item.businessName}
        </p>
        <h3 className="mt-2 text-xl font-black tracking-tight text-ink">{item.name}</h3>
        <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>

        <div className="mt-auto pt-5">
          <div>
            {price.original ? (
              <span className="block text-xs font-bold text-muted line-through">
                {price.original}
              </span>
            ) : null}
            <span className="text-lg font-black text-ink">{price.primary}</span>
          </div>

          <div className="mt-4 grid gap-2">
            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1f9d61] px-4 text-sm font-black text-white transition hover:bg-[#17834f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f9d61] focus-visible:ring-offset-2"
              >
                <WhatsAppIcon className="size-4.5 shrink-0" />
                {conversionLabel}
              </a>
            ) : null}
            <Link
              href={storeHref}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-canvas px-4 text-sm font-black text-brand-dark outline-none transition hover:border-brand/30 hover:bg-brand/5 focus-visible:ring-2 focus-visible:ring-brand"
            >
              Ver detalhes na loja
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
          {whatsappHref ? (
            <p className="mt-2 text-center text-[0.7rem] font-bold text-muted">
              Você fala direto com o comércio, sem intermediários.
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
