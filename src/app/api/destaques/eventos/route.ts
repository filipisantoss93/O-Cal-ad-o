import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type EventRequest = {
  campaignIds?: unknown;
  eventType?: unknown;
};

const visitorCookie = "ocalcadao_visitor";
const allowedEvents = new Set([
  "impression",
  "store_view",
  "whatsapp",
  "directions",
]);

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function POST(request: NextRequest) {
  let body: EventRequest;
  try {
    body = (await request.json()) as EventRequest;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const eventType = String(body.eventType ?? "");
  const campaignIds = Array.isArray(body.campaignIds)
    ? [...new Set(body.campaignIds.map(Number))]
        .filter((id) => Number.isSafeInteger(id) && id > 0)
        .slice(0, 8)
    : [];
  if (!allowedEvents.has(eventType) || campaignIds.length === 0) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const existingVisitor = request.cookies.get(visitorCookie)?.value;
  const visitorId =
    existingVisitor && /^[a-f0-9-]{36}$/.test(existingVisitor)
      ? existingVisitor
      : crypto.randomUUID();
  const visitorHash = await sha256(visitorId);
  const supabase = await createClient();

  await Promise.all(
    campaignIds.map((campaignId) =>
      supabase.rpc("record_highlight_event", {
        p_campaign_id: campaignId,
        p_event_type: eventType,
        p_visitor_hash: visitorHash,
      }),
    ),
  );

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
  if (!existingVisitor) {
    response.cookies.set(visitorCookie, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}
