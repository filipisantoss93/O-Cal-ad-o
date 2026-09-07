import type { CatalogPriceMode } from "@/types/catalog";

export function normalizeCatalogPriceMode(
  kind: "product" | "service",
  value: string,
): CatalogPriceMode {
  if (kind === "product") return "fixed";
  if (value === "from" || value === "consult") return value;
  return "fixed";
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function catalogPricePresentation(
  priceMode: CatalogPriceMode,
  price: number | null,
  promotionalPrice?: number | null,
) {
  if (priceMode === "consult" || price === null) {
    return {
      primary: "Valor sob consulta",
      original: null,
    };
  }

  if (priceMode === "from") {
    return {
      primary: `A partir de ${money(price)}`,
      original: null,
    };
  }

  if (promotionalPrice !== null && promotionalPrice !== undefined) {
    return {
      primary: money(promotionalPrice),
      original: money(price),
    };
  }

  return {
    primary: money(price),
    original: null,
  };
}
