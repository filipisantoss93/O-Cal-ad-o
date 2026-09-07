"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { BusinessCard } from "@/components/business-card";
import {
  cityChangeEventName,
  selectedCityStorageKey,
  selectedCoordinatesStorageKey,
  type CurrentCoordinates,
  type SelectedCity,
} from "@/lib/location";
import { recordHighlightEvent } from "@/lib/highlights-client";
import type { Business } from "@/types/catalog";

type NearbyBusiness = {
  slug: string;
  distanceKm: number | null;
};

function readStoredValue(key: string, storage: Storage) {
  return storage.getItem(key);
}

function formatDistance(distanceKm: number) {
  if (distanceKm < 1) return `${Math.max(1, Math.round(distanceKm * 1_000))} m`;
  return `${distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}

export function SearchBusinessResults({
  businesses,
  categorySlug,
}: {
  businesses: Business[];
  categorySlug?: string;
}) {
  const storedCity = useSyncExternalStore(
    (onChange) => {
      window.addEventListener(cityChangeEventName, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(cityChangeEventName, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => readStoredValue(selectedCityStorageKey, window.localStorage),
    () => null,
  );
  const storedCoordinates = useSyncExternalStore(
    (onChange) => {
      window.addEventListener(cityChangeEventName, onChange);
      return () => window.removeEventListener(cityChangeEventName, onChange);
    },
    () => readStoredValue(selectedCoordinatesStorageKey, window.sessionStorage),
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
  const coordinates = useMemo(() => {
    if (!storedCoordinates) return null;
    try {
      const value = JSON.parse(storedCoordinates) as CurrentCoordinates;
      return Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
        ? value
        : null;
    } catch {
      return null;
    }
  }, [storedCoordinates]);
  const locationKey = city && coordinates
    ? `${city.id}:${coordinates.latitude}:${coordinates.longitude}`
    : null;
  const [distanceResult, setDistanceResult] = useState<{
    locationKey: string;
    distances: Map<string, number>;
  } | null>(null);
  const highlightKey = city
    ? `${city.id}:${categorySlug ?? "city"}`
    : null;
  const [highlightResult, setHighlightResult] = useState<{
    highlightKey: string;
    businesses: Business[];
  } | null>(null);

  const displayedBusinesses = useMemo(() => {
    if (!highlightKey || highlightResult?.highlightKey !== highlightKey) {
      return businesses;
    }
    const sponsoredBySlug = new Map(
      highlightResult.businesses.map((business) => [business.slug, business]),
    );
    return businesses
      .map((business) => {
        const sponsored = sponsoredBySlug.get(business.slug);
        return sponsored
          ? {
              ...business,
              isSponsored: true,
              highlightCampaignId: sponsored.highlightCampaignId,
              sponsoredPlacement: sponsored.sponsoredPlacement,
            }
          : business;
      })
      .sort((first, second) => {
        if (Boolean(first.isSponsored) !== Boolean(second.isSponsored)) {
          return first.isSponsored ? -1 : 1;
        }
        return 0;
      });
  }, [businesses, highlightKey, highlightResult]);

  useEffect(() => {
    if (!city || !coordinates || !locationKey) return;

    const controller = new AbortController();
    const loadDistances = async () => {
      try {
        const response = await fetch("/api/comercios-proximos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cityId: city.id,
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
          }),
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { businesses?: NearbyBusiness[] };
        setDistanceResult({
          locationKey,
          distances: new Map(
            (payload.businesses ?? [])
              .filter(
                (business): business is NearbyBusiness & { distanceKm: number } =>
                  typeof business.distanceKm === "number",
              )
              .map((business) => [business.slug, business.distanceKm]),
          ),
        });
      } catch (error) {
        if (!controller.signal.aborted) console.error("[buscar] distance lookup failed", error);
      }
    };
    void loadDistances();
    return () => controller.abort();
  }, [city, coordinates, locationKey]);

  useEffect(() => {
    if (!city || !highlightKey) return;

    const controller = new AbortController();
    const loadHighlights = async () => {
      try {
        const response = await fetch("/api/destaques", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cityId: city.id,
            categorySlug,
          }),
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { businesses?: Business[] };
        setHighlightResult({
          highlightKey,
          businesses: payload.businesses ?? [],
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[buscar] highlight lookup failed", error);
        }
      }
    };
    void loadHighlights();
    return () => controller.abort();
  }, [categorySlug, city, highlightKey]);

  useEffect(() => {
    recordHighlightEvent(
      displayedBusinesses.map((business) => business.highlightCampaignId),
      "impression",
    );
  }, [displayedBusinesses]);

  function trackStoreView(event: React.MouseEvent<HTMLDivElement>) {
    const article = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-highlight-campaign]",
    );
    const campaignId = Number(article?.dataset.highlightCampaign);
    if (Number.isSafeInteger(campaignId) && campaignId > 0) {
      recordHighlightEvent([campaignId], "store_view");
    }
  }

  return (
    <div
      className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4"
      onClickCapture={trackStoreView}
    >
      {displayedBusinesses.map((business) => {
        const distanceKm =
          distanceResult?.locationKey === locationKey
            ? distanceResult.distances.get(business.slug)
            : undefined;
        return (
          <BusinessCard
            key={business.id}
            business={
              distanceKm === undefined
                ? business
                : { ...business, distance: formatDistance(distanceKm) }
            }
          />
        );
      })}
    </div>
  );
}
