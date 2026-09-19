import { SITE_URL, SITEMAP_PAGE_SIZE, xmlResponse } from "@/lib/seo/sitemap-xml";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { count, error } = await createPublicClient().from("businesses")
    .select("id", { count: "exact", head: true })
    .eq("publication_status", "published")
    .eq("is_active", true)
    .eq("billing_suspended", false);

  if (error || count === null) {
    console.error("[seo] Falha ao contar vitrines para o indice do sitemap", error);
    return xmlResponse("Nao foi possivel gerar o sitemap.", 503);
  }

  const numberOfPages = Math.ceil(count / SITEMAP_PAGE_SIZE);
  const locations = [SITE_URL + "/sitemaps/paginas",
    ...Array.from({ length: numberOfPages }, (_, index) => SITE_URL + "/sitemaps/lojas/" + (index + 1))];
  return xmlResponse([
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...locations.map((url) => "  <sitemap><loc>" + url + "</loc></sitemap>"),
    "</sitemapindex>",
  ].join("\n"));
}
