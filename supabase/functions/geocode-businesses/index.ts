import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TOKEN_HASH = "caec7186d2264f46f018a6ee45ab34c9df2e897de9b3272dfaba744ad7cd419f";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const VIACEP_URL = "https://viacep.com.br/ws";
const GOOGLE_FALLBACK_URL = "https://ocalcadao.com.br/api/internal/geocode-business";
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
type CandidateAddress = {
  house_number?: unknown;
  road?: unknown;
  pedestrian?: unknown;
  residential?: unknown;
  neighbourhood?: unknown;
  suburb?: unknown;
  postcode?: unknown;
};
type Candidate = {
  lat?: unknown;
  lon?: unknown;
  name?: unknown;
  display_name?: unknown;
  type?: unknown;
  addresstype?: unknown;
  namedetails?: Record<string, unknown>;
  address?: CandidateAddress;
};

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
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
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
      // Fall back while the project still exposes the legacy service-role key.
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
  if (!normalized || normalized === "nao informado") return "";
  return value.trim();
}

function normalizeAddressText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizedHouseNumber(value: unknown) {
  const match = normalizeAddressText(value).match(/\b\d+[a-z]?\b/i);
  return match?.[0] ?? "";
}

function streetTokens(value: unknown) {
  const ignored = new Set([
    "rua", "r", "avenida", "av", "rodovia", "rod", "travessa", "tv",
    "alameda", "praca", "pca", "estrada", "est", "logradouro"
  ]);
  return normalizeAddressText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !ignored.has(token));
}

function candidateRoad(candidate: Candidate) {
  const address = candidate.address ?? {};
  return address.road ?? address.pedestrian ?? address.residential ?? "";
}

function businessNameTokens(value: unknown) {
  const ignored = new Set([
    "assis", "sp", "ltda", "eireli", "me", "mei", "comercio", "comercial",
    "loja", "lojas", "de", "da", "do", "das", "dos", "e"
  ]);
  return normalizeAddressText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !ignored.has(token));
}

function candidateName(candidate: Candidate) {
  const named = candidate.namedetails ?? {};
  return candidate.name ?? named.name ?? named["name:pt"] ??
    (typeof candidate.display_name === "string" ? candidate.display_name.split(",")[0] : "");
}

function roadSimilarity(expected: unknown, actual: unknown) {
  const expectedTokens = streetTokens(expected);
  const actualTokens = new Set(streetTokens(actual));
  if (!expectedTokens.length || !actualTokens.size) return 0;
  const matched = expectedTokens.filter((token) => actualTokens.has(token)).length;
  return matched / expectedTokens.length;
}

function nameSimilarity(expected: unknown, actual: unknown) {
  const expectedTokens = businessNameTokens(expected);
  const actualTokens = new Set(businessNameTokens(actual));
  if (!expectedTokens.length || !actualTokens.size) return 0;
  const matched = expectedTokens.filter((token) => actualTokens.has(token)).length;
  return matched / expectedTokens.length;
}

function candidateMatchesNamedPoi(candidate: Candidate, business: BusinessRow) {
  if (nameSimilarity(business.name, candidateName(candidate)) < 0.7) return false;
  if (roadSimilarity(business.street, candidateRoad(candidate)) < 0.6) return false;

  const expectedNumber = normalizedHouseNumber(business.address_number);
  const actualNumber = normalizedHouseNumber(candidate.address?.house_number);
  if (actualNumber && expectedNumber && actualNumber !== expectedNumber) return false;

  const expectedPostal = (business.postal_code ?? "").replace(/\D/g, "");
  const actualPostal = normalizeAddressText(candidate.address?.postcode).replace(/\D/g, "");
  if (
    expectedPostal.length === 8 &&
    actualPostal.length === 8 &&
    expectedPostal.slice(0, 5) !== actualPostal.slice(0, 5)
  ) return false;

  return true;
}

function candidateMatchesAddress(candidate: Candidate, business: BusinessRow) {
  const expectedNumber = normalizedHouseNumber(business.address_number);
  if (!expectedNumber) return false;

  const actualNumber = normalizedHouseNumber(candidate.address?.house_number);
  if (!actualNumber || actualNumber !== expectedNumber) return false;

  const expectedStreet = streetTokens(business.street);
  const actualStreet = new Set(streetTokens(candidateRoad(candidate)));
  if (!expectedStreet.length || !actualStreet.size) return false;

  const matched = expectedStreet.filter((token) => actualStreet.has(token)).length;
  const similarity = matched / expectedStreet.length;
  if (similarity < 0.6) return false;

  const expectedPostal = (business.postal_code ?? "").replace(/\D/g, "");
  const actualPostal = normalizeAddressText(candidate.address?.postcode).replace(/\D/g, "");
  if (
    expectedPostal.length === 8 &&
    actualPostal.length === 8 &&
    expectedPostal.slice(0, 5) !== actualPostal.slice(0, 5)
  ) return false;

  return true;
}

let lastViaCepRequestAt = 0;

async function discoverPostalCode(business: BusinessRow, city: CityRow) {
  const existing = (business.postal_code ?? "").replace(/\D/g, "");
  if (existing.length === 8) return existing;

  const street = business.street.trim();
  if (street.length < 3) return "";

  const waitMs = Math.max(0, 250 - (Date.now() - lastViaCepRequestAt));
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastViaCepRequestAt = Date.now();

  try {
    const url = [
      VIACEP_URL,
      encodeURIComponent(city.state_code),
      encodeURIComponent(city.name),
      encodeURIComponent(street),
      "json",
    ].join("/");

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Referer: "https://ocalcadao.com.br/",
        "User-Agent": "O-Calcadao/1.0 (+https://ocalcadao.com.br/contato)",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return "";

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return "";

    let bestCep = "";
    let bestScore = 0;
    for (const item of payload) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const uf = String(row.uf ?? "").trim().toUpperCase();
      const locality = normalizeAddressText(row.localidade);
      if (uf !== city.state_code.toUpperCase()) continue;
      if (locality !== normalizeAddressText(city.name)) continue;

      const score = roadSimilarity(business.street, row.logradouro);
      if (score < 0.6 || score <= bestScore) continue;

      const cep = String(row.cep ?? "").replace(/\D/g, "");
      if (cep.length !== 8) continue;
      bestCep = cep;
      bestScore = score;
    }
    return bestCep;
  } catch {
    return "";
  }
}

function addressQueries(business: BusinessRow, city: CityRow) {
  const number = /\d/.test(business.address_number)
    ? business.address_number.trim()
    : "";
  const streetWithNumber = [business.street.trim(), number]
    .filter(Boolean)
    .join(", ");
  const neighborhood = cleanNeighborhood(business.neighborhood);
  const postalCode = (business.postal_code ?? "").replace(/\D/g, "");

  const queries = [
    [
      business.name,
      streetWithNumber,
      neighborhood,
      city.name,
      city.state_code,
      postalCode.length === 8 ? postalCode : "",
      "Brasil",
    ]
      .filter(Boolean)
      .join(", "),
    [
      streetWithNumber,
      neighborhood,
      city.name,
      city.state_code,
      postalCode.length === 8 ? postalCode : "",
      "Brasil",
    ]
      .filter(Boolean)
      .join(", "),
    [streetWithNumber, city.name, city.state_code, "Brasil"]
      .filter(Boolean)
      .join(", "),
  ];

  return [...new Set(queries.filter(Boolean))];
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
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("namedetails", "1");

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
    ? payload.filter(
        (item): item is Candidate => typeof item === "object" && item !== null,
      )
    : [];
}

async function geocodeStructured(
  business: BusinessRow,
  city: CityRow,
  postalCode: string,
) {
  const waitMs = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt));
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastRequestAt = Date.now();

  const number = normalizedHouseNumber(business.address_number);
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("street", [number, business.street.trim()].filter(Boolean).join(" "));
  url.searchParams.set("city", city.name);
  url.searchParams.set("state", city.state_code);
  url.searchParams.set("country", "Brasil");
  if (postalCode.length === 8) url.searchParams.set("postalcode", postalCode);
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("namedetails", "1");

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
    ? payload.filter(
        (item): item is Candidate => typeof item === "object" && item !== null,
      )
    : [];
}

async function geocodeWithGoogle(
  business: BusinessRow,
  city: CityRow,
  token: string,
) {
  try {
    const response = await fetch(GOOGLE_FALLBACK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Geocoding-Token": token,
      },
      body: JSON.stringify({
        name: business.name,
        street: business.street,
        addressNumber: business.address_number,
        neighborhood: business.neighborhood,
        postalCode: business.postal_code,
        city: city.name,
        stateCode: city.state_code,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;

    const payload = await response.json() as {
      enabled?: boolean;
      found?: boolean;
      latitude?: unknown;
      longitude?: unknown;
      placeId?: unknown;
    };
    if (!payload.enabled || !payload.found) return null;

    const latitude = Number(payload.latitude);
    const longitude = Number(payload.longitude);
    if (
      !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180
    ) return null;

    return {
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      placeId: typeof payload.placeId === "string" ? payload.placeId : null,
    };
  } catch {
    return null;
  }
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
    const { data: claimed, error: claimError } = await supabase
      .from("business_geocoding_queue")
      .update({ next_attempt_at: claimUntil, updated_at: new Date().toISOString() })
      .eq("business_id", queue.business_id)
      .eq("status", "pending")
      .lte("next_attempt_at", dueAt)
      .select("business_id, attempts")
      .maybeSingle();

    if (claimError || !claimed) continue;

    const { data: businessData, error: businessError } = await supabase
      .from("businesses")
      .select("id,name,city_id,street,address_number,neighborhood,postal_code,latitude,longitude,listing_type")
      .eq("id", queue.business_id)
      .maybeSingle();

    if (businessError || !businessData) {
      await supabase.from("business_geocoding_queue").delete().eq("business_id", queue.business_id);
      results.push({ id: queue.business_id, status: "removed_missing_business" });
      continue;
    }

    const business = businessData as BusinessRow;
    if (
      business.listing_type !== "business" ||
      (business.latitude !== null && business.longitude !== null)
    ) {
      await supabase.from("business_geocoding_queue").delete().eq("business_id", business.id);
      results.push({ id: business.id, status: "removed_not_needed" });
      continue;
    }

    const { data: cityData, error: cityError } = await supabase
      .from("cities")
      .select("id,name,state_code")
      .eq("id", business.city_id)
      .eq("is_active", true)
      .maybeSingle();

    if (cityError || !cityData) {
      await supabase
        .from("business_geocoding_queue")
        .update({
          status: "failed",
          attempts: queue.attempts + 1,
          last_error: "Cidade inválida ou inativa.",
          updated_at: new Date().toISOString(),
        })
        .eq("business_id", business.id);
      results.push({ id: business.id, status: "failed_invalid_city" });
      continue;
    }

    const city = cityData as CityRow;
    let found: { latitude: number; longitude: number } | null = null;
    let upstreamError = "";

    const discoveredPostalCode = await discoverPostalCode(business, city);
    const geocodeBusiness: BusinessRow = discoveredPostalCode
      ? { ...business, postal_code: discoveredPostalCode }
      : business;

    const acceptCandidate = async (candidate: Candidate) => {
      const latitude = Number(candidate.lat);
      const longitude = Number(candidate.lon);
      if (
        !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180
      ) return null;

      if (
        !candidateMatchesAddress(candidate, geocodeBusiness) &&
        !candidateMatchesNamedPoi(candidate, geocodeBusiness)
      ) return null;

      const { data: resolvedCities, error: resolverError } = await supabase.rpc(
        "resolve_city_by_coordinates",
        { input_latitude: latitude, input_longitude: longitude },
      );
      if (resolverError || resolvedCities?.[0]?.id !== city.id) return null;

      return {
        latitude: Number(latitude.toFixed(6)),
        longitude: Number(longitude.toFixed(6)),
      };
    };

    for (const query of addressQueries(geocodeBusiness, city)) {
      let candidates: Candidate[] = [];
      try {
        candidates = await geocode(query);
      } catch (error) {
        upstreamError = error instanceof Error ? error.message : "GEOCODER_ERROR";
        break;
      }

      for (const candidate of candidates) {
        found = await acceptCandidate(candidate);
        if (found) break;
      }
      if (found) break;
    }

    if (!found && !upstreamError) {
      try {
        const candidates = await geocodeStructured(
          geocodeBusiness,
          city,
          discoveredPostalCode,
        );
        for (const candidate of candidates) {
          found = await acceptCandidate(candidate);
          if (found) break;
        }
      } catch (error) {
        upstreamError = error instanceof Error ? error.message : "GEOCODER_ERROR";
      }
    }

    if (!found) {
      const google = await geocodeWithGoogle(geocodeBusiness, city, providedToken);
      if (google) {
        const { data: resolvedCities, error: resolverError } = await supabase.rpc(
          "resolve_city_by_coordinates",
          { input_latitude: google.latitude, input_longitude: google.longitude },
        );
        if (!resolverError && resolvedCities?.[0]?.id === city.id) {
          found = { latitude: google.latitude, longitude: google.longitude };
        }
      }
    }

    if (found) {
      const { data: applied, error: applyError } = await supabase.rpc(
        "apply_business_geocoding",
        {
          p_business_id: business.id,
          p_latitude: found.latitude,
          p_longitude: found.longitude,
        },
      );

      if (!applyError && applied === true) {
        await supabase.from("business_geocoding_queue").delete().eq("business_id", business.id);
        results.push({
          id: business.id,
          status: "updated",
          latitude: found.latitude,
          longitude: found.longitude,
        });
        continue;
      }

      upstreamError = applyError
        ? `APPLY_FAILED:${applyError.message}`
        : "APPLY_REJECTED";
    }

    const attempts = queue.attempts + 1;
    const isPermanentNotFound = !upstreamError && attempts >= 3;
    const isFailed = isPermanentNotFound || attempts >= MAX_ATTEMPTS;
    const retryMinutes = Math.min(60, 5 * 2 ** Math.max(0, attempts - 1));
    const errorMessage = upstreamError
      ? `Falha temporária no geocodificador: ${upstreamError}`
      : "Endereço não localizado com segurança dentro do município cadastrado.";

    await supabase
      .from("business_geocoding_queue")
      .update({
        status: isFailed ? "failed" : "pending",
        attempts,
        next_attempt_at: new Date(Date.now() + retryMinutes * 60_000).toISOString(),
        last_error: errorMessage.slice(0, 1000),
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", business.id);

    results.push({
      id: business.id,
      status: isFailed ? "failed" : "retry_scheduled",
      attempts,
    });
  }

  return json({
    processed: results.length,
    updated: results.filter((item) => item.status === "updated").length,
    retried: results.filter((item) => item.status === "retry_scheduled").length,
    failed: results.filter((item) => item.status === "failed").length,
    results,
  });
});
