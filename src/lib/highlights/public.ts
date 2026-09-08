import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBusinessSchedule, type BusinessHour } from "@/lib/business-hours";
import { publicMediaUrl } from "@/lib/merchant/media";
import type { Business } from "@/types/catalog";
import type { Database } from "@/types/database-runtime";

const palettes = [
  "from-[#ef6a43] to-[#f5a640]",
  "from-[#183a3a] to-[#2b7770]",
  "from-[#9f5968] to-[#dd9b7c]",
  "from-[#7c3d71] to-[#d66e9e]",
];

type Placement = "city" | "category" | "combo";
type BusinessHourRow = BusinessHour & { business_id: number };

export type FeaturedCampaignCandidate = {
  campaignId: number;
  businessId: number;
};

export type RegionalBanner = {
  campaignId: number;
  imageUrl: string;
  title: string;
  description: string;
  businessName: string;
  businessSlug: string;
  cityName: string;
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

export async function getPublicFeaturedCampaignCandidates(
  supabase: SupabaseClient<Database>,
  cityId: number,
  categoryId?: number,
): Promise<FeaturedCampaignCandidate[]> {
  const now = new Date().toISOString();
  let query = supabase
    .from("highlight_campaigns")
    .select("id, business_id, businesses!inner(id)")
    .eq("city_id", cityId)
    .eq("status", "active")
    .lte("starts_at", now)
    .gt("ends_at", now)
    .eq("businesses.publication_status", "published")
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

  const { data, error } = await query.limit(100);
  if (error || !data?.length) return [];

  return data.flatMap((campaign): FeaturedCampaignCandidate[] => {
    const campaignId = Number(campaign.id);
    const businessId = Number(campaign.business_id);
    if (
      !Number.isSafeInteger(campaignId) || campaignId <= 0 ||
      !Number.isSafeInteger(businessId) || businessId <= 0
    ) {
      return [];
    }
    return [{ campaignId, businessId }];
  });
}

export async function getPublicFeaturedBusinesses(
  supabase: SupabaseClient<Database>,
  campaignIds: number[],
): Promise<Business[]> {
  if (campaignIds.length === 0) return [];

  const now = new Date().toISOString();
  const { data: campaigns, error } = await supabase
    .from("highlight_campaigns")
    .select(
      "id, placement, businesses!inner(id, slug, name, description, status, whatsapp_e164, street, address_number, complement, neighborhood, categories(slug, name), cities(name, state_code, timezone))",
    )
    .in("id", campaignIds)
    .eq("status", "active")
    .lte("starts_at", now)
    .gt("ends_at", now)
    .eq("businesses.publication_status", "published")
    .eq("businesses.is_active", true)
    .eq("businesses.billing_suspended", false)
    .not("businesses.logo_path", "is", null)
    .not("businesses.cover_path", "is", null);

  if (error || !campaigns?.length) return [];

  const businessIds = campaigns
    .map((campaign) => {
      const row = Array.isArray(campaign.businesses)
        ? campaign.businesses[0]
        : campaign.businesses;
      return Number(row?.id);
    })
    .filter((id) => Number.isSafeInteger(id) && id > 0);

  const hoursResult = businessIds.length
    ? await supabase
        .from("business_hours")
        .select("business_id, weekday, opens_at, closes_at, is_closed")
        .in("business_id", businessIds)
        .order("weekday")
        .order("display_order")
    : { data: [] as BusinessHourRow[] };
  const hours = (hoursResult.data ?? []) as BusinessHourRow[];

  const hoursByBusiness = new Map<number, BusinessHour[]>();
  for (const item of hours) {
    const businessHours = hoursByBusiness.get(item.business_id) ?? [];
    businessHours.push(item);
    hoursByBusiness.set(item.business_id, businessHours);
  }

  const campaignById = new Map(campaigns.map((campaign) => [Number(campaign.id), campaign]));

  return campaignIds.flatMap((campaignId): Business[] => {
    const campaign = campaignById.get(campaignId);
    if (!campaign) return [];
    const row = Array.isArray(campaign.businesses)
      ? campaign.businesses[0]
      : campaign.businesses;
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
      verified: row.status === "approved",
      isSponsored: true,
      highlightCampaignId: Number(campaign.id),
      sponsoredPlacement: campaign.placement as Placement,
      tags: [category.name, row.neighborhood, city.name],
      whatsapp: row.whatsapp_e164.replace(/\D/g, ""),
      products: [],
    }];
  });
}

export async function getPublicRegionalBanners(
  supabase: SupabaseClient<Database>,
  cityId: number,
): Promise<RegionalBanner[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("highlight_campaigns")
    .select(
      "id, creative_image_path, creative_title, creative_description, businesses!inner(name, slug), cities!inner(name)",
    )
    .eq("placement", "banner")
    .eq("city_id", cityId)
    .eq("creative_status", "approved")
    .eq("status", "active")
    .lte("starts_at", now)
    .gt("ends_at", now)
    .eq("businesses.publication_status", "published")
    .eq("businesses.is_active", true)
    .eq("businesses.billing_suspended", false)
    .limit(20);

  if (error || !data?.length) return [];

  return data.flatMap((campaign): RegionalBanner[] => {
    const business = Array.isArray(campaign.businesses)
      ? campaign.businesses[0]
      : campaign.businesses;
    const city = Array.isArray(campaign.cities)
      ? campaign.cities[0]
      : campaign.cities;
    const imageUrl = publicMediaUrl(supabase, campaign.creative_image_path);
    if (
      !business ||
      !city ||
      !imageUrl ||
      !campaign.creative_title ||
      !campaign.creative_description
    ) {
      return [];
    }
    return [{
      campaignId: campaign.id,
      imageUrl,
      title: campaign.creative_title,
      description: campaign.creative_description,
      businessName: business.name,
      businessSlug: business.slug,
      cityName: city.name,
    }];
  });
}
