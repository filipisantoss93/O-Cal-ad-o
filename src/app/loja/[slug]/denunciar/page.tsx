import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportForm } from "@/components/public-message-forms";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getPublicBusiness } from "@/lib/public-business";

export const metadata: Metadata = { title: "Denunciar loja", robots: { index: false, follow: false } };

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await getPublicBusiness(slug);
  if (!business) notFound();
  return <><SiteHeader /><main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
    <Link href={`/loja/${slug}`} className="text-sm font-bold text-brand-dark hover:underline">← Voltar à vitrine</Link>
    <h1 className="mt-5 text-3xl font-black text-ink sm:text-4xl">Denunciar {business.name}</h1>
    <p className="mb-8 mt-3 text-sm leading-6 text-muted">Conte o que aconteceu. A administração analisará o relato e poderá tomar providências.</p>
    <ReportForm businessId={Number(business.id)} />
  </main><SiteFooter /></>;
}
