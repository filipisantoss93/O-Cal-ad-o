import { createPublicClient } from "@/lib/supabase/server";
import { validCoordinate, distanceKm, type ChargingStation } from "@/lib/charging-planner";

export const revalidate = 0;

type StationRow = {
  id: number; slug: string; name: string; street: string; address_number: string;
  neighborhood: string; latitude: number | string | null; longitude: number | string | null;
  cities: { name: string; state_code: string } | { name: string; state_code: string }[] | null;
  charging_station_details: {
    power_kw: number | string | null; connectors: string[] | null;
    opening_hours_text: string | null; access_type: string;
    source_url: string | null; source_checked_at: string | null;
  } | { power_kw: number | string | null; connectors: string[] | null;
    opening_hours_text: string | null; access_type: string;
    source_url: string | null; source_checked_at: string | null }[] | null;
};

function single<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = params.get("lat");
  const lon = params.get("lon");
  const hasCoordinates = lat !== null || lon !== null;
  const position = { latitude: Number(lat), longitude: Number(lon) };
  if (hasCoordinates && (lat === null || lon === null || !validCoordinate(position))) {
    return Response.json({ error: "Coordenadas inválidas." }, { status: 400 });
  }
  const supabase = createPublicClient();
  const { data: category, error: categoryError } = await supabase.from("categories")
    .select("id").eq("slug", "eletropostos").maybeSingle();
  if (categoryError || !category) return Response.json({ error: "Categoria indisponível." }, { status: 503 });

  const all: StationRow[] = [];
  for (let offset = 0; offset < 5000; offset += 500) {
    const { data, error } = await supabase.from("businesses")
      .select("id,slug,name,street,address_number,neighborhood,latitude,longitude,cities(name,state_code),charging_station_details(power_kw,connectors,opening_hours_text,access_type,source_url,source_checked_at)")
      .eq("category_id", category.id).eq("is_active", true).eq("billing_suspended", false)
      .eq("publication_status", "published").not("latitude", "is", null).not("longitude", "is", null)
      .order("id").range(offset, offset + 499);
    if (error) {
      console.error("[eletropostos] catálogo indisponível", error.message);
      return Response.json({ error: "Não foi possível carregar os eletropostos." }, { status: 503 });
    }
    all.push(...(data ?? []) as unknown as StationRow[]);
    if (!data || data.length < 500) break;
  }
  const stations: ChargingStation[] = all.flatMap(row => {
    const city = single(row.cities);
    const details = single(row.charging_station_details);
    const coordinate = { latitude: Number(row.latitude), longitude: Number(row.longitude) };
    if (!city || !validCoordinate(coordinate)) return [];
    return [{
      id: row.id, slug: row.slug, name: row.name, city: city.name, state: city.state_code,
      address: [row.street, row.address_number, row.neighborhood, city.name, city.state_code].filter(Boolean).join(", "),
      ...coordinate, powerKw: details?.power_kw == null ? null : Number(details.power_kw),
      connectors: details?.connectors ?? [], openingHours: details?.opening_hours_text ?? null,
      access: details?.access_type ?? "unknown", sourceUrl: details?.source_url ?? null,
      checkedAt: details?.source_checked_at ?? null,
    }];
  });
  if (hasCoordinates) stations.sort((a, b) => distanceKm(position, a) - distanceKm(position, b));
  else stations.sort((a, b) => a.city.localeCompare(b.city, "pt-BR") || a.name.localeCompare(b.name, "pt-BR"));
  return Response.json({ stations, total: stations.length }, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=120, stale-while-revalidate=240" },
  });
}
