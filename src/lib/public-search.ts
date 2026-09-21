import "server-only";

import { getBusinessSchedule, type BusinessHour } from "@/lib/business-hours";
import { loadResolvedBusinessLogoPaths } from "@/lib/business-logo";
import type { CurrentCoordinates } from "@/lib/location";
import { publicMediaUrl } from "@/lib/merchant/media";
import { createPublicClient } from "@/lib/supabase/server";
import type { Business } from "@/types/catalog";
import type { ListingType, PublicPlaceKind } from "@/types/catalog";

const palettes = [
  "from-[#ef6a43] to-[#f5a640]",
  "from-[#183a3a] to-[#2b7770]",
  "from-[#9f5968] to-[#dd9b7c]",
  "from-[#7c3d71] to-[#d66e9e]",
];

export const PUBLIC_SEARCH_PAGE_SIZE = 12;

type SearchIdRow = {
  business_id: number;
  total_count: number;
  distance_km: number | null;
};

export type PublicBusinessSearchResult = {
  businesses: Business[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
}

function formatDistance(distanceKm: number) {
  if (distanceKm < 1) return `${Math.max(1, Math.round(distanceKm * 1_000))} m`;
  return `${distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}

function emptyResult(page: number): PublicBusinessSearchResult {
  return {
    businesses: [],
    total: 0,
    page,
    pageSize: PUBLIC_SEARCH_PAGE_SIZE,
    totalPages: 0,
  };
}

function listingType(value: string): ListingType {
  return value === "public_place" ? "public_place" : "business";
}

export async function searchPublicBusinesses(
  query?: string,
  categorySlug?: string,
  cityId?: number,
  requestedPage = 1,
  coordinates?: CurrentCoordinates | null,
): Promise<PublicBusinessSearchResult> {
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? requestedPage
    : 1;
  if (!cityId || !Number.isInteger(cityId) || cityId <= 0) {
    return emptyResult(page);
  }

  const supabase = createPublicClient();
  const offset = (page - 1) * PUBLIC_SEARCH_PAGE_SIZE;
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: "search_public_business_ids_by_location",
    args: {
      p_city_id: number;
      p_query: string;
      p_category_slug: string | null;
      p_latitude: number | null;
      p_longitude: number | null;
      p_limit: number;
      p_offset: number;
    },
  ) => Promise<{ data: SearchIdRow[] | null; error: { message: string } | null }>;

  const { data: matches, error: searchError } = await rpc(
    "search_public_business_ids_by_location",
    {
      p_city_id: cityId,
      p_query: query?.trim() ?? "",
      p_category_slug: categorySlug ?? null,
      p_latitude: coordinates?.latitude ?? null,
      p_longitude: coordinates?.longitude ?? null,
      p_limit: PUBLIC_SEARCH_PAGE_SIZE,
      p_offset: offset,
    },
  );

  if (searchError) {
    console.error("[public-search] paginated search failed", searchError.message);
    return emptyResult(page);
  }

  if (!matches?.length) {
    return emptyResult(page);
  }

  const total = Number(matches[0]?.total_count ?? 0);
  const businessIds = matches.map((row) => row.business_id);
  const matchesById = new Map(matches.map((row) => [row.business_id, row]));
  const { data: rows, error } = await supabase
    .from("businesses")
    .select(
      "id, slug, name, description, listing_type, public_place_kind, official_source_url, status, tags, logo_path, cover_path, whatsapp_e164, street, address_number, complement, neighborhood, categories(slug, name), cities(name, state_code, timezone)",
    )
    .in("id", businessIds)
    .eq("publication_status", "published")
    .eq("is_active", true)
    .eq("city_id", cityId)
    .eq("billing_suspended", false);

  if (error || !rows?.length) {
    if (error) console.error("[public-search] business detail lookup failed", error.message);
    return {
      ...emptyResult(page),
      total,
      totalPages: Math.ceil(total / PUBLIC_SEARCH_PAGE_SIZE),
    };
  }

  const [{ data: hours }, resolvedLogoPaths] = await Promise.all([
    supabase
      .from("business_hours")
      .select("business_id, weekday, opens_at, closes_at, is_closed")
      .in("business_id", businessIds)
      .order("weekday")
      .order("display_order"),
    loadResolvedBusinessLogoPaths(businessIds),
  ]);

  const hoursByBusiness = new Map<number, BusinessHour[]>();
  for (const item of hours ?? []) {
    const businessHours = hoursByBusiness.get(item.business_id) ?? [];
    businessHours.push(item);
    hoursByBusiness.set(item.business_id, businessHours);
  }

  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const businesses = businessIds.flatMap((businessId): Business[] => {
    const row = rowsById.get(businessId);
    if (!row?.categories || !row.cities) return [];
    const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    const city = Array.isArray(row.cities) ? row.cities[0] : row.cities;
    if (!category || !city) return [];
    const schedule = getBusinessSchedule(
      hoursByBusiness.get(row.id) ?? [],
      city.timezone,
    );
    const distanceKm = matchesById.get(row.id)?.distance_km;
    const hasDistance = typeof distanceKm === "number" && Number.isFinite(distanceKm);

    return [{
      id: String(row.id),
      slug: row.slug,
      name: row.name,
      description:
        row.description ||
        (row.listing_type === "public_place"
          ? `Consulte as informações de ${row.name}.`
          : `Conheça a ${row.name} no O Calçadão.`),
      listingType: listingType(row.listing_type),
      publicPlaceKind: row.public_place_kind as PublicPlaceKind | null,
      officialSourceUrl: row.official_source_url,
      categorySlug: category.slug,
      categoryName: category.name,
      neighborhood: row.neighborhood,
      address: [row.street, row.address_number, row.complement].filter(Boolean).join(", "),
      distance: hasDistance ? formatDistance(distanceKm) : `${city.name} - ${city.state_code}`,
      rating: 0,
      reviewCount: 0,
      ...schedule,
      initials: initials(row.name),
      palette: palettes[row.id % palettes.length],
      logoUrl: publicMediaUrl(supabase, resolvedLogoPaths.get(row.id) ?? row.logo_path),
      coverUrl: publicMediaUrl(supabase, row.cover_path),
      verified: row.status === "approved",
      tags: [...(row.tags ?? []), category.name, row.neighborhood].slice(0, 12),
      whatsapp: row.whatsapp_e164?.replace(/\D/g, "") ?? null,
      products: [],
    }];
  });

  return {
    businesses,
    total,
    page,
    pageSize: PUBLIC_SEARCH_PAGE_SIZE,
    totalPages: Math.ceil(total / PUBLIC_SEARCH_PAGE_SIZE),
  };
}
