"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import {
  createEfiCardSubscriptionLink,
  createEfiExtraStoreSubscriptionLink,
  createEfiOneTimePaymentLink,
  hasEfiChargesConfig,
} from "@/lib/efi/cobrancas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

const cycles = {
  monthly: { months: 1, label: "Mensal" },
  semiannual: { months: 6, label: "Semestral" },
  annual: { months: 12, label: "Anual" },
} as const;

type BillingCycle = keyof typeof cycles;

function billingUrl(params: Record<string, string>) {
  const query = new URLSearchParams(params);
  return `/painel/assinatura?${query.toString()}`;
}

function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    "https://ocalcadao.com.br"
  );
}

function notificationUrl() {
  return `${baseUrl()}/api/billing/efi/notification`;
}

function asBillingClient(client: SupabaseClient<Database>) {
  return client as unknown as SupabaseClient<any>;
}

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?next=%2Fpainel%2Fassinatura");
  return { supabase, user };
}

async function isProActive(client: SupabaseClient<any>, userId: string) {
  const now = new Date().toISOString();
  const { data } = await client
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("plan_code", "pro")
    .eq("status", "active")
    .lte("current_period_start", now)
    .gt("current_period_end", now)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

function assertCheckoutConfigured() {
  if (!hasEfiChargesConfig()) {
    redirect(
      billingUrl({
        erro: "efi_nao_configurada",
      }),
    );
  }
}

export async function startProCardCheckoutAction(formData: FormData) {
  assertCheckoutConfigured();
  const cycle = String(formData.get("billing_cycle") ?? "") as BillingCycle;
  if (!(cycle in cycles)) redirect(billingUrl({ erro: "periodo_invalido" }));

  const { supabase, user } = await currentUser();
  const client = asBillingClient(supabase);
  const { data: price } = await client
    .from("billing_plan_prices")
    .select("price_cents, interval_months")
    .eq("plan_code", "pro")
    .eq("billing_cycle", cycle)
    .eq("is_active", true)
    .maybeSingle();
  if (!price) redirect(billingUrl({ erro: "preco_indisponivel" }));

  try {
    const checkout = await createEfiCardSubscriptionLink({
      userId: user.id,
      intervalMonths: cycles[cycle].months,
      priceCents: price.price_cents,
      cycleLabel: cycles[cycle].label,
      notificationUrl: notificationUrl(),
    });
    const admin = createAdminClient() as unknown as SupabaseClient<any>;
    const { error } = await admin.from("subscriptions").insert({
      user_id: user.id,
      plan_code: "pro",
      billing_cycle: cycle,
      payment_method: "credit_card",
      provider: "efi",
      provider_plan_id: checkout.planId,
      provider_subscription_id: checkout.subscriptionId,
      provider_charge_id: checkout.chargeId,
      status: "pending",
    });
    if (error) throw error;
    redirect(checkout.paymentUrl);
  } catch (error) {
    console.error("Erro ao iniciar assinatura Efí por cartão", error);
    redirect(billingUrl({ erro: "checkout_efi" }));
  }
}

export async function startProPixCheckoutAction(formData: FormData) {
  assertCheckoutConfigured();
  const cycle = String(formData.get("billing_cycle") ?? "") as BillingCycle;
  if (!(cycle in cycles)) redirect(billingUrl({ erro: "periodo_invalido" }));

  const { supabase, user } = await currentUser();
  const client = asBillingClient(supabase);
  const { data: price } = await client
    .from("billing_plan_prices")
    .select("price_cents")
    .eq("plan_code", "pro")
    .eq("billing_cycle", cycle)
    .eq("is_active", true)
    .maybeSingle();
  if (!price) redirect(billingUrl({ erro: "preco_indisponivel" }));

  try {
    const checkout = await createEfiOneTimePaymentLink({
      userId: user.id,
      productCode: `pro_${cycle}`,
      itemName: `O Calçadão Pro - ${cycles[cycle].label}`,
      priceCents: price.price_cents,
      notificationUrl: notificationUrl(),
    });
    const admin = createAdminClient() as unknown as SupabaseClient<any>;
    const { error } = await admin.from("subscriptions").insert({
      user_id: user.id,
      plan_code: "pro",
      billing_cycle: cycle,
      payment_method: "pix",
      provider: "efi",
      provider_charge_id: checkout.chargeId,
      status: "pending",
    });
    if (error) throw error;
    redirect(checkout.paymentUrl);
  } catch (error) {
    console.error("Erro ao iniciar assinatura Efí por Pix", error);
    redirect(billingUrl({ erro: "checkout_efi" }));
  }
}

export async function startExtraStoreCheckoutAction() {
  assertCheckoutConfigured();
  const { supabase, user } = await currentUser();
  const client = asBillingClient(supabase);
  if (!(await isProActive(client, user.id))) {
    redirect(billingUrl({ erro: "pro_necessario" }));
  }

  const { data: product } = await client
    .from("billing_products")
    .select("code, price_cents")
    .eq("code", "extra_store")
    .eq("is_active", true)
    .maybeSingle();
  if (!product) redirect(billingUrl({ erro: "produto_indisponivel" }));

  try {
    const checkout = await createEfiExtraStoreSubscriptionLink({
      userId: user.id,
      priceCents: product.price_cents,
      notificationUrl: notificationUrl(),
    });
    const admin = createAdminClient() as unknown as SupabaseClient<any>;
    const { error } = await admin.from("billing_addons").insert({
      user_id: user.id,
      business_id: null,
      product_code: product.code,
      quantity: 1,
      payment_method: "credit_card",
      provider: "efi",
      provider_plan_id: checkout.planId,
      provider_subscription_id: checkout.subscriptionId,
      provider_charge_id: checkout.chargeId,
      status: "pending",
    });
    if (error) throw error;
    redirect(checkout.paymentUrl);
  } catch (error) {
    console.error("Erro ao iniciar loja adicional Efí", error);
    redirect(billingUrl({ erro: "checkout_efi" }));
  }
}

export async function startPromotionPackCheckoutAction(formData: FormData) {
  assertCheckoutConfigured();
  const productCode = String(formData.get("product_code") ?? "");
  const businessId = Number(formData.get("business_id"));
  if (!/^promo_(5|10|20|50)$/.test(productCode)) {
    redirect(billingUrl({ erro: "produto_invalido" }));
  }
  if (!Number.isSafeInteger(businessId) || businessId <= 0) {
    redirect(billingUrl({ erro: "loja_invalida" }));
  }

  const { supabase, user } = await currentUser();
  const client = asBillingClient(supabase);
  if (!(await isProActive(client, user.id))) {
    redirect(billingUrl({ erro: "pro_necessario" }));
  }

  const [{ data: business }, { data: product }] = await Promise.all([
    client
      .from("businesses")
      .select("id")
      .eq("id", businessId)
      .eq("owner_id", user.id)
      .maybeSingle(),
    client
      .from("billing_products")
      .select("code, name, price_cents, kind")
      .eq("code", productCode)
      .eq("kind", "promotion_pack")
      .eq("is_active", true)
      .maybeSingle(),
  ]);
  if (!business) redirect(billingUrl({ erro: "loja_invalida" }));
  if (!product) redirect(billingUrl({ erro: "produto_indisponivel" }));

  try {
    const checkout = await createEfiOneTimePaymentLink({
      userId: user.id,
      productCode: product.code,
      itemName: `O Calçadão - ${product.name}`,
      priceCents: product.price_cents,
      notificationUrl: notificationUrl(),
    });
    const admin = createAdminClient() as unknown as SupabaseClient<any>;
    const { error } = await admin.from("billing_addons").insert({
      user_id: user.id,
      business_id: businessId,
      product_code: product.code,
      quantity: 1,
      payment_method: "pix",
      provider: "efi",
      provider_charge_id: checkout.chargeId,
      status: "pending",
    });
    if (error) throw error;
    redirect(checkout.paymentUrl);
  } catch (error) {
    console.error("Erro ao iniciar pacote de promoções Efí", error);
    redirect(billingUrl({ erro: "checkout_efi" }));
  }
}
