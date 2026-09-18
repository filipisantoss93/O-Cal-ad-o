import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function keySet(envName: string) {
  const raw = Deno.env.get(envName);
  if (!raw) return new Set<string>();

  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return new Set(Object.values(parsed).filter(Boolean));
  } catch {
    return new Set([raw]);
  }
}

function adminKey() {
  const keys = keySet("SUPABASE_SECRET_KEYS");
  const first = keys.values().next().value as string | undefined;
  return first ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function allowedPublicKey(req: Request) {
  const supplied = req.headers.get("apikey") ?? "";
  if (!supplied) return false;

  const allowed = keySet("SUPABASE_PUBLISHABLE_KEYS");
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacy) allowed.add(legacy);

  return allowed.has(supplied);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  if (!allowedPublicKey(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { businessIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!Array.isArray(body.businessIds)) {
    return Response.json({ error: "invalid_business_ids" }, { status: 400 });
  }

  const ids = [...new Set(body.businessIds.map(Number))];
  if (
    ids.length === 0 ||
    ids.length > 100 ||
    ids.some((id) => !Number.isSafeInteger(id) || id <= 0)
  ) {
    return Response.json({ error: "invalid_business_ids" }, { status: 400 });
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const secret = adminKey();
  if (!url || !secret) {
    return Response.json({ error: "server_config" }, { status: 500 });
  }

  const admin = createClient(url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await admin.rpc("get_public_business_logo_paths", {
    p_business_ids: ids,
  });

  if (error) {
    console.error("[resolve-business-logos] rpc failed", error.message);
    return Response.json({ error: "lookup_failed" }, { status: 500 });
  }

  return Response.json(
    { logos: data ?? [] },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300",
        "Content-Type": "application/json",
      },
    },
  );
});
