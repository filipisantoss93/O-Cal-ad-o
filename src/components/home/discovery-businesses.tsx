"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { BusinessCard } from "@/components/business-card";
import { HomeFeedSection } from "@/components/home/home-feed-section";
import { HomeSectionSkeleton } from "@/components/home/home-section-skeleton";
import { useHomeSectionVisibility } from "@/components/home/use-home-section-visibility";
import {
  cityChangeEventName,
  selectedCityStorageKey,
  type SelectedCity,
} from "@/lib/location";
import type { Business } from "@/types/catalog";

export function DiscoveryBusinesses() {
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
    businesses: Business[];
  } | null>(null);

  useEffect(() => {
    if (!city || !shouldLoad) return;
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch("/api/descobrir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cityId: city.id }),
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Não foi possível carregar novas vitrines.");
        const payload = (await response.json()) as { businesses?: Business[] };
        setResult({ cityId: city.id, businesses: payload.businesses ?? [] });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[discovery-businesses] lookup failed", error);
          setResult({ cityId: city.id, businesses: [] });
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
          eyebrow="Descubra algo novo"
          title={`Mais vitrines em ${city.name}`}
          description="Uma seleção variada de estabelecimentos da cidade para você conhecer."
          tone="surface"
        />
      </div>
    );
  }

  if (result.businesses.length === 0) return null;

  return (
    <div ref={sectionRef}>
      <HomeFeedSection
        eyebrow="Descubra algo novo"
        title={`Mais vitrines em ${city.name}`}
        description="Uma seleção variada de estabelecimentos da cidade para você conhecer."
        linkHref="/buscar"
        linkLabel="Explorar toda a cidade"
        tone="surface"
      >
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:gap-4 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 xl:grid-cols-6">
          {result.businesses.map((business) => (
            <div
              key={business.id}
              className="w-[72vw] max-w-[17.5rem] shrink-0 snap-start sm:w-[42vw] sm:max-w-[19rem] lg:w-auto lg:max-w-none lg:snap-none"
            >
              <BusinessCard business={business} compact />
            </div>
          ))}
        </div>
      </HomeFeedSection>
    </div>
  );
}
