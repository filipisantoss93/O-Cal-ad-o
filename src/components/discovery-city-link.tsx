"use client";

import Link from "next/link";
import { saveSelectedCity } from "@/lib/location-client";
import type { SelectedCity } from "@/lib/location";
import { citySeoSlug } from "@/lib/seo/local-landing";

export function DiscoveryCityLink({ city }: { city: SelectedCity }) {
  const href = "/cidade/" + citySeoSlug(city.name, city.stateCode);\n
  return (
    <Link
      href={href}
      onClick={() => saveSelectedCity(city)}
      className="inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-left text-sm font-extrabold text-ink transition hover:border-brand/40 hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      aria-label={"Explorar comércios em " + city.name + ", " + city.stateCode}
    >
      <span>
        {city.name} <span className="font-semibold text-muted">· {city.stateCode}</span>
      </span>
      <span aria-hidden="true" className="text-brand">→</span>
    </Link>
  );
}
