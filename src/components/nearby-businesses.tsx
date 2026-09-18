"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { HomeFeedSection } from "@/components/home/home-feed-section";
import { HomeSectionSkeleton } from "@/components/home/home-section-skeleton";
import { useHomeSectionVisibility } from "@/components/home/use-home-section-visibility";
import { StarIcon } from "@/components/icons";
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
  const [loadedCityId, setLoadedCityId] = useState<number | null>(null);

  useEffect(() => {
    if (!city || !shouldLoad) return;

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
        setLoadedCityId(city.id);
      } catch (reason: unknown) {
        if (controller.signal.aborted) return;
        console.error("[nearby-businesses] load failed", reason);
        setBusinesses([]);
        setLoadedCityId(city.id);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void loadBusinesses();

    return () => controller.abort();
  }, [city, coordinates, shouldLoad]);

  const displayed = businesses.slice(0, nearbyListLimit);

  useEffect(() => {
    if (!shouldLoad) return;
    recordHighlightEvent(
      displayed.map((business) => business.highlightCampaignId),
      "impression",
    );
  }, [displayed, shouldLoad]);

  if (!city) return null;

  if (!shouldLoad || (loading && loadedCityId !== city.id) || loadedCityId !== city.id) {
    return (
      <div ref={sectionRef}>
        <HomeSectionSkeleton
          eyebrow="Descubra ao redor"
          title="Perto de você"
          description="Buscando locais próximos na sua cidade."
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
        title="Perto de você"
        description={
          coordinates
            ? `Ordenados pela distância em ${city.name}.`
            : `Locais disponíveis em ${city.name}. Ative a localização para ordenar por distância.`
        }
        linkHref="/buscar"
        linkLabel="Explorar todos"
        tone="surface"
      >
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overscroll-x-contain overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:gap-4 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
          {displayed.map((business) => {
            const hasGoogleRating =
              business.ratingSource === "google" &&
              Number(business.reviewCount ?? 0) > 0 &&
              Number(business.rating ?? 0) > 0;
            return (
              <Link
                key={business.id}
                href={`/loja/${business.slug}`}
                className="group flex w-[76vw] max-w-[20rem] shrink-0 snap-start flex-col rounded-2xl border border-line bg-canvas p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-ink/15 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:w-[42vw] lg:w-auto lg:max-w-none lg:snap-none"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-brand to-accent-dark text-sm font-black text-white">
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
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-black text-ink">{business.name}</span>
                      {business.isFeatured ? (
                        <span className="shrink-0 rounded-full bg-accent/35 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-ink">
                          Patrocinado
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] font-semibold text-muted">
                      {business.listingType === "public_place" ? "Local público" : business.categoryName}
                    </span>
                    {hasGoogleRating ? (
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-black text-ink">
                        <StarIcon className="size-3 fill-accent stroke-accent-dark" />
                        {Number(business.rating).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        <span className="font-bold text-muted">
                          ({Number(business.reviewCount).toLocaleString("pt-BR")}) · Google Maps
                        </span>
                      </span>
                    ) : null}
                  </span>
                </span>

                <span className="mt-3 flex items-end justify-between gap-3 border-t border-line/70 pt-2.5">
                  <span className="min-w-0 truncate text-[11px] font-semibold text-muted">
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
