import "server-only";

import { createPublicClient } from "@/lib/supabase/server";

export type BusinessShareCardData = {
  name: string;
  slug: string;
  neighborhood: string;
  city: string;
  stateCode: string;
};

type ShareBusinessRow = {
  name: string;
  slug: string;
  neighborhood: string;
  cities:
    | { name: string; state_code: string }
    | Array<{ name: string; state_code: string }>
    | null;
};

export async function getBusinessShareCardData(
  slug: string,
): Promise<BusinessShareCardData | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("name, slug, neighborhood, cities(name, state_code)")
    .eq("slug", slug)
    .eq("publication_status", "published")
    .eq("is_active", true)
    .eq("billing_suspended", false)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as ShareBusinessRow;
  const city = Array.isArray(row.cities) ? row.cities[0] : row.cities;
  if (!city) return null;

  return {
    name: row.name,
    slug: row.slug,
    neighborhood: row.neighborhood,
    city: city.name,
    stateCode: city.state_code,
  };
}
