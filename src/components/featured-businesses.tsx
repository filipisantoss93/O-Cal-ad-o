"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { BusinessCard } from "@/components/business-card";
import { HomeFeedSection } from "@/components/home/home-feed-section";
import { useFeaturedLimit } from "@/components/use-featured-limit";
import {
  cityChangeEventName,
  selectedCityStorageKey,
  type SelectedCity,
} from "@/lib/location";
import { recordHighlightEvent } from "@/lib/highlights-client";
import type { Business } from "@/types/catalog";

export function FeaturedBusinesses() {
  const limit = useFeaturedLimit();
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
    limit: number;
    businesses: Business[];
  } | null>(null);
  const displayed = useMemo(
    () => (city && result?.cityId === city.id ? result.businesses.slice(0, limit) : []),
    [city, limit, result],
  );

  useEffect(() => {
    if (!city) return;
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch("/api/destaques", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cityId: city.id, limit }),
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { businesses?: Business[] };
        setResult({ cityId: city.id, limit, businesses: payload.businesses ?? [] });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[destaques] highlight lookup failed", error);
        }
      }
    };

    void load();
    return () => controller.abort();
  }, [city, limit]);

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

  if (!city || result?.cityId !== city.id || result.limit !== limit || displayed.length === 0) {
    return null;
  }

  return (
    <HomeFeedSection
      eyebrow="Boas escolhas por perto"
      title="Comércios em destaque"
      description="Vitrines que ganharam mais visibilidade na sua cidade."
      linkHref="/buscar"
      linkLabel="Ver mais"
      tone="surface"
    >
      <div
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:gap-4 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 xl:grid-cols-5"
        onClickCapture={trackStoreView}
      >
        {displayed.map((business) => (
          <div
            key={business.id}
            className="w-[72vw] max-w-[17.5rem] shrink-0 snap-start sm:w-[42vw] sm:max-w-[19rem] lg:w-auto lg:max-w-none lg:snap-none"
          >
            <BusinessCard
              business={business}
              compact
              imageSizes="(max-width: 640px) 72vw, (max-width: 1024px) 42vw, (max-width: 1280px) 25vw, 20vw"
            />
          </div>
        ))}
      </div>
    </HomeFeedSection>
  );
}
