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
import { recordHighlightEvent } from "@/lib/highlights-client";

type NearbyBusiness = {
  id: number;
  slug: string;
  name: string;
  neighborhood: string;
  categoryName: string;
  distanceKm: number | null;
  isFeatured: boolean;
  highlightCampaignId: number | null;
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

        let payload: { businesses?: NearbyBusiness[]; error?: string } = {};
        try {
          payload = (await response.json()) as {
            businesses?: NearbyBusiness[];
            error?: string;
          };
        } catch {
          if (!response.ok) {
            throw new Error("Não foi possível carregar os comércios próximos.");
          }
        }

        if (!response.ok) {
          throw new Error(payload.error || "Não foi possível carregar os comércios próximos.");
        }
        setBusinesses(payload.businesses ?? []);
      } catch (reason: unknown) {
        if (controller.signal.aborted) return;
        console.error("[nearby-businesses] load failed", reason);
        setBusinesses([]);
        setError("Não foi possível carregar os comércios próximos. Tente novamente.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void loadBusinesses();

    return () => controller.abort();
  }, [city, coordinates]);

  useEffect(() => {
    recordHighlightEvent(
      businesses
        .slice(0, 3)
        .map((business) => business.highlightCampaignId),
      "impression",
    );
  }, [businesses]);

  if (!city) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-line bg-canvas p-4 text-center sm:mt-5 sm:rounded-2xl sm:p-5">
        <LocateIcon className="mx-auto size-5 text-brand sm:size-6" />
        <p className="mt-2 text-sm font-black text-ink sm:mt-3">Informe sua localização</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-muted">
          Use o botão “Escolher cidade” para encontrar os comércios mais próximos.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3" aria-live="polite" aria-label="Carregando comércios próximos">
        {[0, 1, 2].map((item) => (
          <div key={item} className={`h-[68px] animate-pulse rounded-xl bg-canvas sm:h-[74px] sm:rounded-2xl ${item === 2 ? "hidden sm:block" : ""}`} />
        ))}
      </div>
    );
  }

  if (error) {
    return <p role="alert" className="mt-4 rounded-xl bg-brand/8 p-3.5 text-sm font-bold text-brand-dark sm:mt-5 sm:rounded-2xl sm:p-4">{error}</p>;
  }

  if (businesses.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-line bg-canvas p-4 text-center sm:mt-5 sm:rounded-2xl sm:p-5">
        <p className="text-sm font-black text-ink">Nenhum comércio publicado em {city.name}</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-muted">
          Novas vitrines aparecem assim que são cadastradas e podem continuar em análise pela moderação.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="mt-3 text-[11px] font-bold text-muted sm:mt-4 sm:text-xs">
        {coordinates ? `Ordenados pela distância em ${city.name}` : `Comércios de ${city.name}`}
      </p>
      <div className="mt-2.5 space-y-2.5 sm:mt-3 sm:space-y-3">
        {businesses.slice(0, 3).map((business, index) => (
          <Link
            key={business.id}
            href={`/loja/${business.slug}`}
            className={`group items-center gap-2.5 rounded-xl border border-line/80 p-2.5 transition hover:border-ink/15 hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:gap-3 sm:rounded-2xl sm:p-3 ${index === 2 ? "hidden sm:flex" : "flex"}`}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-accent-dark text-xs font-black text-white sm:size-12 sm:text-sm">
              {initials(business.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 truncate text-sm font-extrabold text-ink sm:text-base">
                <span className="truncate">{business.name}</span>
                {business.isFeatured && (
                  <span className="shrink-0 rounded-full bg-accent/35 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-ink">
                    Patrocinado
                  </span>
                )}
              </span>
              <span className="mt-0.5 block truncate text-[11px] font-semibold text-muted sm:text-xs">
                {business.categoryName} · {business.neighborhood}
              </span>
            </span>
            <span className="shrink-0 text-[11px] font-black text-brand-dark sm:text-xs">
              {formatDistance(business.distanceKm)}
            </span>
          </Link>
        ))}
      </div>
      <Link
        href="/buscar"
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-ink/10 text-sm font-black text-ink transition hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:mt-4"
      >
        Explorar todos
        <ArrowRightIcon className="size-4" />
      </Link>
    </>
  );
}
