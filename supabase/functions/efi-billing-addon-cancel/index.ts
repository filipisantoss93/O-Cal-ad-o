import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type CancelBody = { addon_id?: number };
type EfiAuthorizeResponse = { access_token?: string };

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
  const payload = (await response.json().catch(() => ({}))) as EfiAuthorizeResponse;
  if (!response.ok || !payload.access_token) throw new Error("EFI_AUTH_FAILED");
  return { baseUrl: config.baseUrl, token: payload.access_token };
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const user = await currentUser(req);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);

  let body: CancelBody;
  try {
    body = await req.json() as CancelBody;
  } catch {
    return json({ ok: false, error: "payload_invalido" }, 400);
  }

  const addonId = Number(body.addon_id);
  if (!Number.isSafeInteger(addonId) || addonId <= 0) {
    return json({ ok: false, error: "adicional_invalido" }, 400);
  }

  const admin = adminClient();
  const { data: addon, error: addonError } = await admin
    .from("billing_addons")
    .select("id, user_id, product_code, status, active_until, provider, provider_subscription_id, cancel_at_period_end")
    .eq("id", addonId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (addonError) return json({ ok: false, error: "adicional_indisponivel" }, 500);
  if (!addon) return json({ ok: false, error: "adicional_invalido" }, 404);

  const { data: product, error: productError } = await admin
    .from("billing_products")
    .select("kind, billing_mode")
    .eq("code", addon.product_code)
    .maybeSingle();
  if (productError || !product) return json({ ok: false, error: "adicional_indisponivel" }, 500);
  if (product.kind !== "store_slot" || product.billing_mode !== "recurring") {
    return json({ ok: false, error: "adicional_nao_recorrente" }, 409);
  }
  if (addon.cancel_at_period_end) {
    return json({ ok: true, active_until: addon.active_until, already_scheduled: true });
  }
  if (!addon.provider_subscription_id || addon.provider !== "efi") {
    return json({ ok: false, error: "adicional_nao_cancelavel" }, 409);
  }
  if (!["active", "past_due"].includes(addon.status)) {
    return json({ ok: false, error: "adicional_nao_cancelavel" }, 409);
  }

  try {
    const { baseUrl, token } = await getAccessToken();
    const response = await fetch(
      `${baseUrl}/v1/subscription/${encodeURIComponent(addon.provider_subscription_id)}/cancel`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (!response.ok) {
      console.error("Efí recusou cancelamento de adicional", { status: response.status });
      return json({ ok: false, error: "cancelamento_efi" }, 502);
    }

    const { error: updateError } = await admin
      .from("billing_addons")
      .update({ cancel_at_period_end: true })
      .eq("id", addon.id)
      .eq("user_id", user.id);
    if (updateError) return json({ ok: false, error: "cancelamento_local" }, 500);

    return json({ ok: true, active_until: addon.active_until });
  } catch (error) {
    console.error("Falha ao cancelar adicional", error instanceof Error ? error.message : error);
    return json({ ok: false, error: "cancelamento_efi" }, 502);
  }
});
