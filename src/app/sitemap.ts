import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/server";

const SITE_URL = "https://ocalcadao.com.br";
const PAGE_SIZE = 1000;
// Antes de 50 mil URLs, dividir em índice e sub-sitemaps (ver plano de SEO).
const MAX_BUSINESS_URLS = 49_000;

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicClient();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/planos`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];

  const businessPages: MetadataRoute.Sitemap = [];
  for (let offset = 0; offset < MAX_BUSINESS_URLS; offset += PAGE_SIZE) {
    const { data: businesses, error } = await supabase
      .from("businesses")
      .select("id, slug, updated_at")
      .eq("publication_status", "published")
      .eq("is_active", true)
      .eq("billing_suspended", false)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error(`[sitemap] erro ao buscar vitrines a partir de ${offset}:`, error);
      break;
    }

    for (const business of businesses ?? []) {
      if (!business.slug) continue;
      businessPages.push({
        url: `${SITE_URL}/loja/${encodeURIComponent(business.slug)}`,
        lastModified: business.updated_at
          ? new Date(business.updated_at)
          : undefined,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    if (!businesses || businesses.length < PAGE_SIZE) break;
    if (offset + PAGE_SIZE >= MAX_BUSINESS_URLS) {
      console.warn("[sitemap] limite proximo: particionar sitemap em indice e lotes.");
    }
  }

  return [...staticPages, ...businessPages];
}
