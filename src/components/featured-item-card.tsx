import Image from "next/image";
import Link from "next/link";
import {
  ArrowRightIcon,
  GlobeIcon,
  PhoneIcon,
  StarIcon,
  WhatsAppIcon,
} from "@/components/icons";
import {
  catalogContactHref,
  catalogContactLabel,
} from "@/lib/catalog-conversion";
import { catalogPricePresentation } from "@/lib/catalog-pricing";
import type { FeaturedCatalogItem } from "@/types/catalog";

export function FeaturedItemCard({ item }: { item: FeaturedCatalogItem }) {
  const price = catalogPricePresentation(
    item.priceMode,
    item.price,
    item.promotionalPrice,
  );
  const contactHref = catalogContactHref({
    action: item.contactAction,
    contactUrl: item.contactUrl,
    whatsapp: item.whatsapp,
    phone: item.phone,
    businessName: item.businessName,
    item,
  });
  const contactLabel = catalogContactLabel(item.contactAction, item);
  const ContactIcon =
    item.contactAction === "phone"
      ? PhoneIcon
      : item.contactAction === "link"
        ? GlobeIcon
        : WhatsAppIcon;
  const storeHref = `/loja/${item.businessSlug}?item=${encodeURIComponent(item.id)}#item-${encodeURIComponent(item.id)}`;
  const contactClass =
    item.contactAction === "whatsapp"
      ? "bg-[#1f9d61] text-white hover:bg-[#17834f] focus-visible:ring-[#1f9d61]"
      : "bg-ink text-white hover:bg-ink/90 focus-visible:ring-ink";

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm sm:rounded-3xl">
      {item.imageUrl ? (
        <div className="relative aspect-[4/3] overflow-hidden bg-canvas sm:aspect-[16/10]">
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 20vw"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] font-black uppercase tracking-wide text-brand-dark">
            {item.kind === "service" ? "Serviço" : "Produto"}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-accent/30 px-1.5 py-1 text-[9px] font-black text-ink sm:px-2">
            <StarIcon className="size-3" />
            Destaque
          </span>
        </div>
        <p className="mt-3 truncate text-[10px] font-extrabold uppercase tracking-wide text-muted">
          {item.businessName}
        </p>
        <h3 className="mt-1 line-clamp-2 text-sm font-black leading-tight text-ink sm:text-base">
          {item.name}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-muted sm:text-xs sm:leading-5">
          {item.description}
        </p>

        <div className="mt-auto pt-3">
          {price.original ? (
            <span className="block text-[10px] font-bold text-muted line-through">
              {price.original}
            </span>
          ) : null}
          <span className="text-sm font-black text-ink sm:text-base">{price.primary}</span>

          <div className="mt-3 grid gap-2">
            {contactHref ? (
              <a
                href={contactHref}
                {...(item.contactAction === "phone"
                  ? {}
                  : { target: "_blank", rel: "noreferrer" })}
                className={`inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-center text-[10px] font-black leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:px-3 sm:text-xs ${contactClass}`}
              >
                <ContactIcon className="hidden size-4 shrink-0 sm:block" />
                {contactLabel}
              </a>
            ) : null}
            <Link
              href={storeHref}
              className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-line bg-canvas px-1.5 text-center text-[10px] font-black text-brand-dark outline-none transition hover:border-brand/30 hover:bg-brand/5 focus-visible:ring-2 focus-visible:ring-brand sm:text-xs"
            >
              Ver na loja
              <ArrowRightIcon className="size-3.5 shrink-0" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
