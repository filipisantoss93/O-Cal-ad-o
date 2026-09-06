import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getEfiChargeNotification } from "@/lib/efi/cobrancas";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function notificationToken(request: Request) {
  const text = await request.text();
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const payload = JSON.parse(text) as { notification?: unknown };
      return typeof payload.notification === "string"
        ? payload.notification.trim()
        : "";
    } catch {
      return "";
    }
  }

  return new URLSearchParams(text).get("notification")?.trim() ?? "";
}

export async function POST(request: Request) {
  const token = await notificationToken(request);
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "notification ausente" },
      { status: 400 },
    );
  }

  try {
    const notification = await getEfiChargeNotification(token);
    const events = [...(notification.data ?? [])].sort(
      (a, b) => (a.id ?? 0) - (b.id ?? 0),
    );
    const admin = createAdminClient() as unknown as SupabaseClient<any>;

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

      if (error) {
        throw new Error(`Falha ao processar evento Efí ${eventId}: ${error.message}`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Falha ao processar notificação Efí", error);
    return NextResponse.json(
      { ok: false, error: "falha temporária" },
      { status: 500 },
    );
  }
}
