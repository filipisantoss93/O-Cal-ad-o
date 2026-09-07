import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { requireAdmin } from "@/lib/admin/dal";
import { getBusinessSchedule } from "@/lib/business-hours";
import { publicMediaUrl } from "@/lib/merchant/media";
import { createClient } from "@/lib/supabase/server";
import type { Business } from "@/types/catalog";
import type { Database } from "@/types/database";

const palettes = [
  "from-[#ef6a43] to-[#f5a640]",
  "from-[#183a3a] to-[#2b7770]",
  "from-[#9f5968] to-[#dd9b7c]",
  "from-[#7c3d71] to-[#d66e9e]",
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toLocaleUpperCase("pt-BR");
}

function directionsUrls(latitude: number | null, longitude: number | null) {
  const unavailable = {
    directionsUrl: null,
    appleMapsUrl: null,
    wazeUrl: null,
  };
  if (latitude === null || longitude === null) return unavailable;
  const destinationLatitude = Number(latitude);
  const destinationLongitude = Number(longitude);
  if (!Number.isFinite(destinationLatitude) || !Number.isFinite(destinationLongitude)) {
    return unavailable;
  }
  const destination = encodeURIComponent(`${destinationLatitude},${destinationLongitude}`);
  return {
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`,
    appleMapsUrl: `https://maps.apple.com/?daddr=${destination}&dirflg=d`,
    wazeUrl: `https://waze.com/ul?ll=${destination}&navigate=yes`,
  };
}

async function loadBusiness(
  supabase: SupabaseClient<Database>,
  slug: string,
  publishedOnly: boolean,
): Promise<Business | null> {
  let query = supabase
    .from("businesses")
    .select(
      "id, city_id, category_id, slug, name, description, whatsapp_e164, street, address_number, complement, neighborhood, latitude, longitude, logo_path, cover_path",
    )
    .eq("slug", slug);

  if (publishedOnly) {
    query = query
      .eq("status", "approved")
      .eq("is_active", true)
      .eq("billing_suspended", false);
  }

  const { data: business, error } = await query.limit(1).maybeSingle();

  if (error || !business) return null;

  const now = new Date().toISOString();
  const [categoryResult, cityResult, itemsResult, hoursResult, highlightResult] = await Promise.all([
    supabase.from("categories").select("slug, name").eq("id", business.category_id).maybeSingle(),
    supabase.from("cities").select("name, state_code, timezone").eq("id", business.city_id).maybeSingle(),
    supabase
      .from("catalog_items")
      .select("id, kind, name, description, price, promotional_price, image_path, is_featured")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .not("price", "is", null)
      .order("is_featured", { ascending: false })
      .order("name")
      .limit(24),
    supabase
      .from("business_hours")
      .select("weekday, opens_at, closes_at, is_closed")
      .eq("business_id", business.id)
      .order("weekday")
      .order("display_order"),
    supabase
      .from("highlight_campaigns")
      .select("id, placement")
      .eq("business_id", business.id)
      .eq("status", "active")
      .lte("starts_at", now)
      .gt("ends_at", now)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (
    categoryResult.error ||
    cityResult.error ||
    itemsResult.error ||
    hoursResult.error ||
    highlightResult.error
  ) return null;
  const category = categoryResult.data;
  const city = cityResult.data;
  if (!category || !city) return null;
  const schedule = getBusinessSchedule(hoursResult.data ?? [], city.timezone);

  return {
    id: String(business.id),
    slug: business.slug,
    name: business.name,
    description: business.description || `Conheça a ${business.name} no O Calçadão.`,
    categorySlug: category.slug,
    categoryName: category.name,
    neighborhood: business.neighborhood,
    address: [business.street, business.address_number, business.complement].filter(Boolean).join(", "),
    distance: `${city.name} - ${city.state_code}`,
    rating: 0,
    reviewCount: 0,
    ...schedule,
    initials: initials(business.name),
    palette: palettes[business.id % palettes.length],
    logoUrl: publicMediaUrl(supabase, business.logo_path),
    coverUrl: publicMediaUrl(supabase, business.cover_path),
    verified: true,
    isSponsored: Boolean(highlightResult.data),
    highlightCampaignId: highlightResult.data?.id
      ? Number(highlightResult.data.id)
      : null,
    sponsoredPlacement: highlightResult.data?.placement as
      | "category"
      | "city"
      | "combo"
      | undefined,
    tags: [category.name, business.neighborhood, city.name],
    whatsapp: business.whatsapp_e164.replace(/\D/g, ""),
    ...directionsUrls(business.latitude, business.longitude),
    products: (itemsResult.data ?? []).map((item) => ({
      id: String(item.id),
      kind: item.kind === "service" ? "service" : "product",
      name: item.name,
      description: item.description || "Consulte disponibilidade diretamente com a loja.",
      price: Number(item.price),
      ...(item.promotional_price !== null ? { promotionalPrice: Number(item.promotional_price) } : {}),
      imageUrl: publicMediaUrl(supabase, item.image_path),
      isFeatured: item.is_featured,
    })),
  };
}

export const getPublicBusiness = cache(async (slug: string): Promise<Business | null> => {
  const supabase = await createClient();
  return loadBusiness(supabase, slug, true);
});

export async function getAdminBusinessPreview(slug: string) {
  const { supabase } = await requireAdmin(`/loja/${slug}?preview=admin`);
  return loadBusiness(supabase, slug, false);
}
