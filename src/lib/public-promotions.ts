import "server-only";

import { normalizePublicContactAction } from "@/lib/contact-action";
import { publicMediaUrl } from "@/lib/merchant/media";
import { createPublicClient } from "@/lib/supabase/server";
import type { Promotion } from "@/types/catalog";

const palettes = ["bg-[#fff0df]", "bg-[#e5f1ef]", "bg-[#ffe9f2]", "bg-[#edf0ff]"];

export const OFFERS_PAGE_SIZE = 12;

type BusinessSummary = {
  slug: string;
  name: string;
  whatsapp_e164: string | null;
  phone_e164: string | null;
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
  contact_action: string;
  contact_url: string | null;
  created_at: string;
  businesses: BusinessSummary | BusinessSummary[] | null;
};

type SequenceItem = {
  kind: "featured" | "organic";
  rank: number;
};

export type CityPromotionsResult = {
  promotions: Promotion[];
  total: number;
  featuredTotal: number;
  organicTotal: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

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

/**
 * Destaques abrem cada ciclo de três cards. As duas posições seguintes ficam
 * com ofertas orgânicas. Quando um grupo termina, o outro continua sem lacunas.
 */
function promotionSequence(featuredTotal: number, organicTotal: number) {
  const sequence: SequenceItem[] = [];
  let featuredRank = 0;
  let organicRank = 0;

  while (featuredRank < featuredTotal && organicRank < organicTotal) {
    sequence.push({ kind: "featured", rank: featuredRank });
    featuredRank += 1;

    for (let slot = 0; slot < 2 && organicRank < organicTotal; slot += 1) {
      sequence.push({ kind: "organic", rank: organicRank });
      organicRank += 1;
    }
  }

  while (featuredRank < featuredTotal) {
    sequence.push({ kind: "featured", rank: featuredRank });
    featuredRank += 1;
  }

  while (organicRank < organicTotal) {
    sequence.push({ kind: "organic", rank: organicRank });
    organicRank += 1;
  }

  return sequence;
}

function rowToPromotion(
  supabase: ReturnType<typeof createPublicClient>,
  promotion: PromotionRow,
  paletteIndex: number,
): Promotion | null {
  const business = Array.isArray(promotion.businesses)
    ? promotion.businesses[0]
    : promotion.businesses;
  if (!business) return null;

  const originalPrice = promotion.original_price === null
    ? null
    : Number(promotion.original_price);
  const offerPrice = Number(promotion.offer_price);

  return {
    id: String(promotion.id),
    businessSlug: business.slug,
    businessName: business.name,
    title: promotion.title,
    description: promotion.description || "Oferta publicada pelo comércio local.",
    badge: promotion.is_featured
      ? "DESTAQUE"
      : discountBadge(originalPrice, offerPrice),
    symbol: "🏷️",
    palette: palettes[paletteIndex % palettes.length],
    expiresLabel: expirationLabel(promotion.ends_at),
    originalPrice,
    offerPrice,
    imageUrl: publicMediaUrl(supabase, promotion.image_path),
    isFeatured: promotion.is_featured,
    whatsapp: business.whatsapp_e164?.replace(/\D/g, "") || null,
    phone: business.phone_e164,
    contactAction: normalizePublicContactAction(promotion.contact_action),
    contactUrl: promotion.contact_url,
  };
}

export async function listCityPromotions(
  cityId: number,
  requestedPage = 1,
  pageSize = OFFERS_PAGE_SIZE,
): Promise<CityPromotionsResult> {
  const safePageSize = Number.isSafeInteger(pageSize) && pageSize > 0
    ? Math.min(pageSize, 48)
    : OFFERS_PAGE_SIZE;
  const requested = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? requestedPage
    : 1;
  const emptyResult: CityPromotionsResult = {
    promotions: [],
    total: 0,
    featuredTotal: 0,
    organicTotal: 0,
    page: requested,
    pageSize: safePageSize,
    totalPages: 0,
  };

  if (!Number.isSafeInteger(cityId) || cityId <= 0) return emptyResult;

  const supabase = createPublicClient();
  const now = new Date().toISOString();
  const countColumns = "id, businesses!inner(id)";
  const detailColumns = "id, business_id, title, description, original_price, offer_price, image_path, ends_at, is_featured, contact_action, contact_url, created_at, businesses!inner(slug, name, whatsapp_e164, phone_e164, city_id, publication_status, is_active, billing_suspended)";

  const countByKind = (featured: boolean) => supabase
    .from("promotions")
    .select(countColumns, { count: "exact", head: true })
    .eq("is_active", true)
    .eq("billing_suspended", false)
    .or(`is_featured.eq.${featured}`)
    .lte("starts_at", now)
    .gt("ends_at", now)
    .eq("businesses.city_id", cityId)
    .eq("businesses.publication_status", "published")
    .eq("businesses.is_active", true)
    .eq("businesses.billing_suspended", false);

  const [featuredCountResult, organicCountResult] = await Promise.all([
    countByKind(true),
    countByKind(false),
  ]);

  const countError = featuredCountResult.error ?? organicCountResult.error;
  if (countError) {
    throw new Error(`Falha ao contar ofertas públicas: ${countError.message}`);
  }

  const featuredTotal = featuredCountResult.count ?? 0;
  const organicTotal = organicCountResult.count ?? 0;
  const total = featuredTotal + organicTotal;
  const totalPages = Math.ceil(total / safePageSize);
  const page = totalPages > 0 ? Math.min(requested, totalPages) : 1;
  const fullSequence = promotionSequence(featuredTotal, organicTotal);
  const pageSequence = fullSequence.slice(
    (page - 1) * safePageSize,
    page * safePageSize,
  );

  const featuredRanks = pageSequence
    .filter((item) => item.kind === "featured")
    .map((item) => item.rank);
  const organicRanks = pageSequence
    .filter((item) => item.kind === "organic")
    .map((item) => item.rank);

  const rowsByKind = async (featured: boolean, ranks: number[]) => {
    if (ranks.length === 0) return [] as PromotionRow[];
    const from = ranks[0];
    const to = ranks[ranks.length - 1];
    const { data, error } = await supabase
      .from("promotions")
      .select(detailColumns)
      .eq("is_active", true)
      .eq("billing_suspended", false)
      .or(`is_featured.eq.${featured}`)
      .lte("starts_at", now)
      .gt("ends_at", now)
      .eq("businesses.city_id", cityId)
      .eq("businesses.publication_status", "published")
      .eq("businesses.is_active", true)
      .eq("businesses.billing_suspended", false)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (error) throw new Error(`Falha ao carregar ofertas públicas: ${error.message}`);
    return (data ?? []) as unknown as PromotionRow[];
  };

  const [featuredRows, organicRows] = await Promise.all([
    rowsByKind(true, featuredRanks),
    rowsByKind(false, organicRanks),
  ]);
  const featuredByRank = new Map(
    featuredRows.map((row, index) => [(featuredRanks[0] ?? 0) + index, row]),
  );
  const organicByRank = new Map(
    organicRows.map((row, index) => [(organicRanks[0] ?? 0) + index, row]),
  );

  const promotions = pageSequence.flatMap((item, index): Promotion[] => {
    const row = item.kind === "featured"
      ? featuredByRank.get(item.rank)
      : organicByRank.get(item.rank);
    if (!row) return [];
    const promotion = rowToPromotion(supabase, row, index);
    return promotion ? [promotion] : [];
  });

  return {
    promotions,
    total,
    featuredTotal,
    organicTotal,
    page,
    pageSize: safePageSize,
    totalPages,
  };
}
