"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ArrowRightIcon, LocateIcon } from "@/components/icons";
import {
  cityChangeEventName,
  selectedCityStorageKey,
  selectedCoordinatesStorageKey,
  type CurrentCoordinates,
  type SelectedCity,
} from "@/lib/location";

type NearbyBusiness = {
  id: number;
  slug: string;
  name: string;
  neighborhood: string;
  categoryName: string;
  distanceKm: number | null;
  isFeatured: boolean;
};

function formatDistance(distanceKm: number | null) {
  if (distanceKm === null) return "na sua cidade";
  if (distanceKm < 1) return `${Math.max(1, Math.round(distanceKm * 1_000))} m`;
  return `${distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
}

export function NearbyBusinesses() {
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
      return JSON.parse(storedCity) as SelectedCity;
    } catch {
      return null;
    }
  }, [storedCity]);
  const storedCoordinates = useSyncExternalStore(
    (onChange) => {
      window.addEventListener(cityChangeEventName, onChange);
      return () => window.removeEventListener(cityChangeEventName, onChange);
    },
    () => window.sessionStorage.getItem(selectedCoordinatesStorageKey),
    () => null,
  );
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
  const [businesses, setBusinesses] = useState<NearbyBusiness[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!city) return;

    const controller = new AbortController();
    const loadBusinesses = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/comercios-proximos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cityId: city.id, ...coordinates }),
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          businesses?: NearbyBusiness[];
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error);
        setBusinesses(payload.businesses ?? []);
      } catch (reason: unknown) {
        if (controller.signal.aborted) return;
        setBusinesses([]);
        setError(
          reason instanceof Error && reason.message
            ? reason.message
            : "Não foi possível carregar os comércios próximos.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void loadBusinesses();

    return () => controller.abort();
  }, [city, coordinates]);

  if (!city) {
    return (
      <div className="mt-5 rounded-2xl border border-dashed border-line bg-canvas p-5 text-center">
        <LocateIcon className="mx-auto size-6 text-brand" />
        <p className="mt-3 text-sm font-black text-ink">Informe sua localização</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-muted">
          Use o botão “Escolher cidade” para encontrar os comércios mais próximos.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-5 space-y-3" aria-live="polite" aria-label="Carregando comércios próximos">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-[74px] animate-pulse rounded-2xl bg-canvas" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p role="alert" className="mt-5 rounded-2xl bg-brand/8 p-4 text-sm font-bold text-brand-dark">{error}</p>;
  }

  if (businesses.length === 0) {
    return (
      <div className="mt-5 rounded-2xl border border-dashed border-line bg-canvas p-5 text-center">
        <p className="text-sm font-black text-ink">Nenhum comércio publicado em {city.name}</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-muted">
          Novas vitrines aparecerão aqui depois de aprovadas.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="mt-4 text-xs font-bold text-muted">
        {coordinates ? `Ordenados pela distância em ${city.name}` : `Comércios de ${city.name}`}
      </p>
      <div className="mt-3 space-y-3">
        {businesses.slice(0, 3).map((business) => (
          <Link
            key={business.id}
            href={`/loja/${business.slug}`}
            className="group flex items-center gap-3 rounded-2xl border border-line/80 p-3 transition hover:border-ink/15 hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-accent-dark text-sm font-black text-white">
              {initials(business.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-extrabold text-ink">{business.name}</span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-muted">
                {business.categoryName} · {business.neighborhood}
              </span>
            </span>
            <span className="shrink-0 text-xs font-black text-brand-dark">
              {formatDistance(business.distanceKm)}
            </span>
          </Link>
        ))}
      </div>
      <Link
        href="/buscar"
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-ink/10 text-sm font-black text-ink transition hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        Explorar todos
        <ArrowRightIcon className="size-4" />
      </Link>
    </>
  );
}
