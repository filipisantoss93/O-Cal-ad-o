import "server-only";

import { cache } from "react";
import { getBusinessBySlug } from "@/data/catalog";
import { createClient } from "@/lib/supabase/server";
import type { Business } from "@/types/catalog";

const palettes = [
  "from-[#ef6a43] to-[#f5a640]",
  "from-[#183a3a] to-[#2b7770]",
  "from-[#9f5968] to-[#dd9b7c]",
  "from-[#7c3d71] to-[#d66e9e]",
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toLocaleUpperCase("pt-BR");
}

type BusinessHour = {
  weekday: number;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
};

function scheduleNow(hours: BusinessHour[], timezone: string) {
  if (hours.length === 0) {
    return { hoursAvailable: false, isOpen: false, closesAt: "Consulte o horário" };
  }
  const weekdayCodes = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const weekday = weekdayCodes.indexOf(parts.find((part) => part.type === "weekday")?.value ?? "");
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const currentMinutes = hour * 60 + minute;
  const today = hours.filter((item) => item.weekday === weekday && !item.is_closed);
  const openInterval = today.find((item) => {
    if (!item.opens_at || !item.closes_at) return false;
    const [openHour, openMinute] = item.opens_at.split(":").map(Number);
    const [closeHour, closeMinute] = item.closes_at.split(":").map(Number);
    const opens = openHour * 60 + openMinute;
    const closes = closeHour * 60 + closeMinute;
    return closes > opens
      ? currentMinutes >= opens && currentMinutes < closes
      : currentMinutes >= opens || currentMinutes < closes;
  });

  if (!openInterval?.closes_at) {
    return { hoursAvailable: true, isOpen: false, closesAt: "Fechado agora" };
  }
  return {
    hoursAvailable: true,
    isOpen: true,
    closesAt: openInterval.closes_at.slice(0, 5).replace(":", "h"),
  };
}

export const getPublicBusiness = cache(async (slug: string): Promise<Business | null> => {
  const demonstration = getBusinessBySlug(slug);
  if (demonstration) return demonstration;

  const supabase = await createClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select(
      "id, city_id, category_id, slug, name, description, whatsapp_e164, street, address_number, complement, neighborhood",
    )
    .eq("slug", slug)
    .eq("status", "approved")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error || !business) return null;

  const [categoryResult, cityResult, itemsResult, hoursResult] = await Promise.all([
    supabase.from("categories").select("slug, name").eq("id", business.category_id).maybeSingle(),
    supabase.from("cities").select("name, state_code, timezone").eq("id", business.city_id).maybeSingle(),
    supabase
      .from("catalog_items")
      .select("id, name, description, price, promotional_price")
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
  ]);

  if (categoryResult.error || cityResult.error || itemsResult.error || hoursResult.error) return null;
  const category = categoryResult.data;
  const city = cityResult.data;
  if (!category || !city) return null;
  const schedule = scheduleNow(hoursResult.data ?? [], city.timezone);

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
    verified: true,
    tags: [category.name, business.neighborhood, city.name],
    whatsapp: business.whatsapp_e164.replace(/\D/g, ""),
    products: (itemsResult.data ?? []).map((item) => ({
      id: String(item.id),
      name: item.name,
      description: item.description || "Consulte disponibilidade diretamente com a loja.",
      price: Number(item.price),
      ...(item.promotional_price !== null ? { promotionalPrice: Number(item.promotional_price) } : {}),
    })),
  };
});
