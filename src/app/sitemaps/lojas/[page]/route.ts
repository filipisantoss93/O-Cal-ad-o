import { escapeXml, SITE_URL, SITEMAP_PAGE_SIZE, xmlResponse } from "@/lib/seo/sitemap-xml";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ page: string }> };

export async function GET(_request: Request, { params }: Props) {
  const pageParam = (await params).page;
  if (!/^[1-9]\d{0,5}$/.test(pageParam)) return xmlResponse("Sitemap nao encontrado.", 404);

  const page = Number(pageParam);
  const start = (page - 1) * SITEMAP_PAGE_SIZE;
  const { data, error } = await createPublicClient().from("businesses")
    .select("id, slug, updated_at")
    .eq("publication_status", "published")
    .eq("is_active", true)
    .eq("billing_suspended", false)
    .order("id", { ascending: true })
    .range(start, start + SITEMAP_PAGE_SIZE - 1);

  if (error) {
    console.error("[seo] Falha ao gerar sitemap de vitrines pagina " + page, error);
    return xmlResponse("Nao foi possivel gerar o sitemap.", 503);
  }
  if (!data?.length) return xmlResponse("Sitemap nao encontrado.", 404);

  return xmlResponse([
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...data.filter((item) => item.slug).map((item) => {
      const loc = SITE_URL + "/loja/" + encodeURIComponent(item.slug);
      const lastmod = item.updated_at && !Number.isNaN(Date.parse(item.updated_at))
        ? "<lastmod>" + new Date(item.updated_at).toISOString() + "</lastmod>" : "";
      return "  <url><loc>" + escapeXml(loc) + "</loc>" + lastmod + "</url>";
    }),
    "</urlset>",
  ].join("\n"));
}
