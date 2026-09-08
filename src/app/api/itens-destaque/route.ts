import { type NextRequest, NextResponse } from "next/server";
import { publicMediaUrl } from "@/lib/merchant/media";
import { createPublicClient } from "@/lib/supabase/server";
import type { CatalogPriceMode, FeaturedCatalogItem } from "@/types/catalog";

type FeaturedItemsRequest = {
  cityId?: unknown;
};

type BusinessSummary = {
  slug: string;
  name: string;
  whatsapp_e164: string;
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
  businesses: BusinessSummary | BusinessSummary[] | null;
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

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("catalog_items")
    .select(
      "id, business_id, kind, price_mode, name, description, price, promotional_price, image_path, updated_at, businesses!inner(slug, name, whatsapp_e164, city_id, publication_status, is_active, billing_suspended)",
    )
    .eq("is_active", true)
    .eq("is_featured", true)
    .eq("businesses.city_id", cityId)
    .eq("businesses.publication_status", "published")
    .eq("businesses.is_active", true)
    .eq("businesses.billing_suspended", false)
    .order("updated_at", { ascending: false })
    .limit(6);

  if (error) {
    console.error("[api/itens-destaque] query failed", error.message);
    return NextResponse.json(
      { error: "Não foi possível consultar os itens em destaque." },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as unknown as CatalogRow[];
  const items: FeaturedCatalogItem[] = rows.flatMap((item) => {
    const business = Array.isArray(item.businesses)
      ? item.businesses[0]
      : item.businesses;
    if (!business) return [];

    return [{
      id: String(item.id),
      businessSlug: business.slug,
      businessName: business.name,
      whatsapp: business.whatsapp_e164?.replace(/\D/g, "") || null,
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
