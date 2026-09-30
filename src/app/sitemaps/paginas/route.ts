import { SITE_URL, xmlResponse } from "@/lib/seo/sitemap-xml";

export function GET() {
  const locations = [
    SITE_URL,
    SITE_URL + "/descobrir",
    SITE_URL + "/planos",
    SITE_URL + "/cidade/assis-sp",
    SITE_URL + "/cidade/assis-sp/alimentacao",
    SITE_URL + "/cidade/assis-sp/automotivo",
    SITE_URL + "/cidade/assis-sp/moda-acessorios",
    SITE_URL + "/cidade/assis-sp/saude-bem-estar",
    SITE_URL + "/cidade/assis-sp/construcao-reforma",
  ];
  return xmlResponse([
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...locations.map((url) => "  <url><loc>" + url + "</loc></url>"),
    "</urlset>",
  ].join("\n"));
}
