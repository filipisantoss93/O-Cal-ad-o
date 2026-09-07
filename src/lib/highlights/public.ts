import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBusinessSchedule, type BusinessHour } from "@/lib/business-hours";
import type { Business } from "@/types/catalog";
import type { Database } from "@/types/database";

const palettes = [
  "from-[#ef6a43] to-[#f5a640]",
  "from-[#183a3a] to-[#2b7770]",
  "from-[#9f5968] to-[#dd9b7c]",
  "from-[#7c3d71] to-[#d66e9e]",
];

type Placement = "city" | "category" | "combo";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
}

export async function getPublicFeaturedBusinesses(
  supabase: SupabaseClient<Database>,
  cityId: number,
  categoryId?: number,
): Promise<Business[]> {
  const now = new Date().toISOString();
  let query = supabase
    .from("highlight_campaigns")
    .select(
      "id, placement, businesses!inner(id, slug, name, description, whatsapp_e164, street, address_number, complement, neighborhood, categories(slug, name), cities(name, state_code, timezone))",
    )
    .eq("city_id", cityId)
    .eq("status", "active")
    .lte("starts_at", now)
    .gt("ends_at", now)
    .eq("businesses.status", "approved")
    .eq("businesses.is_active", true)
    .eq("businesses.billing_suspended", false)
    .not("businesses.logo_path", "is", null)
    .not("businesses.cover_path", "is", null);

  if (categoryId) {
    query = query
      .eq("category_id", categoryId)
      .in("placement", ["category", "combo"]);
  } else {
    query = query.in("placement", ["city", "combo"]);
  }

  const { data: campaigns, error } = await query.limit(100);
  if (error || !campaigns?.length) return [];

  const businessIds = campaigns
    .map((campaign) => Number(campaign.businesses?.id))
    .filter((id) => Number.isSafeInteger(id) && id > 0);
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

  return campaigns.flatMap((campaign): Business[] => {
    const row = campaign.businesses;
    if (!row?.categories || !row.cities) return [];
    const category = Array.isArray(row.categories)
      ? row.categories[0]
      : row.categories;
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
      description:
        row.description || `Conheça a ${row.name} no O Calçadão.`,
      categorySlug: category.slug,
      categoryName: category.name,
      neighborhood: row.neighborhood,
      address: [row.street, row.address_number, row.complement]
        .filter(Boolean)
        .join(", "),
      distance: `${city.name} - ${city.state_code}`,
      rating: 0,
      reviewCount: 0,
      ...schedule,
      initials: initials(row.name),
      palette: palettes[row.id % palettes.length],
      verified: true,
      isSponsored: true,
      highlightCampaignId: Number(campaign.id),
      sponsoredPlacement: campaign.placement as Placement,
      tags: [category.name, row.neighborhood, city.name],
      whatsapp: row.whatsapp_e164.replace(/\D/g, ""),
      products: [],
    }];
  });
}
