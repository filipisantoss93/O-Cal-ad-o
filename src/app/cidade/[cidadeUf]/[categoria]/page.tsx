import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { citySeoSlug, localSeoSlug, parseCitySeoSlug } from "@/lib/seo/local-landing";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const MIN_INDEXABLE_BUSINESSES = 10;
const PAGE_SIZE = 30;

type Props = {
  params: Promise<{ cidadeUf: string; categoria: string }>;
  searchParams: Promise<{ pagina?: string | string[] }>;
};

function parsePage(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return 1;
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page <= 1000 ? page : null;
}

async function getData(cidadeUf: string, categorySlug: string, page: number) {
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

  const { count, error: countError } = await supabase
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .eq("city_id", city.id)
    .eq("category_id", category.id)
    .eq("publication_status", "published")
    .eq("is_active", true)
    .eq("billing_suspended", false);
  if (countError) throw countError;

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  let businesses: Array<{ slug: string; name: string; neighborhood: string | null; updated_at: string | null }> = [];

  if (page <= totalPages) {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("businesses")
      .select("slug,name,neighborhood,updated_at")
      .eq("city_id", city.id)
      .eq("category_id", category.id)
      .eq("publication_status", "published")
      .eq("is_active", true)
      .eq("billing_suspended", false)
      .order("updated_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    businesses = data ?? [];
  }

  return {
    city,
    category,
    businesses,
    total,
    totalPages,
    page,
    indexable: total >= MIN_INDEXABLE_BUSINESSES,
  };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ cidadeUf, categoria }, query] = await Promise.all([params, searchParams]);
  const page = parsePage(query.pagina);
  if (!page) return { title: "Página não encontrada", robots: { index: false, follow: false } };

  const data = await getData(cidadeUf, categoria, page);
  if (!data) return { title: "Categoria não encontrada", robots: { index: false, follow: false } };

  const citySlug = citySeoSlug(data.city.name, data.city.state_code);
  const canonical = `/cidade/${citySlug}/${data.category.slug}`;
  const title = `${data.category.name} em ${data.city.name}, ${data.city.state_code}`;
  const description = `Encontre estabelecimentos de ${data.category.name.toLocaleLowerCase("pt-BR")} em ${data.city.name}, ${data.city.state_code}. Consulte vitrines e informações disponíveis no O Calçadão.`;

  return {
    title: page === 1 ? title : `${title} — página ${page}`,
    description,
    alternates: { canonical },
    robots: data.indexable && page === 1 ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      type: "website", locale: "pt_BR", siteName: "O Calçadão",
      title: `${title} | O Calçadão`, description, url: canonical,
    },
  };
}

export default async function CityCategoryPage({ params, searchParams }: Props) {
  const [{ cidadeUf, categoria }, query] = await Promise.all([params, searchParams]);
  const page = parsePage(query.pagina);
  if (!page) notFound();

  const data = await getData(cidadeUf, categoria, page);
  if (!data) notFound();

  const citySlug = citySeoSlug(data.city.name, data.city.state_code);
  if (cidadeUf !== citySlug || categoria !== data.category.slug) notFound();

  const basePath = `/cidade/${citySlug}/${data.category.slug}`;
  if (page > data.totalPages) permanentRedirect(basePath);
  const pageHref = (target: number) => target === 1 ? basePath : `${basePath}?pagina=${target}`;
  const firstPosition = (page - 1) * PAGE_SIZE + 1;
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${data.category.name} em ${data.city.name}, ${data.city.state_code}`,
    numberOfItems: data.total,
    itemListElement: data.businesses.map((business, index) => ({
      "@type": "ListItem", position: firstPosition + index, name: business.name,
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
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted sm:text-base">
            Explore {data.total} vitrines publicadas nesta categoria e consulte as informações disponíveis diretamente em cada estabelecimento.
          </p>
          {data.totalPages > 1 && <p className="mt-2 text-sm font-bold text-muted">Página {page} de {data.totalPages}</p>}
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

        {data.totalPages > 1 && (
          <nav className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-6" aria-label="Paginação da categoria">
            {page > 1 ? <Link rel="prev" href={pageHref(page - 1)} className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-black text-ink">← Anterior</Link> : <span />}
            <span className="text-sm font-bold text-muted">{firstPosition}–{Math.min(page * PAGE_SIZE, data.total)} de {data.total}</span>
            {page < data.totalPages ? <Link rel="next" href={pageHref(page + 1)} className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-black text-white">Próxima →</Link> : <span />}
          </nav>
        )}
      </section>
    </main>
    <SiteFooter />
  </>;
}
