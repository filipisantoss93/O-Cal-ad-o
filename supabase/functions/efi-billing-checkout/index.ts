import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cycles = {
  monthly: { months: 1, label: "Mensal" },
  semiannual: { months: 6, label: "Semestral" },
  annual: { months: 12, label: "Anual" },
} as const;

type BillingCycle = keyof typeof cycles;
type CheckoutAction = "pro_card" | "pro_pix" | "extra_store" | "promotion_pack";

type CheckoutBody = {
  action?: CheckoutAction;
  billing_cycle?: string;
  business_id?: number;
  product_code?: string;
};

type EfiAuthorizeResponse = { access_token?: string };
type EfiPlanResponse = { data?: { plan_id?: number } };
type EfiSubscriptionLinkResponse = {
  data?: {
    subscription_id?: number;
    payment_url?: string;
    charge?: { id?: number };
  };
};
type EfiPaymentLinkResponse = {
  data?: { charge_id?: number; payment_url?: string };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://ocalcadao.com.br",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEfiConfig() {
  const clientId = Deno.env.get("EFI_CLIENT_ID")?.trim();
  const clientSecret = Deno.env.get("EFI_CLIENT_SECRET")?.trim();
  if (!clientId || !clientSecret) return null;
  const sandbox = Deno.env.get("EFI_CHARGES_SANDBOX")?.trim().toLowerCase() === "true";
  return {
    clientId,
    clientSecret,
    baseUrl: sandbox
      ? "https://cobrancas-h.api.efipay.com.br"
      : "https://cobrancas.api.efipay.com.br",
  };
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("EFI_INVALID_JSON");
  }
}

async function getAccessToken() {
  const config = getEfiConfig();
  if (!config) throw new Error("EFI_NOT_CONFIGURED");
  const basic = btoa(`${config.clientId}:${config.clientSecret}`);
  const response = await fetch(`${config.baseUrl}/v1/authorize`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  });
  const payload = (await readJson(response)) as EfiAuthorizeResponse;
  if (!response.ok || !payload.access_token) {
    console.error("Efí OAuth falhou", { status: response.status });
    throw new Error("EFI_AUTH_FAILED");
  }
  return { baseUrl: config.baseUrl, token: payload.access_token };
}

async function efiRequest<T>(path: string, init: RequestInit) {
  const { baseUrl, token } = await getAccessToken();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = await readJson(response);
  if (!response.ok) {
    console.error("Efí recusou cobrança", { path, status: response.status });
    throw new Error("EFI_REQUEST_REJECTED");
  }
  return payload as T;
}

function checkoutExpiration() {
  const expireAt = new Date();
  expireAt.setUTCDate(expireAt.getUTCDate() + 3);
  return expireAt.toISOString().slice(0, 10);
}

function notificationUrl() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!supabaseUrl) throw new Error("SUPABASE_URL_MISSING");
  return `${supabaseUrl}/functions/v1/efi-billing-webhook`;
}

async function createRecurringLink(input: {
  planName: string;
  itemName: string;
  intervalMonths: 1 | 6 | 12;
  priceCents: number;
  customId: string;
}) {
  const plan = await efiRequest<EfiPlanResponse>("/v1/plan", {
    method: "POST",
    body: JSON.stringify({ name: input.planName, interval: input.intervalMonths }),
  });
  const planId = plan.data?.plan_id;
  if (!planId) throw new Error("EFI_PLAN_ID_MISSING");

  const subscription = await efiRequest<EfiSubscriptionLinkResponse>(
    `/v1/plan/${planId}/subscription/one-step/link`,
    {
      method: "POST",
      body: JSON.stringify({
        items: [{ name: input.itemName, value: input.priceCents, amount: 1 }],
        metadata: {
          custom_id: input.customId,
          notification_url: notificationUrl(),
        },
        settings: {
          payment_method: "credit_card",
          expire_at: checkoutExpiration(),
          request_delivery_address: false,
        },
      }),
    },
  );

  const subscriptionId = subscription.data?.subscription_id;
  const paymentUrl = subscription.data?.payment_url;
  if (!subscriptionId || !paymentUrl) throw new Error("EFI_SUBSCRIPTION_LINK_MISSING");

  return {
    planId: String(planId),
    subscriptionId: String(subscriptionId),
    chargeId: subscription.data?.charge?.id ? String(subscription.data.charge.id) : null,
    paymentUrl,
  };
}

async function createOneTimeLink(input: {
  userId: string;
  productCode: string;
  itemName: string;
  priceCents: number;
}) {
  const customId = `ocalcadao:${input.productCode}:${input.userId}:${Date.now()}`;
  const payment = await efiRequest<EfiPaymentLinkResponse>("/v1/charge/one-step/link", {
    method: "POST",
    body: JSON.stringify({
      items: [{ name: input.itemName, value: input.priceCents, amount: 1 }],
      metadata: {
        custom_id: customId,
        notification_url: notificationUrl(),
      },
      settings: {
        payment_method: "all",
        expire_at: checkoutExpiration(),
        request_delivery_address: false,
      },
    }),
  });
  const chargeId = payment.data?.charge_id;
  const paymentUrl = payment.data?.payment_url;
  if (!chargeId || !paymentUrl) throw new Error("EFI_PAYMENT_LINK_MISSING");
  return { chargeId: String(chargeId), paymentUrl };
}

async function currentUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!authHeader || !supabaseUrl || !anonKey) return null;
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  return user;
}

function adminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRole) throw new Error("SUPABASE_ADMIN_MISSING");
  return createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function isProActive(admin: ReturnType<typeof adminClient>, userId: string) {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("plan_code", "pro")
    .eq("status", "active")
    .lte("current_period_start", now)
    .gt("current_period_end", now)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  if (!getEfiConfig()) {
    return json({ ok: false, error: "efi_nao_configurada" }, 503);
  }

  const user = await currentUser(req);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);

  let body: CheckoutBody;
  try {
    body = await req.json() as CheckoutBody;
  } catch {
    return json({ ok: false, error: "payload_invalido" }, 400);
  }

  const admin = adminClient();

  try {
    if (body.action === "pro_card" || body.action === "pro_pix") {
      const cycle = body.billing_cycle as BillingCycle;
      if (!(cycle in cycles)) return json({ ok: false, error: "periodo_invalido" }, 400);
      if (await isProActive(admin, user.id)) {
        return json({ ok: false, error: "pro_ja_ativo" }, 409);
      }

      const { data: price, error: priceError } = await admin
        .from("billing_plan_prices")
        .select("price_cents, interval_months")
        .eq("plan_code", "pro")
        .eq("billing_cycle", cycle)
        .eq("is_active", true)
        .maybeSingle();
      if (priceError) throw priceError;
      if (!price) return json({ ok: false, error: "preco_indisponivel" }, 404);

      if (body.action === "pro_card") {
        const checkout = await createRecurringLink({
          planName: `O Calçadão Pro - ${cycles[cycle].label}`,
          itemName: `Assinatura O Calçadão Pro - ${cycles[cycle].label}`,
          intervalMonths: cycles[cycle].months,
          priceCents: price.price_cents,
          customId: `ocalcadao:pro:${user.id}:${Date.now()}`,
        });
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
        return json({ ok: true, payment_url: checkout.paymentUrl });
      }

      const checkout = await createOneTimeLink({
        userId: user.id,
        productCode: `pro_${cycle}`,
        itemName: `O Calçadão Pro - ${cycles[cycle].label}`,
        priceCents: price.price_cents,
      });
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
      return json({ ok: true, payment_url: checkout.paymentUrl });
    }

    if (body.action === "extra_store") {
      if (!(await isProActive(admin, user.id))) {
        return json({ ok: false, error: "pro_necessario" }, 403);
      }
      const { data: product, error: productError } = await admin
        .from("billing_products")
        .select("code, price_cents")
        .eq("code", "extra_store")
        .eq("is_active", true)
        .maybeSingle();
      if (productError) throw productError;
      if (!product) return json({ ok: false, error: "produto_indisponivel" }, 404);

      const checkout = await createRecurringLink({
        planName: "O Calçadão - Loja adicional",
        itemName: "O Calçadão - 1 loja adicional",
        intervalMonths: 1,
        priceCents: product.price_cents,
        customId: `ocalcadao:extra_store:${user.id}:${Date.now()}`,
      });
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
      return json({ ok: true, payment_url: checkout.paymentUrl });
    }

    if (body.action === "promotion_pack") {
      const productCode = String(body.product_code ?? "");
      const businessId = Number(body.business_id);
      if (!/^promo_(5|10|20|50)$/.test(productCode)) {
        return json({ ok: false, error: "produto_invalido" }, 400);
      }
      if (!Number.isSafeInteger(businessId) || businessId <= 0) {
        return json({ ok: false, error: "loja_invalida" }, 400);
      }
      if (!(await isProActive(admin, user.id))) {
        return json({ ok: false, error: "pro_necessario" }, 403);
      }

      const [{ data: business, error: businessError }, { data: product, error: productError }] = await Promise.all([
        admin.from("businesses").select("id").eq("id", businessId).eq("owner_id", user.id).maybeSingle(),
        admin.from("billing_products").select("code, name, price_cents, kind").eq("code", productCode).eq("kind", "promotion_pack").eq("is_active", true).maybeSingle(),
      ]);
      if (businessError) throw businessError;
      if (productError) throw productError;
      if (!business) return json({ ok: false, error: "loja_invalida" }, 404);
      if (!product) return json({ ok: false, error: "produto_indisponivel" }, 404);

      const checkout = await createOneTimeLink({
        userId: user.id,
        productCode: product.code,
        itemName: `O Calçadão - ${product.name}`,
        priceCents: product.price_cents,
      });
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
      return json({ ok: true, payment_url: checkout.paymentUrl });
    }

    return json({ ok: false, error: "acao_invalida" }, 400);
  } catch (error) {
    console.error("Falha no checkout Efí", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.message === "EFI_NOT_CONFIGURED") {
      return json({ ok: false, error: "efi_nao_configurada" }, 503);
    }
    return json({ ok: false, error: "checkout_efi" }, 502);
  }
});
