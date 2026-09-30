import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { citySeoSlug, localSeoSlug, parseCitySeoSlug } from "@/lib/seo/local-landing";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const MIN_INDEXABLE_BUSINESSES = 10;

type Props = { params: Promise<{ cidadeUf: string; categoria: string }> };

async function getData(cidadeUf: string, categorySlug: string) {
  const parsed = parseCitySeoSlug(cidadeUf);
  if (!parsed || !/^[a-z0-9-]+$/.test(categorySlug)) return null;
  const supabase = createPublicClient();

  const [{ data: cities, error: cityError }, { data: category, error: categoryError }] = await Promise.all([
    supabase.from("cities").select("id,name,state_code").eq("state_code", parsed.stateCode).eq("is_active", true).limit(1000),
    supabase.from("categories").select("id,name,slug").eq("slug", categorySlug).maybeSingle(),
  ]);
  if (cityError) throw cityError;
  if (categoryError) throw categoryError;
  if (!category || category.slug === "outros") return null;

  const city = (cities ?? []).find((candidate) => localSeoSlug(candidate.name) === parsed.citySlug);
  if (!city) return null;

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("slug,name,neighborhood,updated_at")
    .eq("city_id", city.id)
    .eq("category_id", category.id)
    .eq("publication_status", "published")
    .eq("is_active", true)
    .eq("billing_suspended", false)
    .order("updated_at", { ascending: false })
    .limit(31);
  if (error) throw error;

  const rows = businesses ?? [];
  return { city, category, businesses: rows.slice(0, 30), indexable: rows.length >= MIN_INDEXABLE_BUSINESSES };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cidadeUf, categoria } = await params;
  const data = await getData(cidadeUf, categoria);
  if (!data) return { title: "Categoria não encontrada", robots: { index: false, follow: false } };

  const citySlug = citySeoSlug(data.city.name, data.city.state_code);
  const canonical = `/cidade/${citySlug}/${data.category.slug}`;
  const title = `${data.category.name} em ${data.city.name}, ${data.city.state_code}`;
  const description = `Encontre estabelecimentos de ${data.category.name.toLocaleLowerCase("pt-BR")} em ${data.city.name}, ${data.city.state_code}. Consulte vitrines e informações disponíveis no O Calçadão.`;

  return {
    title,
    description,
    alternates: { canonical },
    robots: data.indexable ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { type: "website", locale: "pt_BR", siteName: "O Calçadão", title: `${title} | O Calçadão`, description, url: canonical },
  };
}

export default async function CityCategoryPage({ params }: Props) {
  const { cidadeUf, categoria } = await params;
  const data = await getData(cidadeUf, categoria);
  if (!data) notFound();
  const citySlug = citySeoSlug(data.city.name, data.city.state_code);
  if (cidadeUf !== citySlug || categoria !== data.category.slug) notFound();

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${data.category.name} em ${data.city.name}, ${data.city.state_code}`,
    numberOfItems: data.businesses.length,
    itemListElement: data.businesses.map((business, index) => ({
      "@type": "ListItem", position: index + 1, name: business.name,
      url: `https://ocalcadao.com.br/loja/${encodeURIComponent(business.slug)}`,
    })),
  };

  return <>
    <SiteHeader />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList).replace(/</g, "\\u003c") }} />
    <main className="min-h-[70vh] bg-canvas">
      <section className="border-b border-line bg-surface px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Link href={`/cidade/${citySlug}`} className="text-sm font-bold text-brand-dark">← Guia de {data.city.name}</Link>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-ink sm:text-5xl">{data.category.name} em {data.city.name}, {data.city.state_code}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted sm:text-base">Explore vitrines publicadas nesta categoria e consulte as informações disponíveis diretamente em cada estabelecimento.</p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.businesses.map((business) => <article key={business.slug} className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-dark">{data.category.name}</p>
            <h2 className="mt-2 text-lg font-black text-ink">{business.name}</h2>
            {business.neighborhood && <p className="mt-1 text-sm text-muted">{business.neighborhood}</p>}
            <Link href={`/loja/${encodeURIComponent(business.slug)}`} className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-brand px-4 text-sm font-black text-white">Ver vitrine <span aria-hidden="true" className="ml-2">→</span></Link>
          </article>)}
        </div>
      </section>
    </main>
    <SiteFooter />
  </>;
}
