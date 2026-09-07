"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { FeaturedItemCard } from "@/components/featured-item-card";
import {
  cityChangeEventName,
  selectedCityStorageKey,
  type SelectedCity,
} from "@/lib/location";
import type { FeaturedCatalogItem } from "@/types/catalog";

export function FeaturedCatalogItems() {
  const storedCity = useSyncExternalStore(
    (onChange) => {
      window.addEventListener(cityChangeEventName, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(cityChangeEventName, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => window.localStorage.getItem(selectedCityStorageKey),
    () => null,
  );
  const city = useMemo(() => {
    if (!storedCity) return null;
    try {
      const value = JSON.parse(storedCity) as SelectedCity;
      return Number.isSafeInteger(value.id) ? value : null;
    } catch {
      return null;
    }
  }, [storedCity]);
  const cityId = city?.id ?? null;
  const [result, setResult] = useState<{
    cityId: number;
    items: FeaturedCatalogItem[];
  } | null>(null);

  useEffect(() => {
    if (cityId === null) return;
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch("/api/itens-destaque", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cityId }),
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { items?: FeaturedCatalogItem[] };
        setResult({ cityId, items: payload.items ?? [] });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[itens-destaque] lookup failed", error);
        }
      }
    };

    void load();
    return () => controller.abort();
  }, [cityId]);

  if (!city) {
    return (
      <div className="mt-7 rounded-3xl border border-dashed border-line bg-surface p-7 text-center">
        <p className="font-black text-ink">Selecione sua cidade para ver produtos e serviços em destaque.</p>
      </div>
    );
  }

  const items = result?.cityId === city.id ? result.items : [];
  if (result?.cityId === city.id && items.length === 0) {
    return (
      <div className="mt-7 rounded-3xl border border-dashed border-line bg-surface p-7 text-center">
        <p className="font-black text-ink">Nenhum produto ou serviço em destaque nesta cidade ainda.</p>
        <p className="mt-1 text-sm font-semibold text-muted">
          Os próprios comércios escolhem o item que querem promover neste espaço.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <FeaturedItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
