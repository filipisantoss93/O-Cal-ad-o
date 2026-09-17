import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TOKEN_HASH = "caec7186d2264f46f018a6ee45ab34c9df2e897de9b3272dfaba744ad7cd419f";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const MIN_INTERVAL_MS = 1100;
const MAX_ATTEMPTS = 5;

type QueueRow = { business_id: number; attempts: number };
type BusinessRow = {
  id: number;
  name: string;
  city_id: number;
  street: string;
  address_number: string;
  neighborhood: string;
  postal_code: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  listing_type: string;
};
type CityRow = { id: number; name: string; state_code: string };
type Candidate = { lat?: unknown; lon?: unknown };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function adminKey() {
  const current = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (current) {
    try {
      const keys = JSON.parse(current) as Record<string, string>;
      if (keys.default) return keys.default;
    } catch {
      // Fallback abaixo.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function cleanNeighborhood(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return !normalized || normalized === "nao informado" ? "" : value.trim();
}

function addressQueries(business: BusinessRow, city: CityRow) {
  const number = /\d/.test(business.address_number) ? business.address_number.trim() : "";
  const streetWithNumber = [business.street.trim(), number].filter(Boolean).join(", ");
  const neighborhood = cleanNeighborhood(business.neighborhood);
  const postalCode = (business.postal_code ?? "").replace(/\D/g, "");

  return [...new Set([
    [
      streetWithNumber,
      neighborhood,
      city.name,
      city.state_code,
      postalCode.length === 8 ? postalCode : "",
      "Brasil",
    ].filter(Boolean).join(", "),
    [streetWithNumber, city.name, city.state_code, "Brasil"].filter(Boolean).join(", "),
  ].filter(Boolean))];
}

let lastRequestAt = 0;
async function geocode(query: string) {
  const waitMs = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt));
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastRequestAt = Date.now();

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "0");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "pt-BR,pt;q=0.9",
      Referer: "https://ocalcadao.com.br/",
      "User-Agent": "O-Calcadao/1.0 (+https://ocalcadao.com.br/contato)",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`GEOCODER_HTTP_${response.status}`);

  const payload: unknown = await response.json();
  return Array.isArray(payload)
    ? payload.filter((item): item is Candidate => typeof item === "object" && item !== null)
    : [];
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const providedToken = request.headers.get("X-Geocoding-Token") ?? "";
  if (!providedToken || (await sha256(providedToken)) !== TOKEN_HASH) {
    return json({ error: "Não autorizado." }, 403);
  }

  let body: Record<string, unknown> = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    body = {};
  }

  const requestedLimit = Number(body.limit ?? 8);
  const limit = Number.isSafeInteger(requestedLimit)
    ? Math.max(1, Math.min(requestedLimit, 8))
    : 8;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const secretKey = adminKey();
  if (!supabaseUrl || !secretKey) {
    return json({ error: "Ambiente do Supabase indisponível." }, 500);
  }

  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const dueAt = new Date().toISOString();
  const { data: queueRows, error: queueError } = await supabase
    .from("business_geocoding_queue")
    .select("business_id, attempts")
    .eq("status", "pending")
    .lte("next_attempt_at", dueAt)
    .order("next_attempt_at", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (queueError) return json({ error: queueError.message }, 500);

  const results: Array<Record<string, unknown>> = [];

  for (const queue of (queueRows ?? []) as QueueRow[]) {
    const claimUntil = new Date(Date.now() + 2 * 60_000).toISOString();
    const { data: claimed } = await supabase
      .from("business_geocoding_queue")
      .update({ next_attempt_at: claimUntil, updated_at: new Date().toISOString() })
      .eq("business_id", queue.business_id)
      .eq("status", "pending")
      .lte("next_attempt_at", dueAt)
      .select("business_id, attempts")
      .maybeSingle();

    if (!claimed) continue;

    const { data: businessData, error: businessError } = await supabase
      .from("businesses")
      .select("id,name,city_id,street,address_number,neighborhood,postal_code,latitude,longitude,listing_type")
      .eq("id", queue.business_id)
      .maybeSingle();

    if (businessError || !businessData) {
      await supabase.from("business_geocoding_queue").delete().eq("business_id", queue.business_id);
      continue;
    }

    const business = businessData as BusinessRow;
    if (business.listing_type !== "business" || (business.latitude !== null && business.longitude !== null)) {
      await supabase.from("business_geocoding_queue").delete().eq("business_id", business.id);
      continue;
    }

    const { data: cityData, error: cityError } = await supabase
      .from("cities")
      .select("id,name,state_code")
      .eq("id", business.city_id)
      .eq("is_active", true)
      .maybeSingle();

    if (cityError || !cityData) {
      await supabase.from("business_geocoding_queue").update({
        status: "failed",
        attempts: queue.attempts + 1,
        last_error: "Cidade inválida ou inativa.",
        updated_at: new Date().toISOString(),
      }).eq("business_id", business.id);
      continue;
    }

    const city = cityData as CityRow;
    let found: { latitude: number; longitude: number } | null = null;
    let upstreamError = "";

    for (const query of addressQueries(business, city)) {
      let candidates: Candidate[] = [];
      try {
        candidates = await geocode(query);
      } catch (error) {
        upstreamError = error instanceof Error ? error.message : "GEOCODER_ERROR";
        break;
      }

      for (const candidate of candidates) {
        const latitude = Number(candidate.lat);
        const longitude = Number(candidate.lon);
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) continue;

        const { data: resolvedCities } = await supabase.rpc("resolve_city_by_coordinates", {
          input_latitude: latitude,
          input_longitude: longitude,
        });

        if (resolvedCities?.[0]?.id === city.id) {
          found = {
            latitude: Number(latitude.toFixed(6)),
            longitude: Number(longitude.toFixed(6)),
          };
          break;
        }
      }
      if (found) break;
    }

    if (found) {
      const { data: applied, error: applyError } = await supabase.rpc("apply_business_geocoding", {
        p_business_id: business.id,
        p_latitude: found.latitude,
        p_longitude: found.longitude,
      });

      if (!applyError && applied === true) {
        await supabase.from("business_geocoding_queue").delete().eq("business_id", business.id);
        results.push({ id: business.id, status: "updated" });
        continue;
      }
      upstreamError = applyError ? `APPLY_FAILED:${applyError.message}` : "APPLY_REJECTED";
    }

    const attempts = queue.attempts + 1;
    const isPermanentNotFound = !upstreamError && attempts >= 3;
    const isFailed = isPermanentNotFound || attempts >= MAX_ATTEMPTS;
    const retryMinutes = Math.min(60, 5 * 2 ** Math.max(0, attempts - 1));
    const errorMessage = upstreamError
      ? `Falha temporária no geocodificador: ${upstreamError}`
      : "Endereço não localizado com segurança dentro do município cadastrado.";

    await supabase.from("business_geocoding_queue").update({
      status: isFailed ? "failed" : "pending",
      attempts,
      next_attempt_at: new Date(Date.now() + retryMinutes * 60_000).toISOString(),
      last_error: errorMessage.slice(0, 1000),
      updated_at: new Date().toISOString(),
    }).eq("business_id", business.id);

    results.push({ id: business.id, status: isFailed ? "failed" : "retry_scheduled" });
  }

  return json({
    processed: results.length,
    updated: results.filter((item) => item.status === "updated").length,
    retried: results.filter((item) => item.status === "retry_scheduled").length,
    failed: results.filter((item) => item.status === "failed").length,
    results,
  });
});
