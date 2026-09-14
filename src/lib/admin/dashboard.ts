import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type DashboardMetrics = {
  accounts: { total: number; recent: number; pro: number };
  stores: {
    total: number; recent: number; pending: number; approved: number;
    rejected: number; suspended: number; published: number; billing_suspended: number;
  };
  offers: { total: number; recent: number; visible: number };
  ads: {
    total: number; paid: number; active: number; awaiting_payment: number;
    banners_to_review: number; confirmed_cents: number;
    recent_confirmed_cents: number; awaiting_payment_cents: number;
  };
  inbox: { support_open: number; reports_open: number; unread: number };
  monthly: Array<{ month: string; accounts: number; stores: number }>;
};

export async function getAdminDashboard(
  supabase: SupabaseClient<Database>,
  days: 7 | 30 | 90,
) {
  const [metricsResult, storesResult, campaignsResult] = await Promise.all([
    supabase.rpc("admin_dashboard_metrics", { p_days: days }),
    supabase.from("businesses")
      .select("id, name, slug, status, created_at, cities(name, state_code)")
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("highlight_campaigns")
      .select("id, status, provider, placement, charged_price_cents, created_at, businesses(name, slug)")
      .order("created_at", { ascending: false }).limit(5),
  ]);

  if (metricsResult.error || !metricsResult.data || storesResult.error || campaignsResult.error) {
    throw new Error("Não foi possível carregar o dashboard administrativo.");
  }

  return {
    metrics: metricsResult.data as unknown as DashboardMetrics,
    stores: storesResult.data ?? [],
    campaigns: campaignsResult.data ?? [],
  };
}
