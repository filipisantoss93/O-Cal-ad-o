import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Coordenadas inválidas." }, { status: 400 });
  }

  const latitude =
    typeof body === "object" &&
    body !== null &&
    "latitude" in body &&
    typeof body.latitude === "number"
      ? body.latitude
      : Number.NaN;
  const longitude =
    typeof body === "object" &&
    body !== null &&
    "longitude" in body &&
    typeof body.longitude === "number"
      ? body.longitude
      : Number.NaN;

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return Response.json({ error: "Coordenadas inválidas." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_city_by_coordinates", {
    input_latitude: latitude,
    input_longitude: longitude,
  });

  if (error) {
    return Response.json(
      { error: "Não foi possível identificar sua cidade." },
      { status: 500 },
    );
  }

  const city = data?.[0];
  if (!city) {
    return Response.json(
      { error: "Não encontramos uma cidade nesta localização." },
      { status: 404 },
    );
  }

  return Response.json(
    {
      city: {
        id: city.id,
        ibgeCode: city.ibge_code,
        name: city.name,
        stateCode: city.state_code,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
