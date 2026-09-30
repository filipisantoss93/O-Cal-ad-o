import { SITE_URL, SITEMAP_PAGE_SIZE, xmlResponse } from "@/lib/seo/sitemap-xml";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await createPublicClient().from("businesses")
    .select("id")
    .eq("publication_status", "published")
    .eq("is_active", true)
    .eq("billing_suspended", false)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[seo] Falha ao localizar a ultima vitrine elegivel para o indice do sitemap", error);
    return xmlResponse("Nao foi possivel gerar o sitemap.", 503);
  }

  const maxId = data?.id == null ? 0 : Number(data.id);
  if (!Number.isSafeInteger(maxId) || maxId < 0) {
    console.error("[seo] ID maximo invalido ao gerar indice do sitemap", data?.id);
    return xmlResponse("Nao foi possivel gerar o sitemap.", 503);
  }

  // Os lotes sao faixas fixas de IDs, nao offsets sobre uma contagem total.
  // Assim o indice nao precisa de count exact e cada sitemap contem no maximo
  // SITEMAP_PAGE_SIZE registros, mesmo quando existem IDs removidos/inativos.
  const numberOfPages = Math.ceil(maxId / SITEMAP_PAGE_SIZE);
  const locations = [
    SITE_URL + "/sitemaps/paginas",
    ...Array.from(
      { length: numberOfPages },
      (_, index) => SITE_URL + "/sitemaps/lojas/" + (index + 1),
    ),
  ];

  return xmlResponse([
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...locations.map((url) => "  <sitemap><loc>" + url + "</loc></sitemap>"),
    "</sitemapindex>",
  ].join("\n"));
}
