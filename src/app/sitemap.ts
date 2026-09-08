import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database-runtime";

const SITE_URL = "https://ocalcadao.com.br";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { url, publishableKey } = getSupabaseEnv();

  const supabase = createClient<Database>(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/buscar`,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("slug, updated_at")
    .eq("publication_status", "published")
    .eq("is_active", true)
    .eq("billing_suspended", false)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Erro ao gerar sitemap:", error);
    return staticPages;
  }

  const businessPages: MetadataRoute.Sitemap = (businesses ?? []).map(
    (business) => ({
      url: `${SITE_URL}/loja/${encodeURIComponent(business.slug)}`,
      lastModified: business.updated_at
        ? new Date(business.updated_at)
        : undefined,
      changeFrequency: "weekly",
      priority: 0.8,
    }),
  );

  return [...staticPages, ...businessPages];
}
