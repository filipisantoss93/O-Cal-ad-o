"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { BusinessCard } from "@/components/business-card";
import {
  cityChangeEventName,
  selectedCityStorageKey,
  type SelectedCity,
} from "@/lib/location";
import { recordHighlightEvent } from "@/lib/highlights-client";
import type { Business } from "@/types/catalog";

export function FeaturedBusinesses() {
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
    businesses: Business[];
  } | null>(null);
  const displayed = useMemo(
    () => (city && result?.cityId === city.id ? result.businesses : []),
    [city, result],
  );

  useEffect(() => {
    if (!city) return;
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch("/api/destaques", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cityId: city.id }),
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { businesses?: Business[] };
        setResult({ cityId: city.id, businesses: payload.businesses ?? [] });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[destaques] highlight lookup failed", error);
        }
      }
    };

    void load();
    return () => controller.abort();
  }, [city]);

  useEffect(() => {
    recordHighlightEvent(
      displayed.map((business) => business.highlightCampaignId),
      "impression",
    );
  }, [displayed]);

  function trackStoreView(event: React.MouseEvent<HTMLDivElement>) {
    const article = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-highlight-campaign]",
    );
    const campaignId = Number(article?.dataset.highlightCampaign);
    if (Number.isSafeInteger(campaignId) && campaignId > 0) {
      recordHighlightEvent([campaignId], "store_view");
    }
  }

  if (!city) {
    return (
      <div className="mt-7 rounded-3xl border border-dashed border-line bg-canvas p-7 text-center">
        <p className="font-black text-ink">Selecione sua cidade para ver os destaques locais.</p>
      </div>
    );
  }

  if (result?.cityId === city.id && displayed.length === 0) {
    return (
      <div className="mt-7 rounded-3xl border border-dashed border-line bg-canvas p-7 text-center">
        <p className="font-black text-ink">Nenhum comércio em destaque nesta cidade ainda.</p>
        <p className="mt-1 text-sm font-semibold text-muted">
          Este espaço aparecerá somente quando um comércio real contratar destaque.
        </p>
      </div>
    );
  }

  return (
    <div
      className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4"
      onClickCapture={trackStoreView}
    >
      {displayed.map((business) => (
        <BusinessCard key={business.id} business={business} />
      ))}
    </div>
  );
}
