import {
  contactActionLabel,
  resolveContactHref,
} from "@/lib/contact-action";
import { catalogPricePresentation } from "@/lib/catalog-pricing";
import type { CatalogPriceMode, ContactAction } from "@/types/catalog";

type CatalogConversionItem = {
  kind: "product" | "service";
  name: string;
  priceMode: CatalogPriceMode;
  price: number | null;
  promotionalPrice?: number | null;
};

export function catalogConversionLabel(item: Pick<CatalogConversionItem, "kind" | "priceMode">) {
  if (item.kind === "service") {
    return item.priceMode === "consult" ? "Solicitar orçamento" : "Quero este serviço";
  }
  return "Quero este produto";
}

export function catalogConversionMessage(
  businessName: string,
  item: CatalogConversionItem,
) {
  const price = catalogPricePresentation(
    item.priceMode,
    item.price,
    item.promotionalPrice,
  );
  const priceLine = price.original
    ? `Oferta: ${price.primary} (de ${price.original}).`
    : item.priceMode === "consult"
      ? ""
      : `Valor informado: ${price.primary}.`;
  const intent =
    item.kind === "service"
      ? item.priceMode === "consult"
        ? "Gostaria de solicitar um orçamento e saber mais detalhes."
        : "Gostaria de saber mais detalhes e como contratar."
      : "Gostaria de confirmar a disponibilidade e saber como comprar.";

  return [
    `Olá! Encontrei ${item.kind === "service" ? "o serviço" : "o produto"} “${item.name}” da ${businessName} no O Calçadão.`,
    priceLine,
    intent,
  ]
    .filter(Boolean)
    .join("\n");
}

export function catalogWhatsappHref(
  whatsapp: string | null | undefined,
  businessName: string,
  item: CatalogConversionItem,
) {
  return resolveContactHref({
    action: "whatsapp",
    whatsapp,
    whatsappMessage: catalogConversionMessage(businessName, item),
  });
}

export function catalogContactHref({
  action,
  contactUrl,
  whatsapp,
  phone,
  businessName,
  item,
}: {
  action: ContactAction;
  contactUrl?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  businessName: string;
  item: CatalogConversionItem;
}) {
  return resolveContactHref({
    action,
    contactUrl,
    whatsapp,
    phone,
    whatsappMessage: catalogConversionMessage(businessName, item),
  });
}

export function catalogContactLabel(
  action: ContactAction,
  item: Pick<CatalogConversionItem, "kind" | "priceMode">,
) {
  return contactActionLabel(action, catalogConversionLabel(item));
}
