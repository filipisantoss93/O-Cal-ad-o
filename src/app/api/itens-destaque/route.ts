import { type NextRequest, NextResponse } from "next/server";
import { publicMediaUrl } from "@/lib/merchant/media";
import { createClient } from "@/lib/supabase/server";
import type { CatalogPriceMode, FeaturedCatalogItem } from "@/types/catalog";

type FeaturedItemsRequest = {
  cityId?: unknown;
};

type CatalogRow = {
  id: number;
  business_id: number;
  kind: string;
  price_mode: string;
  name: string;
  description: string | null;
  price: number | null;
  promotional_price: number | null;
  image_path: string | null;
  updated_at: string;
};

function publicPriceMode(value: string): CatalogPriceMode {
  if (value === "from" || value === "consult") return value;
  return "fixed";
}

export async function POST(request: NextRequest) {
  let body: FeaturedItemsRequest;
  try {
    body = (await request.json()) as FeaturedItemsRequest;
  } catch {
    return NextResponse.json({ error: "Cidade inválida." }, { status: 400 });
  }

  const cityId = Number(body.cityId);
  if (!Number.isSafeInteger(cityId) || cityId <= 0) {
    return NextResponse.json({ error: "Cidade inválida." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: businesses, error: businessError } = await supabase
    .from("businesses")
    .select("id, slug, name")
    .eq("city_id", cityId)
    .eq("status", "approved")
    .eq("is_active", true)
    .eq("billing_suspended", false);

  if (businessError) {
    return NextResponse.json(
      { error: "Não foi possível consultar os comércios." },
      { status: 500 },
    );
  }
  if (!businesses?.length) {
    return NextResponse.json({ items: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const businessIds = businesses.map((business) => business.id);
  const businessById = new Map(
    businesses.map((business) => [business.id, business]),
  );
  const { data, error } = await supabase
    .from("catalog_items")
    .select("id, business_id, kind, price_mode, name, description, price, promotional_price, image_path, updated_at")
    .in("business_id", businessIds)
    .eq("is_active", true)
    .eq("is_featured", true)
    .order("updated_at", { ascending: false })
    .limit(8);

  if (error) {
    return NextResponse.json(
      { error: "Não foi possível consultar os itens em destaque." },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as unknown as CatalogRow[];
  const items: FeaturedCatalogItem[] = rows.flatMap((item) => {
    const business = businessById.get(item.business_id);
    if (!business) return [];
    return [{
      id: String(item.id),
      businessSlug: business.slug,
      businessName: business.name,
      kind: item.kind === "service" ? "service" : "product",
      priceMode: publicPriceMode(item.price_mode),
      name: item.name,
      description:
        item.description || "Consulte disponibilidade diretamente com o comércio.",
      price: item.price === null ? null : Number(item.price),
      ...(item.promotional_price !== null
        ? { promotionalPrice: Number(item.promotional_price) }
        : {}),
      imageUrl: publicMediaUrl(supabase, item.image_path),
    }];
  });

  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
