"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { HomeFeedSection } from "@/components/home/home-feed-section";
import { HomeSectionSkeleton } from "@/components/home/home-section-skeleton";
import { useHomeSectionVisibility } from "@/components/home/use-home-section-visibility";
import { PromotionCard } from "@/components/promotion-card";
import {
  cityChangeEventName,
  selectedCityStorageKey,
  type SelectedCity,
} from "@/lib/location";
import type { Promotion } from "@/types/catalog";

const homePromotionLimit = 10;

export function CityPromotions() {
  const { sectionRef, shouldLoad } = useHomeSectionVisibility();
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
    if (!city || !shouldLoad) return;
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
        if (!response.ok) throw new Error("Não foi possível carregar as ofertas.");
        const payload = (await response.json()) as { promotions?: Promotion[] };
        setResult({ cityId: city.id, promotions: payload.promotions ?? [] });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[ofertas] lookup failed", error);
          setResult({ cityId: city.id, promotions: [] });
        }
      }
    };

    void load();
    return () => controller.abort();
  }, [city, shouldLoad]);

  if (!city) return null;

  if (!shouldLoad || result?.cityId !== city.id) {
    return (
      <div ref={sectionRef}>
        <HomeSectionSkeleton
          eyebrow="Vale aproveitar"
          title="Ofertas da cidade"
          description="Promoções publicadas pelos comércios locais."
          tone="canvas"
        />
      </div>
    );
  }

  const promotions = result.promotions.slice(0, homePromotionLimit);
  if (promotions.length === 0) return null;

  return (
    <div ref={sectionRef}>
      <HomeFeedSection
        eyebrow="Vale aproveitar"
        title="Ofertas da cidade"
        description="Promoções publicadas pelos comércios locais."
        tone="canvas"
      >
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overscroll-x-none overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:gap-4 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
          {promotions.map((promotion) => (
            <div
              key={promotion.id}
              className="w-[72vw] max-w-[17.5rem] shrink-0 snap-start sm:w-[42vw] sm:max-w-[19rem] lg:w-auto lg:max-w-none lg:snap-none"
            >
              <PromotionCard promotion={promotion} />
            </div>
          ))}
        </div>
      </HomeFeedSection>
    </div>
  );
}
