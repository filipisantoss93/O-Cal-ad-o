"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { MapPinIcon } from "@/components/icons";
import { recordHighlightEvent } from "@/lib/highlights-client";
import type { RegionalBanner } from "@/lib/highlights/public";
import {
  cityChangeEventName,
  selectedCityStorageKey,
  type SelectedCity,
} from "@/lib/location";

export function RegionalPaidBanners() {
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
  const [result, setResult] = useState<{ cityId: number; banners: RegionalBanner[] } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const banners = city && result?.cityId === city.id ? result.banners : [];
  const activeBanner = banners[activeIndex % Math.max(1, banners.length)];

  useEffect(() => {
    if (!city) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/banners", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cityId: city.id }),
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { banners?: RegionalBanner[] };
        setActiveIndex(0);
        setResult({ cityId: city.id, banners: payload.banners ?? [] });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[banners] regional lookup failed", error);
        }
      }
    };
    void load();
    return () => controller.abort();
  }, [city]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % banners.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  useEffect(() => {
    if (activeBanner) {
      recordHighlightEvent([activeBanner.campaignId], "impression");
    }
  }, [activeBanner]);

  if (!city || !activeBanner) return null;

  return (
    <section className="bg-canvas px-4 pb-8 pt-8 sm:px-6 lg:px-8" aria-label="Publicidade regional">
      <div className="mx-auto max-w-7xl">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-muted">
            <MapPinIcon className="size-4 text-brand" /> Publicidade em {activeBanner.cityName}
          </p>
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-black uppercase tracking-wide text-muted">
            Patrocinado
          </span>
        </div>

        <Link
          href={`/loja/${activeBanner.businessSlug}`}
          onClick={() => recordHighlightEvent([activeBanner.campaignId], "store_view")}
          aria-label={`Abrir ${activeBanner.businessName}`}
          title={`${activeBanner.businessName} — ${activeBanner.title}`}
          className="group relative block aspect-[16/5] overflow-hidden rounded-[2rem] bg-surface shadow-[0_22px_55px_rgba(31,45,42,0.16)] outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4"
        >
          <Image
            src={activeBanner.imageUrl}
            alt={`Publicidade de ${activeBanner.businessName}: ${activeBanner.title}`}
            fill
            sizes="(min-width: 1280px) 1216px, (min-width: 768px) calc(100vw - 48px), calc(100vw - 32px)"
            className="object-cover transition duration-500 group-hover:scale-[1.01]"
          />
        </Link>

        {banners.length > 1 && (
          <div className="mt-4 flex justify-center gap-2" aria-label="Selecionar banner">
            {banners.map((banner, index) => (
              <button
                key={banner.campaignId}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Exibir anúncio ${index + 1}`}
                aria-current={index === activeIndex}
                className={`h-2.5 rounded-full transition-all ${index === activeIndex ? "w-8 bg-brand" : "w-2.5 bg-line hover:bg-muted/50"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
