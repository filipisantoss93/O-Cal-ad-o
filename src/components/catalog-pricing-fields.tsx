"use client";

import { useState } from "react";
import type { CatalogPriceMode } from "@/types/catalog";

type CatalogPricingFieldsProps = {
  defaultKind?: "product" | "service";
  defaultPriceMode?: CatalogPriceMode;
  defaultPrice?: string;
  defaultPromotionalPrice?: string;
  compact?: boolean;
};

export function CatalogPricingFields({
  defaultKind = "product",
  defaultPriceMode = "fixed",
  defaultPrice = "",
  defaultPromotionalPrice = "",
  compact = false,
}: CatalogPricingFieldsProps) {
  const [kind, setKind] = useState<"product" | "service">(defaultKind);
  const [priceMode, setPriceMode] = useState<CatalogPriceMode>(
    defaultKind === "product" ? "fixed" : defaultPriceMode,
  );
  const effectivePriceMode = kind === "product" ? "fixed" : priceMode;
  const inputHeight = compact ? "min-h-11" : "min-h-12";
  const textSize = compact ? "text-sm" : "";

  return (
    <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
      <label className="text-sm font-black text-ink">
        Tipo
        <select
          name="kind"
          value={kind}
          onChange={(event) => {
            const nextKind = event.target.value === "service" ? "service" : "product";
            setKind(nextKind);
            if (nextKind === "product") setPriceMode("fixed");
          }}
          className={`mt-1 ${inputHeight} w-full rounded-xl border border-line bg-white px-3 font-semibold ${textSize}`}
        >
          <option value="product">Produto</option>
          <option value="service">Serviço</option>
        </select>
      </label>

      <label className="text-sm font-black text-ink">
        Forma de preço
        <select
          name="price_mode"
          value={effectivePriceMode}
          disabled={kind === "product"}
          onChange={(event) => setPriceMode(event.target.value as CatalogPriceMode)}
          className={`mt-1 ${inputHeight} w-full rounded-xl border border-line bg-white px-3 font-semibold disabled:bg-canvas disabled:text-muted ${textSize}`}
        >
          <option value="fixed">Preço fixo</option>
          <option value="from">A partir de</option>
          <option value="consult">Valor sob consulta</option>
        </select>
        {kind === "product" ? <input type="hidden" name="price_mode" value="fixed" /> : null}
      </label>

      <label className="text-sm font-black text-ink">
        {effectivePriceMode === "from" ? "Valor inicial" : "Preço"}
        <input
          name="price"
          inputMode="decimal"
          defaultValue={defaultPrice}
          required={effectivePriceMode !== "consult"}
          disabled={effectivePriceMode === "consult"}
          className={`mt-1 ${inputHeight} w-full rounded-xl border border-line bg-white px-3 font-semibold disabled:bg-canvas disabled:text-muted ${textSize}`}
          placeholder={effectivePriceMode === "consult" ? "Não necessário" : "99,90"}
        />
      </label>

      <label className="text-sm font-black text-ink">
        Preço promocional <span className="font-semibold text-muted">(opcional)</span>
        <input
          name="promotional_price"
          inputMode="decimal"
          defaultValue={defaultPromotionalPrice}
          disabled={effectivePriceMode !== "fixed"}
          className={`mt-1 ${inputHeight} w-full rounded-xl border border-line bg-white px-3 font-semibold disabled:bg-canvas disabled:text-muted ${textSize}`}
          placeholder={effectivePriceMode === "fixed" ? "79,90" : "Disponível só no preço fixo"}
        />
      </label>

      {kind === "service" ? (
        <p className="text-xs font-semibold leading-5 text-muted sm:col-span-2">
          Serviços podem ter preço fixo, valor inicial (“a partir de”) ou ficar como valor sob consulta.
        </p>
      ) : null}
    </div>
  );
}
