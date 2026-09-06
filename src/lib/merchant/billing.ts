import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { MerchantBusiness } from "@/lib/merchant/dal";

type BillingRule = {
  code: "free" | "pro";
  name: string;
  included_businesses: number;
  included_promotions_per_business: number;
};

export type BillingPrice = {
  billing_cycle: "monthly" | "semiannual" | "annual";
  interval_months: number;
  price_cents: number;
};

export type BillingProduct = {
  code: string;
  name: string;
  kind: "store_slot" | "promotion_pack";
  units: number;
  price_cents: number;
  billing_mode: "recurring" | "one_time";
};

type SubscriptionRow = {
  id: number;
  billing_cycle: BillingPrice["billing_cycle"];
  payment_method: "credit_card" | "pix_auto" | "pix";
  status: "pending" | "active" | "past_due" | "cancelled" | "expired";
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

type AddonRow = {
  business_id: number | null;
  product_code: string;
  quantity: number;
  status: "pending" | "active" | "past_due" | "cancelled" | "expired";
  active_from: string | null;
  active_until: string | null;
};

export type MerchantBillingSummary = {
  plan: "free" | "pro";
  proActive: boolean;
  subscription: SubscriptionRow | null;
  storeLimit: number;
  storeCount: number;
  activeStoreCount: number;
  extraStoreSlots: number;
  promotionLimitByBusiness: Record<number, number>;
  promotionPackUnitsByBusiness: Record<number, number>;
  prices: BillingPrice[];
  products: BillingProduct[];
};

function inActiveWindow(
  status: string,
  activeFrom: string | null,
  activeUntil: string | null,
  now: number,
) {
  return (
    status === "active" &&
    (!activeFrom || new Date(activeFrom).getTime() <= now) &&
    (!activeUntil || new Date(activeUntil).getTime() > now)
  );
}

export async function getMerchantBillingSummary(
  supabase: SupabaseClient<Database>,
  userId: string,
  businesses: MerchantBusiness[],
): Promise<MerchantBillingSummary> {
  const billingClient = supabase as unknown as SupabaseClient<any>;
  const [rulesResult, pricesResult, productsResult, subscriptionsResult, addonsResult] =
    await Promise.all([
      billingClient
        .from("billing_plan_rules")
        .select("code, name, included_businesses, included_promotions_per_business")
        .eq("is_active", true),
      billingClient
        .from("billing_plan_prices")
        .select("billing_cycle, interval_months, price_cents")
        .eq("plan_code", "pro")
        .eq("is_active", true)
        .order("interval_months"),
      billingClient
        .from("billing_products")
        .select("code, name, kind, units, price_cents, billing_mode")
        .eq("is_active", true)
        .order("units"),
      billingClient
        .from("subscriptions")
        .select(
          "id, billing_cycle, payment_method, status, current_period_start, current_period_end, cancel_at_period_end",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      billingClient
        .from("billing_addons")
        .select(
          "business_id, product_code, quantity, status, active_from, active_until",
        )
        .eq("user_id", userId),
    ]);

  if (
    rulesResult.error ||
    pricesResult.error ||
    productsResult.error ||
    subscriptionsResult.error ||
    addonsResult.error
  ) {
    throw new Error("Não foi possível carregar os limites da assinatura.");
  }

  const rules = (rulesResult.data ?? []) as BillingRule[];
  const prices = (pricesResult.data ?? []) as BillingPrice[];
  const products = (productsResult.data ?? []) as BillingProduct[];
  const subscriptions = (subscriptionsResult.data ?? []) as SubscriptionRow[];
  const addons = (addonsResult.data ?? []) as AddonRow[];
  const now = Date.now();

  const subscription =
    subscriptions.find((item) =>
      inActiveWindow(
        item.status,
        item.current_period_start,
        item.current_period_end,
        now,
      ),
    ) ??
    subscriptions[0] ??
    null;

  const proActive = Boolean(
    subscription &&
      inActiveWindow(
        subscription.status,
        subscription.current_period_start,
        subscription.current_period_end,
        now,
      ),
  );
  const freeRule = rules.find((rule) => rule.code === "free") ?? {
    code: "free" as const,
    name: "Grátis",
    included_businesses: 1,
    included_promotions_per_business: 2,
  };
  const proRule = rules.find((rule) => rule.code === "pro") ?? {
    code: "pro" as const,
    name: "Calçadão Pro",
    included_businesses: 3,
    included_promotions_per_business: 10,
  };
  const productByCode = new Map(products.map((product) => [product.code, product]));
  const activeAddons = addons.filter((addon) =>
    inActiveWindow(addon.status, addon.active_from, addon.active_until, now),
  );

  let extraStoreSlots = 0;
  const promotionPackUnitsByBusiness: Record<number, number> = {};
  if (proActive) {
    for (const addon of activeAddons) {
      const product = productByCode.get(addon.product_code);
      if (!product) continue;
      const units = product.units * addon.quantity;
      if (product.kind === "store_slot") {
        extraStoreSlots += units;
      } else if (product.kind === "promotion_pack" && addon.business_id) {
        promotionPackUnitsByBusiness[addon.business_id] =
          (promotionPackUnitsByBusiness[addon.business_id] ?? 0) + units;
      }
    }
  }

  const baseRule = proActive ? proRule : freeRule;
  const promotionLimitByBusiness: Record<number, number> = {};
  for (const business of businesses) {
    promotionLimitByBusiness[business.id] = business.billing_suspended
      ? 0
      : baseRule.included_promotions_per_business +
        (promotionPackUnitsByBusiness[business.id] ?? 0);
  }

  return {
    plan: proActive ? "pro" : "free",
    proActive,
    subscription,
    storeLimit: baseRule.included_businesses + (proActive ? extraStoreSlots : 0),
    storeCount: businesses.length,
    activeStoreCount: businesses.filter((business) => !business.billing_suspended).length,
    extraStoreSlots,
    promotionLimitByBusiness,
    promotionPackUnitsByBusiness,
    prices,
    products,
  };
}
