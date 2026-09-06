import "server-only";

import { filterBusinesses } from "@/data/catalog";
import { createClient } from "@/lib/supabase/server";
import type { Business } from "@/types/catalog";

const palettes = [
  "from-[#ef6a43] to-[#f5a640]",
  "from-[#183a3a] to-[#2b7770]",
  "from-[#9f5968] to-[#dd9b7c]",
  "from-[#7c3d71] to-[#d66e9e]",
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
}

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export async function searchPublicBusinesses(
  query?: string,
  categorySlug?: string,
): Promise<Business[]> {
  const demonstrations = filterBusinesses(query, categorySlug);
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("businesses")
    .select(
      "id, slug, name, description, whatsapp_e164, street, address_number, complement, neighborhood, categories(slug, name), cities(name, state_code)",
    )
    .eq("status", "approved")
    .eq("is_active", true)
    .order("name")
    .limit(100);

  if (error || !rows?.length) return demonstrations;

  const businessIds = rows.map((row) => row.id);
  const { data: catalogItems } = await supabase
    .from("catalog_items")
    .select("business_id, name, description")
    .in("business_id", businessIds)
    .eq("is_active", true)
    .limit(500);

  const itemTerms = new Map<number, string[]>();
  for (const item of catalogItems ?? []) {
    const terms = itemTerms.get(item.business_id) ?? [];
    terms.push(item.name, item.description ?? "");
    itemTerms.set(item.business_id, terms);
  }

  const normalizedQuery = normalized(query?.trim() ?? "");
  const realBusinesses = rows
    .filter((row) => {
      const category = row.categories;
      if (!category || (categorySlug && category.slug !== categorySlug)) return false;
      if (!normalizedQuery) return true;

      return normalized(
        [
          row.name,
          row.description ?? "",
          row.neighborhood,
          category.name,
          ...(itemTerms.get(row.id) ?? []),
        ].join(" "),
      ).includes(normalizedQuery);
    })
    .map((row): Business => {
      const category = row.categories!;
      const city = row.cities!;
      return {
        id: String(row.id),
        slug: row.slug,
        name: row.name,
        description: row.description || `Conheça a ${row.name} no O Calçadão.`,
        categorySlug: category.slug,
        categoryName: category.name,
        neighborhood: row.neighborhood,
        address: [row.street, row.address_number, row.complement].filter(Boolean).join(", "),
        distance: city ? `${city.name} - ${city.state_code}` : "Comércio local",
        rating: 0,
        reviewCount: 0,
        isOpen: false,
        hoursAvailable: false,
        closesAt: "Consulte o horário",
        initials: initials(row.name),
        palette: palettes[row.id % palettes.length],
        verified: true,
        tags: [category.name, row.neighborhood, ...(itemTerms.get(row.id) ?? []).filter(Boolean)],
        whatsapp: row.whatsapp_e164.replace(/\D/g, ""),
        products: [],
      };
    });

  const realSlugs = new Set(realBusinesses.map((business) => business.slug));
  return [
    ...realBusinesses,
    ...demonstrations.filter((business) => !realSlugs.has(business.slug)),
  ];
}
