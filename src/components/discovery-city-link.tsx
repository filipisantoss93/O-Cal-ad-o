"use client";

import { useRouter } from "next/navigation";
import { saveSelectedCity } from "@/lib/location-client";
import type { SelectedCity } from "@/lib/location";

export function DiscoveryCityLink({ city }: { city: SelectedCity }) {
  const router = useRouter();
  function selectCity() {
    saveSelectedCity(city);
    router.push("/buscar");
    router.refresh();
  }
  return (
    <button type="button" onClick={selectCity}
      className="inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-left text-sm font-extrabold text-ink transition hover:border-brand/40 hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      aria-label={"Explorar comércios em " + city.name + ", " + city.stateCode}>
      <span>{city.name} <span className="font-semibold text-muted">· {city.stateCode}</span></span>
      <span aria-hidden="true" className="text-brand">→</span>
    </button>
  );
}
