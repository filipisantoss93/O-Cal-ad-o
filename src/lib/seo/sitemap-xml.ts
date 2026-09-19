import "server-only";
import { createPublicClient } from "@/lib/supabase/server";

export const SITE_URL = "https://ocalcadao.com.br";
export const SITEMAP_PAGE_SIZE = 1000;

export function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function xmlResponse(xml: string, status = 200): Response {
  return new Response(xml, { status, headers: {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": status === 200 ? "public, s-maxage=600, stale-while-revalidate=3600" : "no-store",
  } });
}

export function publicBusinessQuery() {
  return createPublicClient().from("businesses")
    .select("id, slug, updated_at")
    .eq("publication_status", "published")
    .eq("is_active", true)
    .eq("billing_suspended", false);
}
