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

export function SearchBusinessResults({ businesses }: { businesses: Business[] }) {
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
  const location = useMemo(() => {
    if (!storedCity || !storedCoordinates) return null;
    try {
      const city = JSON.parse(storedCity) as SelectedCity;
      const coordinates = JSON.parse(storedCoordinates) as CurrentCoordinates;
      if (
        !Number.isSafeInteger(city.id) ||
        !Number.isFinite(coordinates.latitude) ||
        !Number.isFinite(coordinates.longitude)
      ) {
        return null;
      }
      return { city, coordinates };
    } catch {
      return null;
    }
  }, [storedCity, storedCoordinates]);
  const locationKey = location
    ? `${location.city.id}:${location.coordinates.latitude}:${location.coordinates.longitude}`
    : null;
  const [distanceResult, setDistanceResult] = useState<{
    locationKey: string;
    distances: Map<string, number>;
  } | null>(null);

  useEffect(() => {
    if (!location || !locationKey) return;

    const controller = new AbortController();
    const loadDistances = async () => {
      try {
        const response = await fetch("/api/comercios-proximos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cityId: location.city.id,
            latitude: location.coordinates.latitude,
            longitude: location.coordinates.longitude,
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
  }, [location, locationKey]);

  return (
    <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {businesses.map((business) => {
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
