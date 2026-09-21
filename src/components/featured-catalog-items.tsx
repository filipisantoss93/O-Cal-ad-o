"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { FeaturedItemCard } from "@/components/featured-item-card";
import { HomeFeedSection } from "@/components/home/home-feed-section";
import { HomeSectionSkeleton } from "@/components/home/home-section-skeleton";
import { useHomeSectionVisibility } from "@/components/home/use-home-section-visibility";
import { useFeaturedLimit } from "@/components/use-featured-limit";
import {
  cityChangeEventName,
  selectedCityStorageKey,
  type SelectedCity,
} from "@/lib/location";
import type { FeaturedCatalogItem } from "@/types/catalog";

export function FeaturedCatalogItems() {
  const limit = useFeaturedLimit();
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
  const cityId = city?.id ?? null;
  const [result, setResult] = useState<{
    cityId: number;
    limit: number;
    items: FeaturedCatalogItem[];
  } | null>(null);

  useEffect(() => {
    if (cityId === null || !shouldLoad) return;
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch("/api/itens-destaque", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cityId, limit }),
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Não foi possível carregar os itens em destaque.");
        const payload = (await response.json()) as { items?: FeaturedCatalogItem[] };
        setResult({ cityId, limit, items: payload.items ?? [] });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[itens-destaque] lookup failed", error);
          setResult({ cityId, limit, items: [] });
        }
      }
    };

    void load();
    return () => controller.abort();
  }, [cityId, limit, shouldLoad]);

  if (!city) return null;

  if (!shouldLoad || result?.cityId !== city.id || result.limit !== limit) {
    return (
      <div ref={sectionRef}>
        <HomeSectionSkeleton
          eyebrow="Escolhidos pelas lojas"
          title="Produtos e serviços em destaque"
          description="Itens que os próprios comércios escolheram para ganhar mais visibilidade."
          tone="canvas"
        />
      </div>
    );
  }

  const items = result.items.slice(0, limit);
  if (items.length < 2) return null;

  return (
    <div ref={sectionRef}>
      <HomeFeedSection
        eyebrow="Escolhidos pelas lojas"
        title="Produtos e serviços em destaque"
        description="Itens que os próprios comércios escolheram para ganhar mais visibilidade."
        tone="canvas"
      >
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => (
            <div
              key={item.id}
              className="min-w-0"
            >
              <FeaturedItemCard item={item} />
            </div>
          ))}
        </div>
      </HomeFeedSection>
    </div>
  );
}
