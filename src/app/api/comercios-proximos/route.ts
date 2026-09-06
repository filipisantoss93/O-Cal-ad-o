import { createClient } from "@/lib/supabase/server";

type NearbyRequest = {
  cityId?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

function validCoordinate(value: unknown, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function distanceInKilometers(
  latitude: number,
  longitude: number,
  businessLatitude: number,
  businessLongitude: number,
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6_371;
  const latitudeDelta = radians(businessLatitude - latitude);
  const longitudeDelta = radians(businessLongitude - longitude);
  const startLatitude = radians(latitude);
  const endLatitude = radians(businessLatitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
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

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .select(
      "id, slug, name, neighborhood, latitude, longitude, plan, featured_until, category_id, categories(name)",
    )
    .eq("city_id", cityId)
    .eq("status", "approved")
    .eq("is_active", true)
    .limit(100);

  if (error) {
    console.error("[api/comercios-proximos] query failed", {
      code: error.code,
      message: error.message,
    });
    return Response.json(
      { error: "Não foi possível carregar os comércios próximos." },
      { status: 500 },
    );
  }

  const now = Date.now();
  const businesses = (data ?? [])
    .map((business) => {
      const businessLatitude = Number(business.latitude);
      const businessLongitude = Number(business.longitude);
      const hasBusinessCoordinates =
        business.latitude !== null &&
        business.longitude !== null &&
        Number.isFinite(businessLatitude) &&
        Number.isFinite(businessLongitude);
      const distanceKm =
        coordinatesAreValid && hasBusinessCoordinates
          ? distanceInKilometers(
              body.latitude as number,
              body.longitude as number,
              businessLatitude,
              businessLongitude,
            )
          : null;
      const category = Array.isArray(business.categories)
        ? business.categories[0]
        : business.categories;

      return {
        id: business.id,
        slug: business.slug,
        name: business.name,
        neighborhood: business.neighborhood,
        categoryName: category?.name ?? "Comércio local",
        distanceKm,
        isFeatured:
          business.plan === "featured" &&
          Boolean(business.featured_until) &&
          new Date(business.featured_until as string).getTime() > now,
      };
    })
    .sort((first, second) => {
      if (first.distanceKm !== null && second.distanceKm !== null) {
        return first.distanceKm - second.distanceKm;
      }
      if (first.distanceKm !== null) return -1;
      if (second.distanceKm !== null) return 1;
      if (first.isFeatured !== second.isFeatured) return first.isFeatured ? -1 : 1;
      return first.name.localeCompare(second.name, "pt-BR");
    });

  return Response.json(
    { businesses },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
