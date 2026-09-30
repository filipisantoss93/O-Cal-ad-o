import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { citySeoSlug, localSeoSlug, parseCitySeoSlug } from "@/lib/seo/local-landing";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MIN_INDEXABLE_BUSINESSES = 10;

type Props = {
  params: Promise<{ cidadeUf: string }>;
};

async function getCityPageData(cidadeUf: string) {
  const parsed = parseCitySeoSlug(cidadeUf);
  if (!parsed) return null;

  const supabase = createPublicClient();
  const { data: cities, error: citiesError } = await supabase
    .from("cities")
    .select("id,name,state_code")
    .eq("state_code", parsed.stateCode)
    .eq("is_active", true)
    .limit(1000);

  if (citiesError) throw citiesError;

  const city = (cities ?? []).find((candidate) => localSeoSlug(candidate.name) === parsed.citySlug);
  if (!city) return null;

  const baseQuery = supabase
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .eq("city_id", city.id)
    .eq("publication_status", "published")
    .eq("is_active", true)
    .eq("billing_suspended", false);

  const { count, error: countError } = await baseQuery;
  if (countError) throw countError;

  const { data: businesses, error: businessesError } = await supabase
    .from("businesses")
    .select("slug,name,neighborhood,categories(name,slug)")
    .eq("city_id", city.id)
    .eq("publication_status", "published")
    .eq("is_active", true)
    .eq("billing_suspended", false)
    .order("updated_at", { ascending: false })
    .limit(30);

  if (businessesError) throw businessesError;

  return {
    city,
    count: count ?? 0,
    businesses: businesses ?? [],
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cidadeUf } = await params;
  const data = await getCityPageData(cidadeUf);
  if (!data) return { title: "Cidade não encontrada", robots: { index: false, follow: false } };

  const canonicalSlug = citySeoSlug(data.city.name, data.city.state_code);
  const title = `Comércios, serviços e lugares em ${data.city.name}, ${data.city.state_code}`;
  const description = `Encontre ${data.count} estabelecimentos e lugares cadastrados em ${data.city.name}, ${data.city.state_code}. Consulte vitrines, endereços e canais de contato no O Calçadão.`;

  return {
    title,
    description,
    alternates: { canonical: `/cidade/${canonicalSlug}` },
    robots: data.count >= MIN_INDEXABLE_BUSINESSES
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: "O Calçadão",
      title: `${title} | O Calçadão`,
      description,
      url: `/cidade/${canonicalSlug}`,
    },
  };
}

export default async function CityPage({ params }: Props) {
  const { cidadeUf } = await params;
  const data = await getCityPageData(cidadeUf);
  if (!data) notFound();

  const canonicalSlug = citySeoSlug(data.city.name, data.city.state_code);
  if (cidadeUf !== canonicalSlug) notFound();

  const itemList = data.businesses.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `Estabelecimentos em ${data.city.name}, ${data.city.state_code}`,
        numberOfItems: data.count,
        itemListElement: data.businesses.map((business, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: business.name,
          url: `https://ocalcadao.com.br/loja/${encodeURIComponent(business.slug)}`,
        })),
      }
    : null;

  return (
    <>
      <SiteHeader />
      {itemList && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList).replace(/</g, "\\u003c") }}
        />
      )}
      <main className="min-h-[70vh] bg-canvas">
        <section className="border-b border-line bg-surface px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
              Guia local
            </p>
            <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-tight text-ink sm:text-5xl">
              Comércios, serviços e lugares em {data.city.name}, {data.city.state_code}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              O Calçadão reúne {data.count} vitrines públicas disponíveis nesta cidade.
              Consulte estabelecimentos, bairros e informações de contato diretamente nas vitrines.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/descobrir"
                className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-black text-ink"
              >
                Explorar outras cidades
              </Link>
              <Link
                href="/buscar"
                className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-black text-white"
              >
                Pesquisar estabelecimentos
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8" aria-labelledby="city-businesses-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="city-businesses-title" className="text-2xl font-black tracking-tight text-ink">
                Estabelecimentos em {data.city.name}
              </h2>
              <p className="mt-2 text-sm text-muted">
                Seleção de vitrines publicadas e recentemente atualizadas.
              </p>
            </div>
            <p className="text-sm font-bold text-muted">{data.count} disponíveis</p>
          </div>

          {data.businesses.length ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.businesses.map((business) => {
                const category = Array.isArray(business.categories)
                  ? business.categories[0]
                  : business.categories;
                return (
                  <article key={business.slug} className="rounded-2xl border border-line bg-surface p-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-brand-dark">
                      {category?.name ?? "Comércio local"}
                    </p>
                    <h3 className="mt-2 text-lg font-black text-ink">{business.name}</h3>
                    {business.neighborhood && (
                      <p className="mt-1 text-sm text-muted">{business.neighborhood}</p>
                    )}
                    <Link
                      href={`/loja/${encodeURIComponent(business.slug)}`}
                      className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-brand px-4 text-sm font-black text-white transition hover:bg-brand-dark"
                    >
                      Ver vitrine <span aria-hidden="true" className="ml-2">→</span>
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted">
              Ainda não há vitrines públicas suficientes nesta cidade.
            </p>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
