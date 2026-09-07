import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type HighlightPlacement = "city" | "category" | "combo" | "banner";

export type HighlightPackage = {
  code: string;
  name: string;
  placement: HighlightPlacement;
  duration_days: number;
  price_cents: number;
  display_order: number;
};

export type HighlightPlacementRule = {
  code: "city" | "category" | "banner";
  name: string;
  max_active: number;
};

export type HighlightCampaign = {
  id: number;
  business_id: number;
  package_code: string;
  placement: HighlightPlacement;
  duration_days: number;
  base_price_cents: number;
  discount_cents: number;
  charged_price_cents: number;
  provider: "efi" | "manual";
  provider_payment_url: string | null;
  status:
    | "pending"
    | "scheduled"
    | "active"
    | "paused"
    | "completed"
    | "cancelled"
    | "expired"
    | "refunded";
  starts_at: string;
  ends_at: string;
  pause_reason:
    | "business_unavailable"
    | "admin"
    | "payment_dispute"
    | "creative_review"
    | "creative_rejected"
    | null;
  creative_image_path: string | null;
  creative_title: string | null;
  creative_description: string | null;
  creative_status: "pending" | "approved" | "rejected";
  creative_rejection_reason: string | null;
  remaining_seconds: number;
  created_at: string;
};

export type HighlightMetric = {
  campaign_id: number;
  impressions: number;
  store_views: number;
  whatsapp_clicks: number;
  directions_clicks: number;
};

export async function getMerchantHighlights(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const [packagesResult, rulesResult, campaignsResult] = await Promise.all([
    supabase
      .from("highlight_packages")
      .select("code, name, placement, duration_days, price_cents, display_order")
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("highlight_placement_rules")
      .select("code, name, max_active")
      .eq("is_active", true),
    supabase
      .from("highlight_campaigns")
      .select(
        "id, business_id, package_code, placement, duration_days, base_price_cents, discount_cents, charged_price_cents, provider, provider_payment_url, status, starts_at, ends_at, pause_reason, remaining_seconds, creative_image_path, creative_title, creative_description, creative_status, creative_rejection_reason, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (packagesResult.error || rulesResult.error || campaignsResult.error) {
    throw new Error("Não foi possível carregar os destaques da sua conta.");
  }

  const campaigns = (campaignsResult.data ?? []) as HighlightCampaign[];
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
    throw new Error("Não foi possível carregar as métricas dos destaques.");
  }

  const metricsByCampaign = new Map<number, HighlightMetric>();
  for (const row of metricsResult.data ?? []) {
    const current = metricsByCampaign.get(row.campaign_id) ?? {
      campaign_id: row.campaign_id,
      impressions: 0,
      store_views: 0,
      whatsapp_clicks: 0,
      directions_clicks: 0,
    };
    current.impressions += Number(row.impressions);
    current.store_views += Number(row.store_views);
    current.whatsapp_clicks += Number(row.whatsapp_clicks);
    current.directions_clicks += Number(row.directions_clicks);
    metricsByCampaign.set(row.campaign_id, current);
  }

  return {
    packages: (packagesResult.data ?? []) as HighlightPackage[],
    rules: (rulesResult.data ?? []) as HighlightPlacementRule[],
    campaigns,
    metricsByCampaign,
  };
}
