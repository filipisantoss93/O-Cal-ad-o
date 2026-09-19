import { SITE_URL, xmlResponse } from "@/lib/seo/sitemap-xml";

export function GET() {
  const locations = [SITE_URL, SITE_URL + "/descobrir", SITE_URL + "/planos"];
  return xmlResponse([
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...locations.map((url) => "  <url><loc>" + url + "</loc></url>"),
    "</urlset>",
  ].join("\n"));
}
