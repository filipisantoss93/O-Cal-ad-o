import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cycles = {
  monthly: { months: 1, label: "Mensal" },
  semiannual: { months: 6, label: "Semestral" },
  annual: { months: 12, label: "Anual" },
} as const;

type BillingCycle = keyof typeof cycles;
type CheckoutAction =
  | "pro_card"
  | "pro_pix"
  | "extra_store"
  | "promotion_pack"
  | "highlight_campaign"
  | "banner_campaign";
type CheckoutBody = {
  action?: CheckoutAction;
  billing_cycle?: string;
  business_id?: number;
  product_code?: string;
  starts_on?: string;
  creative_image_path?: string;
  creative_title?: string;
  creative_description?: string;
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

class EfiRequestError extends Error {
  path: string;
  status: number;
  payload: unknown;
  constructor(path: string, status: number, payload: unknown) {
    super("EFI_REQUEST_REJECTED");
    this.name = "EfiRequestError";
    this.path = path;
    this.status = status;
    this.payload = payload;
  }
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
    return { invalid_json: true, preview: text.slice(0, 500) };
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
    throw new EfiRequestError("/v1/authorize", response.status, payload);
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
    throw new EfiRequestError(path, response.status, payload);
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

function safeCustomId(parts: Array<string | number>) {
  return parts
    .join("_")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 255);
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

  try {
    const subscription = await efiRequest<EfiSubscriptionLinkResponse>(
      `/v1/plan/${planId}/subscription/one-step/link`,
      {
        method: "POST",
        body: JSON.stringify({
          items: [{ name: input.itemName, value: input.priceCents, amount: 1 }],
          metadata: {
            custom_id: safeCustomId([input.customId]),
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
    if (!subscriptionId || !paymentUrl) {
      throw new Error("EFI_SUBSCRIPTION_LINK_MISSING");
    }

    return {
      planId: String(planId),
      subscriptionId: String(subscriptionId),
      chargeId: subscription.data?.charge?.id
        ? String(subscription.data.charge.id)
        : null,
      paymentUrl,
    };
  } catch (error) {
    try {
      await efiRequest(`/v1/plan/${planId}`, { method: "DELETE" });
    } catch (cleanupError) {
      console.error("Falha ao limpar plano Efí órfão", cleanupError);
    }
    throw error;
  }
}

async function createOneTimeLink(input: {
  userId: string;
  productCode: string;
  itemName: string;
  priceCents: number;
  customId?: string;
}) {
  const customId =
    input.customId ??
    safeCustomId([
      "ocalcadao",
      input.productCode,
      input.userId,
      Date.now(),
    ]);
  const payment = await efiRequest<EfiPaymentLinkResponse>(
    "/v1/charge/one-step/link",
    {
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
    },
  );
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

async function logCheckoutError(
  admin: ReturnType<typeof adminClient>,
  body: CheckoutBody,
  error: unknown,
) {
  const diagnosticId = crypto.randomUUID();
  const provider = error instanceof EfiRequestError
    ? { path: error.path, status: error.status, payload: error.payload }
    : { message: error instanceof Error ? error.message : "unknown_error" };
  try {
    await admin.from("billing_provider_events").insert({
      event_key: `efi:checkout_error:${diagnosticId}`,
      provider: "efi",
      provider_event_id: diagnosticId,
      event_type: "checkout_error",
      payload: {
        diagnostic_id: diagnosticId,
        action: body.action ?? null,
        billing_cycle: body.billing_cycle ?? null,
        business_id: body.business_id ?? null,
        product_code: body.product_code ?? null,
        starts_on: body.starts_on ?? null,
        creative_image_path: body.creative_image_path ?? null,
        provider,
      },
    });
  } catch (logError) {
    console.error("Falha ao registrar diagnóstico Efí", logError);
  }
  return diagnosticId;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }
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
      if (!(cycle in cycles)) {
        return json({ ok: false, error: "periodo_invalido" }, 400);
      }
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
      if (!price) {
        return json({ ok: false, error: "preco_indisponivel" }, 404);
      }

      if (body.action === "pro_card") {
        const checkout = await createRecurringLink({
          planName: `O Calçadão Pro - ${cycles[cycle].label}`,
          itemName: `Assinatura O Calçadão Pro - ${cycles[cycle].label}`,
          intervalMonths: cycles[cycle].months,
          priceCents: price.price_cents,
          customId: safeCustomId(["ocalcadao", "pro", user.id, Date.now()]),
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
      if (!product) {
        return json({ ok: false, error: "produto_indisponivel" }, 404);
      }

      const checkout = await createRecurringLink({
        planName: "O Calçadão - Loja adicional",
        itemName: "O Calçadão - 1 loja adicional",
        intervalMonths: 1,
        priceCents: product.price_cents,
        customId: safeCustomId(["ocalcadao", "extra_store", user.id, Date.now()]),
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

      const [businessResult, productResult] = await Promise.all([
        admin.from("businesses")
          .select("id")
          .eq("id", businessId)
          .eq("owner_id", user.id)
          .maybeSingle(),
        admin.from("billing_products")
          .select("code, name, price_cents, kind")
          .eq("code", productCode)
          .eq("kind", "promotion_pack")
          .eq("is_active", true)
          .maybeSingle(),
      ]);
      if (businessResult.error) throw businessResult.error;
      if (productResult.error) throw productResult.error;
      if (!businessResult.data) {
        return json({ ok: false, error: "loja_invalida" }, 404);
      }
      if (!productResult.data) {
        return json({ ok: false, error: "produto_indisponivel" }, 404);
      }

      const product = productResult.data;
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

    if (body.action === "highlight_campaign") {
      const packageCode = String(body.product_code ?? "");
      const businessId = Number(body.business_id);
      if (!/^(category|city|combo)_(7|15|30)$/.test(packageCode)) {
        return json({ ok: false, error: "pacote_destaque_invalido" }, 400);
      }
      if (!Number.isSafeInteger(businessId) || businessId <= 0) {
        return json({ ok: false, error: "loja_invalida" }, 400);
      }

      let requestedStart: string | null = null;
      if (body.starts_on) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(body.starts_on)) {
          return json({ ok: false, error: "data_inicio_invalida" }, 400);
        }
        const parsedStart = new Date(`${body.starts_on}T03:00:00.000Z`);
        if (
          Number.isNaN(parsedStart.getTime()) ||
          parsedStart.toISOString().slice(0, 10) !== body.starts_on
        ) {
          return json({ ok: false, error: "data_inicio_invalida" }, 400);
        }
        requestedStart = parsedStart.toISOString();
      }

      const { data: reservations, error: reservationError } = await admin.rpc(
        "reserve_highlight_campaign",
        {
          p_user_id: user.id,
          p_business_id: businessId,
          p_package_code: packageCode,
          p_requested_start: requestedStart,
        },
      );
      if (reservationError) {
        const message = reservationError.message ?? "";
        const knownError = [
          "HIGHLIGHT_INVALID_BUSINESS",
          "HIGHLIGHT_BUSINESS_INELIGIBLE",
          "HIGHLIGHT_INVALID_PACKAGE",
          "HIGHLIGHT_ALREADY_OPEN",
          "HIGHLIGHT_START_TOO_FAR",
          "HIGHLIGHT_NO_AVAILABILITY",
        ].find((code) => message.includes(code));
        const errorCode: Record<string, string> = {
          HIGHLIGHT_INVALID_BUSINESS: "loja_invalida",
          HIGHLIGHT_BUSINESS_INELIGIBLE: "loja_destaque_indisponivel",
          HIGHLIGHT_INVALID_PACKAGE: "pacote_destaque_invalido",
          HIGHLIGHT_ALREADY_OPEN: "destaque_ja_contratado",
          HIGHLIGHT_START_TOO_FAR: "data_inicio_distante",
          HIGHLIGHT_NO_AVAILABILITY: "destaque_sem_vagas",
        };
        return json(
          { ok: false, error: knownError ? errorCode[knownError] : "reserva_destaque" },
          knownError === "HIGHLIGHT_INVALID_BUSINESS" ? 404 : 409,
        );
      }

      const reservation = Array.isArray(reservations) ? reservations[0] : reservations;
      const campaignId = Number(reservation?.campaign_id);
      const priceCents = Number(reservation?.charged_price_cents);
      if (!Number.isSafeInteger(campaignId) || campaignId <= 0 || !Number.isSafeInteger(priceCents) || priceCents <= 0) {
        return json({ ok: false, error: "reserva_destaque" }, 500);
      }

      let checkout: Awaited<ReturnType<typeof createOneTimeLink>>;
      try {
        checkout = await createOneTimeLink({
          userId: user.id,
          productCode: packageCode,
          itemName: `O Calçadão - ${String(reservation?.package_name ?? "Loja em destaque")}`,
          priceCents,
          customId: safeCustomId(["ocalcadao", "highlight", campaignId]),
        });
      } catch (error) {
        await admin
          .from("highlight_campaigns")
          .update({
            status: "cancelled",
            completed_at: new Date().toISOString(),
            reservation_expires_at: null,
          })
          .eq("id", campaignId)
          .eq("user_id", user.id)
          .eq("status", "pending");
        throw error;
      }

      const { data: attachedCampaign, error: attachError } = await admin
        .from("highlight_campaigns")
        .update({
          provider_charge_id: checkout.chargeId,
          provider_payment_url: checkout.paymentUrl,
        })
        .eq("id", campaignId)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (attachError || !attachedCampaign) {
        throw attachError ?? new Error("HIGHLIGHT_RESERVATION_ATTACH_FAILED");
      }
      return json({ ok: true, payment_url: checkout.paymentUrl });
    }

    if (body.action === "banner_campaign") {
      const packageCode = String(body.product_code ?? "");
      const businessId = Number(body.business_id);
      const imagePath = String(body.creative_image_path ?? "");
      const title = String(body.creative_title ?? "").trim();
      const description = String(body.creative_description ?? "").trim();
      if (!/^banner_(7|15|30)$/.test(packageCode)) {
        return json({ ok: false, error: "pacote_destaque_invalido" }, 400);
      }
      if (!Number.isSafeInteger(businessId) || businessId <= 0) {
        return json({ ok: false, error: "loja_invalida" }, 400);
      }
      if (
        !imagePath.startsWith(`${user.id}/banner-`) ||
        title.length < 3 ||
        title.length > 90 ||
        description.length < 3 ||
        description.length > 180
      ) {
        return json({ ok: false, error: "banner_criativo_invalido" }, 400);
      }

      let requestedStart: string | null = null;
      if (body.starts_on) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(body.starts_on)) {
          return json({ ok: false, error: "data_inicio_invalida" }, 400);
        }
        const parsedStart = new Date(`${body.starts_on}T03:00:00.000Z`);
        if (
          Number.isNaN(parsedStart.getTime()) ||
          parsedStart.toISOString().slice(0, 10) !== body.starts_on
        ) {
          return json({ ok: false, error: "data_inicio_invalida" }, 400);
        }
        requestedStart = parsedStart.toISOString();
      }

      const { data: reservations, error: reservationError } = await admin.rpc(
        "reserve_banner_campaign",
        {
          p_user_id: user.id,
          p_business_id: businessId,
          p_package_code: packageCode,
          p_requested_start: requestedStart,
          p_image_path: imagePath,
          p_title: title,
          p_description: description,
        },
      );
      if (reservationError) {
        const message = reservationError.message ?? "";
        const knownError = [
          "HIGHLIGHT_INVALID_BUSINESS",
          "HIGHLIGHT_BUSINESS_INELIGIBLE",
          "HIGHLIGHT_INVALID_PACKAGE",
          "BANNER_INVALID_CREATIVE",
          "BANNER_ALREADY_OPEN",
          "HIGHLIGHT_START_TOO_FAR",
          "HIGHLIGHT_NO_AVAILABILITY",
        ].find((code) => message.includes(code));
        const errorCode: Record<string, string> = {
          HIGHLIGHT_INVALID_BUSINESS: "loja_invalida",
          HIGHLIGHT_BUSINESS_INELIGIBLE: "loja_destaque_indisponivel",
          HIGHLIGHT_INVALID_PACKAGE: "pacote_destaque_invalido",
          BANNER_INVALID_CREATIVE: "banner_criativo_invalido",
          BANNER_ALREADY_OPEN: "banner_ja_contratado",
          HIGHLIGHT_START_TOO_FAR: "data_inicio_distante",
          HIGHLIGHT_NO_AVAILABILITY: "destaque_sem_vagas",
        };
        return json(
          { ok: false, error: knownError ? errorCode[knownError] : "reserva_destaque" },
          knownError === "HIGHLIGHT_INVALID_BUSINESS" ? 404 : 409,
        );
      }

      const reservation = Array.isArray(reservations) ? reservations[0] : reservations;
      const campaignId = Number(reservation?.campaign_id);
      const priceCents = Number(reservation?.charged_price_cents);
      if (!Number.isSafeInteger(campaignId) || campaignId <= 0 || !Number.isSafeInteger(priceCents) || priceCents <= 0) {
        return json({ ok: false, error: "reserva_destaque" }, 500);
      }

      let checkout: Awaited<ReturnType<typeof createOneTimeLink>>;
      try {
        checkout = await createOneTimeLink({
          userId: user.id,
          productCode: packageCode,
          itemName: `O Calçadão - ${String(reservation?.package_name ?? "Banner regional")}`,
          priceCents,
          customId: safeCustomId(["ocalcadao", "banner", campaignId]),
        });
      } catch (error) {
        await admin.from("highlight_campaigns").update({
          status: "cancelled",
          completed_at: new Date().toISOString(),
          reservation_expires_at: null,
        }).eq("id", campaignId).eq("user_id", user.id).eq("status", "pending");
        throw error;
      }

      const { data: attachedCampaign, error: attachError } = await admin
        .from("highlight_campaigns")
        .update({
          provider_charge_id: checkout.chargeId,
          provider_payment_url: checkout.paymentUrl,
        })
        .eq("id", campaignId)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (attachError || !attachedCampaign) {
        throw attachError ?? new Error("BANNER_RESERVATION_ATTACH_FAILED");
      }
      return json({ ok: true, payment_url: checkout.paymentUrl });
    }

    return json({ ok: false, error: "acao_invalida" }, 400);
  } catch (error) {
    const diagnosticId = await logCheckoutError(admin, body, error);
    console.error("Falha no checkout Efí", {
      diagnosticId,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    if (error instanceof Error && error.message === "EFI_NOT_CONFIGURED") {
      return json({ ok: false, error: "efi_nao_configurada", diagnostic_id: diagnosticId }, 503);
    }
    return json({ ok: false, error: "checkout_efi", diagnostic_id: diagnosticId }, 502);
  }
});
