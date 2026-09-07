import { createClient } from "@/lib/supabase/server";

type NearbyRequest = {
  cityId?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  businessIds?: unknown;
};

type NearbyRow = {
  id: number;
  slug: string;
  name: string;
  neighborhood: string;
  category_name: string;
  distance_km: number | null;
  highlight_campaign_id: number | null;
};

function validCoordinate(value: unknown, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function parseBusinessIds(value: unknown) {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length === 0 || value.length > 24) return undefined;
  const ids = value.map(Number);
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) return undefined;
  return [...new Set(ids)];
}

export async function POST(request: Request) {
  let body: NearbyRequest;
  try {
    body = (await request.json()) as NearbyRequest;
  } catch {
    return Response.json({ error: "Localização inválida." }, { status: 400 });
  }

  const cityId = Number(body.cityId);
  if (!Number.isSafeInteger(cityId) || cityId <= 0) {
    return Response.json({ error: "Cidade inválida." }, { status: 400 });
  }

  const hasCoordinates = body.latitude !== undefined || body.longitude !== undefined;
  const coordinatesAreValid =
    validCoordinate(body.latitude, -90, 90) &&
    validCoordinate(body.longitude, -180, 180);
  if (hasCoordinates && !coordinatesAreValid) {
    return Response.json({ error: "Coordenadas inválidas." }, { status: 400 });
  }

  const businessIds = parseBusinessIds(body.businessIds);
  if (businessIds === undefined) {
    return Response.json({ error: "Lista de comércios inválida." }, { status: 400 });
  }

  const supabase = await createClient();
  const rpc = supabase.rpc as unknown as (
    fn: "get_public_nearby_businesses",
    args: {
      p_city_id: number;
      p_latitude: number | null;
      p_longitude: number | null;
      p_business_ids: number[] | null;
      p_limit: number;
    },
  ) => Promise<{ data: NearbyRow[] | null; error: { message: string } | null }>;

  const { data, error } = await rpc("get_public_nearby_businesses", {
    p_city_id: cityId,
    p_latitude: coordinatesAreValid ? (body.latitude as number) : null,
    p_longitude: coordinatesAreValid ? (body.longitude as number) : null,
    p_business_ids: businessIds,
    p_limit: businessIds?.length ?? 3,
  });

  if (error) {
    console.error("[api/comercios-proximos] query failed", error.message);
    return Response.json(
      { error: "Não foi possível carregar os comércios próximos." },
      { status: 500 },
    );
  }

  const businesses = (data ?? []).map((business) => ({
    id: business.id,
    slug: business.slug,
    name: business.name,
    neighborhood: business.neighborhood,
    categoryName: business.category_name,
    distanceKm: business.distance_km,
    isFeatured: business.highlight_campaign_id !== null,
    highlightCampaignId: business.highlight_campaign_id,
  }));

  return Response.json(
    { businesses },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
