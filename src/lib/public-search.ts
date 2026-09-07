import "server-only";

import { getBusinessSchedule, type BusinessHour } from "@/lib/business-hours";
import { createPublicClient } from "@/lib/supabase/server";
import type { Business } from "@/types/catalog";

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

function emptyResult(page: number): PublicBusinessSearchResult {
  return {
    businesses: [],
    total: 0,
    page,
    pageSize: PUBLIC_SEARCH_PAGE_SIZE,
    totalPages: 0,
  };
}

export async function searchPublicBusinesses(
  query?: string,
  categorySlug?: string,
  cityId?: number,
  requestedPage = 1,
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
    fn: "search_public_business_ids",
    args: {
      p_city_id: number;
      p_query: string;
      p_category_slug: string | null;
      p_limit: number;
      p_offset: number;
    },
  ) => Promise<{ data: SearchIdRow[] | null; error: { message: string } | null }>;

  const { data: matches, error: searchError } = await rpc(
    "search_public_business_ids",
    {
      p_city_id: cityId,
      p_query: query?.trim() ?? "",
      p_category_slug: categorySlug ?? null,
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
  const { data: rows, error } = await supabase
    .from("businesses")
    .select(
      "id, slug, name, description, tags, whatsapp_e164, street, address_number, complement, neighborhood, categories(slug, name), cities(name, state_code, timezone)",
    )
    .in("id", businessIds)
    .eq("status", "approved")
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

  const { data: hours } = await supabase
    .from("business_hours")
    .select("business_id, weekday, opens_at, closes_at, is_closed")
    .in("business_id", businessIds)
    .order("weekday")
    .order("display_order");

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

    return [{
      id: String(row.id),
      slug: row.slug,
      name: row.name,
      description: row.description || `Conheça a ${row.name} no O Calçadão.`,
      categorySlug: category.slug,
      categoryName: category.name,
      neighborhood: row.neighborhood,
      address: [row.street, row.address_number, row.complement].filter(Boolean).join(", "),
      distance: `${city.name} - ${city.state_code}`,
      rating: 0,
      reviewCount: 0,
      ...schedule,
      initials: initials(row.name),
      palette: palettes[row.id % palettes.length],
      verified: true,
      tags: [...(row.tags ?? []), category.name, row.neighborhood].slice(0, 12),
      whatsapp: row.whatsapp_e164.replace(/\D/g, ""),
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
