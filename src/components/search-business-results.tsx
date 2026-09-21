"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { BusinessListCard } from "@/components/business-list-card";
import { loadGoogleRatings } from "@/lib/google-ratings-client";
import {
  cityChangeEventName,
  selectedCityStorageKey,
  selectedCoordinatesCookieName,
  selectedCoordinatesStorageKey,
  serializeCoordinatesCookie,
  type CurrentCoordinates,
  type SelectedCity,
} from "@/lib/location";
import { recordHighlightEvent } from "@/lib/highlights-client";
import type { Business } from "@/types/catalog";

function readStoredValue(key: string, storage: Storage) {
  return storage.getItem(key);
}

export function SearchBusinessResults({
  businesses,
  categorySlug,
  distanceOrdered,
}: {
  businesses: Business[];
  categorySlug?: string;
  distanceOrdered: boolean;
}) {
  const router = useRouter();
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
  const ratingsKey = useMemo(
    () => businesses.map((business) => business.id).join(","),
    [businesses],
  );
  const [ratingResult, setRatingResult] = useState<{
    ratingsKey: string;
    businesses: Business[];
  } | null>(null);
  const highlightKey = city
    ? `${city.id}:${categorySlug ?? "city"}`
    : null;
  const [highlightResult, setHighlightResult] = useState<{
    highlightKey: string;
    businesses: Business[];
  } | null>(null);

  const displayedBusinesses = useMemo(() => {
    const sourceBusinesses = ratingResult?.ratingsKey === ratingsKey
      ? ratingResult.businesses
      : businesses;
    const sponsoredBySlug =
      highlightKey && highlightResult?.highlightKey === highlightKey
        ? new Map(highlightResult.businesses.map((business) => [business.slug, business]))
        : new Map<string, Business>();

    const decorated = sourceBusinesses.map((business) => {
      const sponsored = sponsoredBySlug.get(business.slug);
      return sponsored
        ? {
            ...business,
            isSponsored: true,
            highlightCampaignId: sponsored.highlightCampaignId,
            sponsoredPlacement: sponsored.sponsoredPlacement,
          }
        : business;
    });

    if (distanceOrdered) return decorated;

    return decorated.sort((first, second) => {
      if (Boolean(first.isSponsored) !== Boolean(second.isSponsored)) {
        return first.isSponsored ? -1 : 1;
      }
      return 0;
    });
  }, [businesses, distanceOrdered, highlightKey, highlightResult, ratingResult, ratingsKey]);

  useEffect(() => {
    if (distanceOrdered || !coordinates) return;
    const value = serializeCoordinatesCookie(coordinates);
    if (!value) return;

    document.cookie = `${selectedCoordinatesCookieName}=${value}; Path=/; SameSite=Lax`;
    router.refresh();
  }, [coordinates, distanceOrdered, router]);

  useEffect(() => {
    if (businesses.length === 0) return;
    const controller = new AbortController();
    const loadRatings = async () => {
      const ratedBusinesses = await loadGoogleRatings(businesses, controller.signal);
      if (!controller.signal.aborted) {
        setRatingResult({ ratingsKey, businesses: ratedBusinesses as Business[] });
      }
    };
    void loadRatings();
    return () => controller.abort();
  }, [businesses, ratingsKey]);

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
      className="mt-7 space-y-3 sm:space-y-4"
      onClickCapture={trackStoreView}
    >
      {displayedBusinesses.map((business) => (
        <BusinessListCard
          key={business.id}
          business={business}
        />
      ))}
    </div>
  );
}
