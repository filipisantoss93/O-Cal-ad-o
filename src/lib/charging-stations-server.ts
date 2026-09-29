import "server-only";

import { validCoordinate, type ChargingStation } from "@/lib/charging-planner";
import { createPublicClient } from "@/lib/supabase/server";

type StationRow = {
  id: number;
  slug: string;
  name: string;
  street: string;
  address_number: string;
  neighborhood: string;
  latitude: number | string | null;
  longitude: number | string | null;
  cities: { name: string; state_code: string } | { name: string; state_code: string }[] | null;
  charging_station_details: {
    power_kw: number | string | null;
    connectors: string[] | null;
    opening_hours_text: string | null;
    access_type: string;
    source_url: string | null;
    source_checked_at: string | null;
  } | {
    power_kw: number | string | null;
    connectors: string[] | null;
    opening_hours_text: string | null;
    access_type: string;
    source_url: string | null;
    source_checked_at: string | null;
  }[] | null;
};

type StationBounds = {
  minimumLatitude: number;
  maximumLatitude: number;
  minimumLongitude: number;
  maximumLongitude: number;
};

function single<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function findChargingCityIds(search: string) {
  const supabase = createPublicClient();
  const normalized = search.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!normalized) return [];

  const stateMatch = normalized.match(/(?:^|[,\s-])([A-Za-z]{2})$/);
  const stateCode = stateMatch?.[1]?.toUpperCase();
  const cityName = stateMatch
    ? normalized.slice(0, stateMatch.index).replace(/[,\s-]+$/, "").trim()
    : normalized;

  let request = supabase.from("cities").select("id").eq("is_active", true);
  if (stateCode && !cityName) request = request.eq("state_code", stateCode);
  else {
    request = request.ilike("name", `%${cityName.replaceAll("%", "").replaceAll("_", "")}%`);
    if (stateCode) request = request.eq("state_code", stateCode);
  }

  const { data, error } = await request.limit(30);
  if (error) throw new Error(`city-lookup:${error.message}`);
  return (data ?? []).map((city) => city.id);
}

export async function loadChargingStations({
  cityIds,
  bounds,
}: {
  cityIds?: number[];
  bounds?: StationBounds;
} = {}): Promise<ChargingStation[]> {
  const supabase = createPublicClient();
  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", "eletropostos")
    .maybeSingle();

  if (categoryError || !category) throw new Error("charging-category-unavailable");
  if (cityIds && cityIds.length === 0) return [];

  const all: StationRow[] = [];
  for (let offset = 0; ; offset += 500) {
    let request = supabase
      .from("businesses")
      .select("id,slug,name,street,address_number,neighborhood,latitude,longitude,cities(name,state_code),charging_station_details(power_kw,connectors,opening_hours_text,access_type,source_url,source_checked_at)")
      .eq("category_id", category.id)
      .eq("is_active", true)
      .eq("billing_suspended", false)
      .eq("publication_status", "published")
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (cityIds) request = request.in("city_id", cityIds);
    if (bounds) {
      request = request
        .gte("latitude", bounds.minimumLatitude)
        .lte("latitude", bounds.maximumLatitude)
        .gte("longitude", bounds.minimumLongitude)
        .lte("longitude", bounds.maximumLongitude);
    }

    const { data, error } = await request.order("id").range(offset, offset + 499);
    if (error) throw new Error(`charging-catalog:${error.message}`);
    all.push(...(data ?? []) as unknown as StationRow[]);
    if (!data || data.length < 500) break;
  }

  return all.flatMap((row): ChargingStation[] => {
    const city = single(row.cities);
    const details = single(row.charging_station_details);
    const coordinate = { latitude: Number(row.latitude), longitude: Number(row.longitude) };
    if (!city || !validCoordinate(coordinate) || details?.access_type === "restricted") return [];

    return [{
      id: row.id,
      slug: row.slug,
      name: row.name,
      city: city.name,
      state: city.state_code,
      address: [row.street, row.address_number, row.neighborhood, city.name, city.state_code]
        .filter(Boolean)
        .join(", "),
      ...coordinate,
      powerKw: details?.power_kw == null ? null : Number(details.power_kw),
      connectors: details?.connectors ?? [],
      openingHours: details?.opening_hours_text ?? null,
      access: details?.access_type ?? "unknown",
      sourceUrl: details?.source_url ?? null,
      checkedAt: details?.source_checked_at ?? null,
    }];
  });
}
