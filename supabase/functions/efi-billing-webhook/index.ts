import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type EfiAuthorizeResponse = { access_token?: string };
type EfiNotificationResponse = {
  data?: Array<{
    id?: number;
    type?: string;
    custom_id?: string | null;
    status?: { current?: string; previous?: string | null };
    identifiers?: {
      subscription_id?: number;
      charge_id?: number;
    };
    created_at?: string;
  }>;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
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
    console.error("Efí OAuth do webhook falhou", { status: response.status });
    throw new Error("EFI_AUTH_FAILED");
  }
  return { baseUrl: config.baseUrl, token: payload.access_token };
}

async function getNotification(token: string) {
  const { baseUrl, token: accessToken } = await getAccessToken();
  const response = await fetch(`${baseUrl}/v1/notification/${encodeURIComponent(token)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const payload = await readJson(response);
  if (!response.ok) {
    console.error("Efí recusou consulta de notificação", { status: response.status });
    throw new Error("EFI_NOTIFICATION_FAILED");
  }
  return payload as EfiNotificationResponse;
}

async function notificationToken(request: Request) {
  const text = await request.text();
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const payload = JSON.parse(text) as { notification?: unknown };
      return typeof payload.notification === "string" ? payload.notification.trim() : "";
    } catch {
      return "";
    }
  }
  return new URLSearchParams(text).get("notification")?.trim() ?? "";
}

function adminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRole) throw new Error("SUPABASE_ADMIN_MISSING");
  return createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  if (!getEfiConfig()) {
    return json({ ok: false, error: "efi_nao_configurada" }, 503);
  }

  const token = await notificationToken(request);
  if (!token) return json({ ok: false, error: "notification_ausente" }, 400);

  try {
    const notification = await getNotification(token);
    const events = [...(notification.data ?? [])].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    const admin = adminClient();

    for (const event of events) {
      const eventId = event.id;
      const status = event.status?.current?.trim();
      if (!eventId || !status) continue;

      const subscriptionId = event.identifiers?.subscription_id
        ? String(event.identifiers.subscription_id)
        : null;
      const chargeId = event.identifiers?.charge_id
        ? String(event.identifiers.charge_id)
        : null;
      const providerObjectId = subscriptionId ?? chargeId ?? "unknown";
      const eventType = event.type ?? "unknown";

      const { error } = await admin.rpc("process_efi_billing_event", {
        p_event_key: `efi:${providerObjectId}:${eventType}:${eventId}:${status}`,
        p_event_type: eventType,
        p_status: status,
        p_subscription_id: subscriptionId,
        p_charge_id: chargeId,
        p_payload: event,
      });
      if (error) throw new Error(`PROCESS_EVENT:${eventId}:${error.message}`);
    }

    return json({ ok: true });
  } catch (error) {
    console.error("Falha ao processar notificação Efí", error instanceof Error ? error.message : error);
    return json({ ok: false, error: "falha_temporaria" }, 500);
  }
});
