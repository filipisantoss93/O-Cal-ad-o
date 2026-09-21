"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { HomeFeedSection } from "@/components/home/home-feed-section";
import { HomeSectionSkeleton } from "@/components/home/home-section-skeleton";
import { useHomeSectionVisibility } from "@/components/home/use-home-section-visibility";
import { LocateIcon, StarIcon } from "@/components/icons";
import { detectCurrentCity, saveSelectedCity } from "@/lib/location-client";
import { compareByDistanceRatingName } from "@/lib/business-order";
import { loadGoogleRatings } from "@/lib/google-ratings-client";
import {
  cityChangeEventName,
  selectedCityStorageKey,
  selectedCoordinatesStorageKey,
  type CurrentCoordinates,
  type SelectedCity,
} from "@/lib/location";
import { recordHighlightEvent } from "@/lib/highlights-client";

const nearbyListLimit = 10;

type NearbyBusiness = {
  id: number;
  slug: string;
  name: string;
  neighborhood: string;
  categoryName: string;
  logoUrl: string | null;
  distanceKm: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  ratingSource?: "google" | null;
  isFeatured: boolean;
  highlightCampaignId: number | null;
  listingType: "business" | "public_place";
};

function formatDistance(distanceKm: number | null) {
  if (distanceKm === null) return "Na sua cidade";
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
  const router = useRouter();
  const { sectionRef, shouldLoad } = useHomeSectionVisibility("900px 0px");
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
  const [loadedRequestKey, setLoadedRequestKey] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [locationError, setLocationError] = useState("");
  const requestKey = city
    ? `${city.id}:${coordinates ? `${coordinates.latitude}:${coordinates.longitude}` : "city"}`
    : null;

  async function requestCurrentLocation() {
    if (detecting) return;
    setDetecting(true);
    setLocationError("");
    try {
      const detected = await detectCurrentCity();
      saveSelectedCity(detected, {
        latitude: detected.latitude,
        longitude: detected.longitude,
      });
      router.refresh();
    } catch (reason) {
      setLocationError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível acessar sua localização. Escolha sua cidade no topo da página.",
      );
    } finally {
      setDetecting(false);
    }
  }

  useEffect(() => {
    if (!city || !requestKey || !shouldLoad) return;

    const controller = new AbortController();
    const loadBusinesses = async () => {
      setLoading(true);
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
          if (!response.ok) throw new Error("Não foi possível carregar os locais próximos.");
        }

        if (!response.ok) {
          throw new Error(payload.error || "Não foi possível carregar os locais próximos.");
        }

        const loadedBusinesses = await loadGoogleRatings(
          payload.businesses ?? [],
          controller.signal,
        );
        const distances = new Map(
          loadedBusinesses.map((business) => [business.slug, business.distanceKm]),
        );
        setBusinesses(
          [...loadedBusinesses].sort((first, second) =>
            compareByDistanceRatingName(first, second, distances),
          ),
        );
        setLoadedRequestKey(requestKey);
      } catch (reason: unknown) {
        if (controller.signal.aborted) return;
        console.error("[nearby-businesses] load failed", reason);
        setBusinesses([]);
        setLoadedRequestKey(requestKey);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void loadBusinesses();

    return () => controller.abort();
  }, [city, coordinates, requestKey, shouldLoad]);

  const displayed = businesses.slice(0, nearbyListLimit);

  useEffect(() => {
    if (!shouldLoad) return;
    recordHighlightEvent(
      displayed.map((business) => business.highlightCampaignId),
      "impression",
    );
  }, [displayed, shouldLoad]);

  if (!city) return null;

  if (!shouldLoad || (loading && loadedRequestKey !== requestKey) || loadedRequestKey !== requestKey) {
    return (
      <div ref={sectionRef}>
        <HomeSectionSkeleton
          eyebrow="Descubra ao redor"
          title={coordinates ? "Perto de você" : "Na sua cidade"}
          description="Buscando estabelecimentos da cidade selecionada."
          tone="surface"
          variant="compact"
        />
      </div>
    );
  }

  if (displayed.length === 0) return null;

  return (
    <div ref={sectionRef}>
      <HomeFeedSection
        eyebrow="Descubra ao redor"
        title={coordinates ? "Perto de você" : `Na sua cidade: ${city.name}`}
        description={
          coordinates
            ? `Ordenados pela distância em ${city.name}.`
            : `Locais disponíveis em ${city.name}. Ative a localização para ordenar por distância.`
        }
        linkHref="/buscar"
        linkLabel="Explorar todos"
        tone="surface"
      >
        {!coordinates ? (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => void requestCurrentLocation()}
              disabled={detecting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-dark bg-canvas px-4 text-sm font-black text-brand-dark transition hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
            >
              <LocateIcon className="size-4" />
              {detecting ? "Localizando..." : "Usar minha localização"}
            </button>
            {locationError ? <p role="alert" className="mt-2 text-sm font-semibold text-brand-dark">{locationError}</p> : null}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {displayed.map((business) => {
            const hasGoogleRating =
              business.ratingSource === "google" &&
              Number(business.reviewCount ?? 0) > 0 &&
              Number(business.rating ?? 0) > 0;
            return (
              <Link
                key={business.id}
                href={`/loja/${business.slug}`}
                className="group flex min-w-0 flex-col rounded-2xl border border-line bg-canvas p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:border-ink/15 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:p-3.5"
              >
                <span className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl sm:size-12 bg-gradient-to-br from-brand to-accent-dark text-sm font-black text-white">
                    {business.logoUrl ? (
                      <Image
                        src={business.logoUrl}
                        alt={`Imagem de ${business.name}`}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : (
                      initials(business.name)
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 flex-wrap items-center gap-1">
                      <span className="min-w-0 truncate text-[13px] font-black text-ink sm:text-sm">{business.name}</span>
                      {business.isFeatured ? (
                        <span className="shrink-0 rounded-full bg-accent/35 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-ink">
                          Patrocinado
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-semibold text-muted">
                      {business.listingType === "public_place" ? "Local público" : business.categoryName}
                    </span>
                    {hasGoogleRating ? (
                      <span className="mt-1 inline-flex items-center gap-1 text-xs font-black text-ink">
                        <StarIcon className="size-3 fill-accent stroke-accent-dark" />
                        {Number(business.rating).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        <span className="font-bold text-muted">
                          ({Number(business.reviewCount).toLocaleString("pt-BR")}) · Google Maps
                        </span>
                      </span>
                    ) : null}
                  </span>
                </span>

                <span className="mt-auto flex flex-wrap items-end justify-between gap-x-2 gap-y-1 border-t border-line/70 pt-2.5 sm:mt-3">
                  <span className="min-w-0 truncate text-xs font-semibold text-muted">
                    {business.neighborhood}
                  </span>
                  <span className="shrink-0 text-xs font-black text-brand-dark">
                    {formatDistance(business.distanceKm)}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </HomeFeedSection>
    </div>
  );
}
