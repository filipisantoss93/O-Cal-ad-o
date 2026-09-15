import { createClient } from "@/lib/supabase/server";

const defaultGeocodingApiUrl = "https://nominatim.openstreetmap.org/search";
const minimumUpstreamIntervalMs = 1_100;

let lastUpstreamRequestAt = 0;
let upstreamQueue: Promise<void> = Promise.resolve();

type GeocodingCandidate = {
  lat?: unknown;
  lon?: unknown;
};

function bodyText(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

function queuedGeocodingRequest(url: URL) {
  const request = upstreamQueue.then(async () => {
    const waitMs = Math.max(
      0,
      minimumUpstreamIntervalMs - (Date.now() - lastUpstreamRequestAt),
    );
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    lastUpstreamRequestAt = Date.now();
    return fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "pt-BR,pt;q=0.9",
        Referer: "https://ocalcadao.com.br/",
        "User-Agent": "O-Calcadao/1.0 (+https://ocalcadao.com.br/contato)",
      },
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 24 * 30 },
      signal: AbortSignal.timeout(15_000),
    });
  });

  upstreamQueue = request.then(
    () => undefined,
    () => undefined,
  );
  return request;
}

function geocodingEndpoint() {
  const configuredUrl =
    process.env.GEOCODING_API_URL?.trim() || defaultGeocodingApiUrl;
  const url = new URL(configuredUrl);
  if (url.protocol !== "https:") {
    throw new Error("O provedor de geocodificação precisa usar HTTPS.");
  }
  return url;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json(
      { error: "Sua sessão expirou. Entre novamente." },
      { status: 401 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4_096) {
    return Response.json({ error: "Endereço inválido." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Endereço inválido." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "Endereço inválido." }, { status: 400 });
  }

  const values = body as Record<string, unknown>;
  const cityId = Number(values.cityId);
  const street = bodyText(values, "street");
  const addressNumber = bodyText(values, "addressNumber");
  const neighborhood = bodyText(values, "neighborhood");
  const postalCode = bodyText(values, "postalCode").replace(/\D/g, "");

  if (
    !Number.isSafeInteger(cityId) ||
    cityId <= 0 ||
    street.length < 2 ||
    street.length > 160 ||
    addressNumber.length < 1 ||
    addressNumber.length > 20 ||
    neighborhood.length < 2 ||
    neighborhood.length > 120 ||
    (postalCode && !/^\d{8}$/.test(postalCode))
  ) {
    return Response.json(
      {
        error:
          "Preencha cidade, rua, número e bairro antes de buscar pelo endereço.",
      },
      { status: 400 },
    );
  }

  const { data: city, error: cityError } = await supabase
    .from("cities")
    .select("id, name, state_code")
    .eq("id", cityId)
    .eq("is_active", true)
    .maybeSingle();

  if (cityError || !city) {
    return Response.json(
      { error: "A cidade selecionada não está disponível." },
      { status: 400 },
    );
  }

  const { data: state, error: stateError } = await supabase
    .from("states")
    .select("name")
    .eq("code", city.state_code)
    .eq("is_active", true)
    .maybeSingle();

  if (stateError || !state) {
    return Response.json(
      { error: "O estado selecionado não está disponível." },
      { status: 400 },
    );
  }

  let response: Response;
  try {
    const url = geocodingEndpoint();
    const streetWithNumber = /\d/.test(addressNumber)
      ? `${street}, ${addressNumber}`
      : street;
    const addressQuery = [
      streetWithNumber,
      neighborhood,
      city.name,
      state.name,
      postalCode,
      "Brasil",
    ]
      .filter(Boolean)
      .join(", ");
    url.searchParams.set("q", addressQuery);
    url.searchParams.set("countrycodes", "br");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "5");
    url.searchParams.set("addressdetails", "0");

    response = await queuedGeocodingRequest(url);
  } catch {
    return Response.json(
      {
        error:
          "A busca pelo endereço está indisponível agora. Tente novamente em instantes.",
      },
      { status: 503 },
    );
  }

  if (!response.ok) {
    return Response.json(
      {
        error:
          "A busca pelo endereço está indisponível agora. Tente novamente em instantes.",
      },
      { status: 503 },
    );
  }

  let candidates: GeocodingCandidate[];
  try {
    const result: unknown = await response.json();
    candidates = Array.isArray(result)
      ? result.filter(
          (candidate): candidate is GeocodingCandidate =>
            typeof candidate === "object" && candidate !== null,
        )
      : [];
  } catch {
    candidates = [];
  }

  for (const candidate of candidates) {
    const latitude = Number(candidate.lat);
    const longitude = Number(candidate.lon);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      continue;
    }

    const { data: resolvedCities, error: resolverError } = await supabase.rpc(
      "resolve_city_by_coordinates",
      {
        input_latitude: latitude,
        input_longitude: longitude,
      },
    );
    if (resolverError) {
      return Response.json(
        { error: "Não foi possível validar as coordenadas encontradas." },
        { status: 500 },
      );
    }

    if (resolvedCities?.[0]?.id === city.id) {
      return Response.json(
        {
          latitude: Number(latitude.toFixed(6)),
          longitude: Number(longitude.toFixed(6)),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  return Response.json(
    {
      error:
        "Não encontramos esse endereço na cidade selecionada. Confira rua, número, bairro e CEP.",
    },
    { status: 404 },
  );
}
