import { createClient } from "@/lib/supabase/server";

const cacheHeaders = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
};

export async function GET(request: Request) {
  const stateCode = new URL(request.url).searchParams.get("uf")?.toUpperCase();
  const supabase = await createClient();

  if (!stateCode) {
    const { data, error } = await supabase
      .from("states")
      .select("code, name")
      .eq("is_active", true)
      .order("name");

    if (error) {
      return Response.json(
        { error: "Não foi possível carregar os estados." },
        { status: 500 },
      );
    }

    return Response.json(
      { states: data.map((state) => ({ code: state.code, name: state.name })) },
      { headers: cacheHeaders },
    );
  }

  if (!/^[A-Z]{2}$/.test(stateCode)) {
    return Response.json({ error: "UF inválida." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("cities")
    .select("id, name, state_code")
    .eq("state_code", stateCode)
    .eq("is_active", true)
    .order("name");

  if (error) {
    return Response.json(
      { error: "Não foi possível carregar as cidades." },
      { status: 500 },
    );
  }

  return Response.json(
    {
      cities: data.map((city) => ({
        id: city.id,
        name: city.name,
        stateCode: city.state_code,
      })),
    },
    { headers: cacheHeaders },
  );
}
