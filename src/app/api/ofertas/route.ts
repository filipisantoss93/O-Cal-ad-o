import { type NextRequest, NextResponse } from "next/server";
import { publicMediaUrl } from "@/lib/merchant/media";
import { createClient } from "@/lib/supabase/server";
import type { Promotion } from "@/types/catalog";

type OffersRequest = {
  cityId?: unknown;
};

type PromotionRow = {
  id: number;
  business_id: number;
  title: string;
  description: string | null;
  original_price: number | null;
  offer_price: number;
  image_path: string | null;
  ends_at: string;
  is_featured: boolean;
  created_at: string;
};

const palettes = ["bg-[#fff0df]", "bg-[#e5f1ef]", "bg-[#ffe9f2]", "bg-[#edf0ff]"];

function discountBadge(originalPrice: number | null, offerPrice: number) {
  if (!originalPrice || originalPrice <= offerPrice) return "OFERTA";
  const percentage = Math.round((1 - offerPrice / originalPrice) * 100);
  return percentage > 0 ? `${percentage}% OFF` : "OFERTA";
}

function expirationLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Por tempo limitado";
  return `Até ${new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date)}`;
}

export async function POST(request: NextRequest) {
  let body: OffersRequest;
  try {
    body = (await request.json()) as OffersRequest;
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
    return NextResponse.json({ promotions: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const businessIds = businesses.map((business) => business.id);
  const businessById = new Map(
    businesses.map((business) => [business.id, business]),
  );
  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .in("business_id", businessIds)
    .eq("is_active", true)
    .eq("billing_suspended", false)
    .limit(24);

  if (error) {
    return NextResponse.json(
      { error: "Não foi possível consultar as ofertas." },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as unknown as PromotionRow[];
  const promotions: Promotion[] = rows
    .sort((first, second) => {
      if (first.is_featured !== second.is_featured) {
        return first.is_featured ? -1 : 1;
      }
      return new Date(second.created_at).getTime() - new Date(first.created_at).getTime();
    })
    .slice(0, 6)
    .flatMap((promotion, index) => {
      const business = businessById.get(promotion.business_id);
      if (!business) return [];
      const originalPrice =
        promotion.original_price === null ? null : Number(promotion.original_price);
      const offerPrice = Number(promotion.offer_price);
      return [{
        id: String(promotion.id),
        businessSlug: business.slug,
        businessName: business.name,
        title: promotion.title,
        description: promotion.description || "Oferta publicada pelo comércio local.",
        badge: promotion.is_featured
          ? "DESTAQUE"
          : discountBadge(originalPrice, offerPrice),
        symbol: "🏷️",
        palette: palettes[index % palettes.length],
        expiresLabel: expirationLabel(promotion.ends_at),
        originalPrice,
        offerPrice,
        imageUrl: publicMediaUrl(supabase, promotion.image_path),
        isFeatured: promotion.is_featured,
      }];
    });

  return NextResponse.json(
    { promotions },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
