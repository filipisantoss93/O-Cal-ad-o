import { createHash } from "node:crypto";

const TOKEN_HASH = "caec7186d2264f46f018a6ee45ab34c9df2e897de9b3272dfaba744ad7cd419f";
const GOOGLE_TEXT_SEARCH = "https://places.googleapis.com/v1/places:searchText";

type RequestBody = {
  name?: unknown;
  street?: unknown;
  addressNumber?: unknown;
  neighborhood?: unknown;
  postalCode?: unknown;
  city?: unknown;
  stateCode?: unknown;
};

type AddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: AddressComponent[];
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalize(value: unknown) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function numberToken(value: unknown) {
  return normalize(value).match(/\b\d+[a-z]?\b/i)?.[0] ?? "";
}

function tokens(value: unknown, ignored = new Set<string>()) {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !ignored.has(token));
}

function similarity(expected: unknown, actual: unknown, ignored = new Set<string>()) {
  const expectedTokens = tokens(expected, ignored);
  const actualTokens = new Set(tokens(actual, ignored));
  if (!expectedTokens.length || !actualTokens.size) return 0;
  return expectedTokens.filter((token) => actualTokens.has(token)).length / expectedTokens.length;
}

function component(place: GooglePlace, type: string, short = false) {
  const found = place.addressComponents?.find((item) => item.types?.includes(type));
  return short ? found?.shortText ?? "" : found?.longText ?? "";
}

const streetIgnored = new Set(["rua", "r", "avenida", "av", "rodovia", "rod", "travessa", "tv", "alameda", "praca", "pca", "estrada", "est"]);
const nameIgnored = new Set(["sp", "ltda", "eireli", "me", "mei", "comercio", "comercial", "loja", "lojas", "de", "da", "do", "das", "dos", "e"]);

function placeMatches(place: GooglePlace, body: Required<Pick<RequestBody, "name" | "street" | "addressNumber" | "city" | "stateCode">> & RequestBody) {
  const expectedState = text(body.stateCode).toUpperCase();
  const actualState = component(place, "administrative_area_level_1", true).toUpperCase();
  if (!actualState || actualState !== expectedState) return false;

  const actualCity =
    component(place, "locality") ||
    component(place, "administrative_area_level_2") ||
    component(place, "sublocality");
  if (!actualCity || normalize(actualCity) !== normalize(body.city)) return false;

  const actualStreet = component(place, "route");
  if (!actualStreet || similarity(body.street, actualStreet, streetIgnored) < 0.6) return false;

  const expectedNumber = numberToken(body.addressNumber);
  const actualNumber = numberToken(component(place, "street_number"));
  // A matching business name is not proof that a street-centre coordinate identifies the correct door.
  if (!expectedNumber || !actualNumber || expectedNumber !== actualNumber) return false;

  const cityTokens = normalize(body.city).split(" ").filter(Boolean);
  const ignoredNameTokens = new Set([...nameIgnored, ...cityTokens, normalize(body.stateCode)]);
  const nameScore = similarity(body.name, place.displayName?.text ?? "", ignoredNameTokens);
  // The exact address is sufficient; different shop names at the same door are allowed.
  void nameScore;

  const expectedPostal = text(body.postalCode).replace(/\D/g, "");
  const actualPostal = text(component(place, "postal_code")).replace(/\D/g, "");
  if (
    expectedPostal.length === 8 &&
    actualPostal.length === 8 &&
    expectedPostal.slice(0, 5) !== actualPostal.slice(0, 5)
  ) return false;

  const latitude = Number(place.location?.latitude);
  const longitude = Number(place.location?.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude);
}

export async function POST(request: Request) {
  const providedToken = request.headers.get("X-Geocoding-Token") ?? "";
  if (!providedToken || sha256(providedToken) !== TOKEN_HASH) {
    return Response.json({ error: "Não autorizado." }, { status: 403 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json({ error: "Payload inválido." }, { status: 400 });
  }

  const name = text(body.name);
  const street = text(body.street);
  const addressNumber = text(body.addressNumber);
  const city = text(body.city);
  const stateCode = text(body.stateCode).toUpperCase();
  if (!name || !street || !addressNumber || !city || stateCode.length !== 2) {
    return Response.json({ error: "Endereço incompleto." }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    console.info("[google-geocode] disabled_missing_key");
    return Response.json({ enabled: false, found: false });
  }

  const query = [
    name,
    street,
    addressNumber,
    text(body.neighborhood),
    city,
    stateCode,
    text(body.postalCode),
    "Brasil",
  ].filter(Boolean).join(", ");

  const response = await fetch(GOOGLE_TEXT_SEARCH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents",
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "pt-BR",
      regionCode: "BR",
      maxResultCount: 5,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    console.error("[google-geocode] Places search failed", response.status);
    return Response.json({ enabled: true, found: false, upstreamStatus: response.status });
  }

  const payload = (await response.json()) as { places?: GooglePlace[] };
  const normalizedBody = { ...body, name, street, addressNumber, city, stateCode };
  const place = (payload.places ?? []).find((candidate) => placeMatches(candidate, normalizedBody));
  if (!place) {
    console.info("[google-geocode] no_match", { name, city, stateCode });
    return Response.json({ enabled: true, found: false });
  }

  console.info("[google-geocode] matched", { name, city, placeId: place.id ?? null });
  const latitude = Number(place.location?.latitude);
  const longitude = Number(place.location?.longitude);
  return Response.json({
    enabled: true,
    found: true,
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
    placeId: place.id ?? null,
    formattedAddress: place.formattedAddress ?? null,
  });
}
