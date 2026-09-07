import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  HighlightCampaign,
  HighlightPackage,
  HighlightPlacementRule,
} from "@/lib/highlights/merchant";

export type AdminHighlightCampaign = HighlightCampaign & {
  admin_note: string | null;
  businesses: { name: string; slug: string } | null;
  cities: { name: string; state_code: string } | null;
  categories: { name: string } | null;
};

function singleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function getAdminHighlights(
  supabase: SupabaseClient<Database>,
  status?: string,
) {
  const [packagesResult, rulesResult, businessesResult] = await Promise.all([
    supabase
      .from("highlight_packages")
      .select("code, name, placement, duration_days, price_cents, display_order, is_active")
      .order("display_order"),
    supabase
      .from("highlight_placement_rules")
      .select("code, name, max_active, is_active")
      .order("code"),
    supabase
      .from("businesses")
      .select("id, name, city_id, category_id")
      .eq("status", "approved")
      .eq("is_active", true)
      .eq("billing_suspended", false)
      .not("logo_path", "is", null)
      .not("cover_path", "is", null)
      .order("name")
      .limit(500),
  ]);

  let campaignsQuery = supabase
    .from("highlight_campaigns")
    .select(
      "id, business_id, package_code, placement, duration_days, base_price_cents, discount_cents, charged_price_cents, provider, provider_payment_url, status, starts_at, ends_at, pause_reason, remaining_seconds, admin_note, creative_image_path, creative_title, creative_description, creative_status, creative_rejection_reason, created_at, businesses(name, slug), cities(name, state_code), categories(name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (status && status !== "all") {
    campaignsQuery = campaignsQuery.eq("status", status);
  }
  const campaignsResult = await campaignsQuery;

  if (
    packagesResult.error ||
    rulesResult.error ||
    businessesResult.error ||
    campaignsResult.error
  ) {
    throw new Error("Não foi possível carregar a administração dos destaques.");
  }

  const campaigns = (campaignsResult.data ?? []).map((campaign) => ({
    ...campaign,
    businesses: singleRelation(campaign.businesses),
    cities: singleRelation(campaign.cities),
    categories: singleRelation(campaign.categories),
  })) as AdminHighlightCampaign[];
  const campaignIds = campaigns.map((campaign) => campaign.id);
  const metricsResult = campaignIds.length
    ? await supabase
        .from("highlight_daily_metrics")
        .select(
          "campaign_id, impressions, store_views, whatsapp_clicks, directions_clicks",
        )
        .in("campaign_id", campaignIds)
    : { data: [], error: null };
  if (metricsResult.error) {
    throw new Error("Não foi possível carregar as métricas administrativas.");
  }

  const metricsByCampaign = new Map<
    number,
    {
      impressions: number;
      storeViews: number;
      whatsapp: number;
      directions: number;
    }
  >();
  for (const row of metricsResult.data ?? []) {
    const current = metricsByCampaign.get(row.campaign_id) ?? {
      impressions: 0,
      storeViews: 0,
      whatsapp: 0,
      directions: 0,
    };
    current.impressions += Number(row.impressions);
    current.storeViews += Number(row.store_views);
    current.whatsapp += Number(row.whatsapp_clicks);
    current.directions += Number(row.directions_clicks);
    metricsByCampaign.set(row.campaign_id, current);
  }

  return {
    packages: (packagesResult.data ?? []) as Array<
      HighlightPackage & { is_active: boolean }
    >,
    rules: (rulesResult.data ?? []) as Array<
      HighlightPlacementRule & { is_active: boolean }
    >,
    businesses: (businessesResult.data ?? []) as Array<{
      id: number;
      name: string;
      city_id: number;
      category_id: number;
    }>,
    campaigns,
    metricsByCampaign,
  };
}
