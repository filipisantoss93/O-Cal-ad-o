"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { PromotionCard } from "@/components/promotion-card";
import {
  cityChangeEventName,
  selectedCityStorageKey,
  type SelectedCity,
} from "@/lib/location";
import type { Promotion } from "@/types/catalog";

export function CityPromotions() {
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
  const [result, setResult] = useState<{
    cityId: number;
    promotions: Promotion[];
  } | null>(null);

  useEffect(() => {
    if (!city) return;
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch("/api/ofertas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cityId: city.id }),
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { promotions?: Promotion[] };
        setResult({ cityId: city.id, promotions: payload.promotions ?? [] });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[ofertas] lookup failed", error);
        }
      }
    };

    void load();
    return () => controller.abort();
  }, [city]);

  if (!city) {
    return (
      <div className="mt-7 rounded-3xl border border-dashed border-line bg-surface p-7 text-center">
        <p className="font-black text-ink">Selecione sua cidade para ver as ofertas locais.</p>
      </div>
    );
  }

  const promotions = result?.cityId === city.id ? result.promotions : [];
  if (result?.cityId === city.id && promotions.length === 0) {
    return (
      <div className="mt-7 rounded-3xl border border-dashed border-line bg-surface p-7 text-center">
        <p className="font-black text-ink">Nenhuma oferta publicada nesta cidade ainda.</p>
        <p className="mt-1 text-sm font-semibold text-muted">
          Assim que um comércio publicar uma promoção real, ela aparecerá aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {promotions.map((promotion) => (
        <PromotionCard key={promotion.id} promotion={promotion} />
      ))}
    </div>
  );
}
