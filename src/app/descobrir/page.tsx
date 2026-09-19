import type { Metadata } from "next";
import Link from "next/link";
import { CitySelector } from "@/components/city-selector";
import { DiscoveryCityLink } from "@/components/discovery-city-link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SearchForm } from "@/components/search-form";
import { categories } from "@/data/catalog";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Descubra comércios, serviços e lugares do Brasil",
  description: "Encontre lojas, serviços e locais públicos em diferentes cidades do Brasil. Escolha sua cidade e visite vitrines com informações e localização.",
  alternates: { canonical: "/descobrir" },
  openGraph: {
    type: "website", locale: "pt_BR", siteName: "O Calçadão", url: "/descobrir",
    title: "Descubra comércios e serviços pelo Brasil | O Calçadão",
    description: "Explore cidades, categorias e vitrines de estabelecimentos no O Calçadão.",
  },
};

const featuredCities = [
  ["Assis", "SP"], ["Marília", "SP"], ["Ourinhos", "SP"],
  ["Presidente Prudente", "SP"], ["Ribeirão Preto", "SP"],
  ["Olímpia", "SP"], ["Barra Bonita", "SP"], ["Bauru", "SP"],
  ["Botucatu", "SP"], ["São Paulo", "SP"], ["Rio de Janeiro", "RJ"],
  ["Sumaré", "SP"],
] as const;

export default async function DiscoverPage() {
  const supabase = createPublicClient();
  const names = [...new Set(featuredCities.map(([name]) => name))];
  const { data: cityData, error: citiesError } = await supabase
    .from("cities").select("id, name, state_code")
    .in("name", names).eq("is_active", true).limit(100);

  if (citiesError) console.error("[descobrir] Falha ao carregar cidades", citiesError);

  const cityByKey = new Map(
    (cityData ?? []).map((city) => [city.name + "/" + city.state_code, city]),
  );
  const candidateCities = featuredCities
    .map(([name, state]) => cityByKey.get(name + "/" + state))
    .filter((city): city is NonNullable<typeof city> => Boolean(city));

  const selections = await Promise.all(candidateCities.map(async (city) => {
    const { data, error } = await supabase
      .from("businesses")
      .select("slug, name, neighborhood, categories(name)")
      .eq("city_id", city.id)
      .eq("publication_status", "published")
      .eq("is_active", true)
      .eq("billing_suspended", false)
      .order("updated_at", { ascending: false })
      .limit(2);
    if (error) console.error("[descobrir] Falha ao carregar vitrines da cidade " + city.id, error);
    return { city, businesses: data ?? [] };
  }));
  const available = selections.filter((selection) => selection.businesses.length > 0);

  return (
    <>
      <SiteHeader />
      <main className="min-h-[70vh] bg-canvas">
        <section className="border-b border-line bg-surface px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">Descoberta nacional</p>
            <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-tight text-ink sm:text-5xl">
              Encontre comércios e lugares pelo Brasil
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted sm:text-base">
              Explore vitrines de empresas, serviços e locais públicos. Escolha sua cidade
              para ver os resultados daquela região ou visite as vitrines abaixo.
            </p>
            <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <CitySelector variant="hero" />
              <SearchForm compact />
            </div>
          </div>
        </section>
        <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
          <section aria-labelledby="discovery-cities-title">
            <h2 id="discovery-cities-title" className="text-2xl font-black tracking-tight text-ink">
              Explore por cidade
            </h2>
            <p className="mt-2 text-sm text-muted">
              Selecione uma cidade para atualizar a busca. Outras cidades estão disponíveis no seletor acima.
            </p>
            {available.length > 0 ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {available.map(({ city }) => (
                  <DiscoveryCityLink key={city.id} city={{
                    id: city.id, name: city.name, stateCode: city.state_code,
                  }} />
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">Escolha sua cidade acima para encontrar estabelecimentos.</p>
            )}
          </section>
          <section aria-labelledby="discovery-categories-title">
            <h2 id="discovery-categories-title" className="text-2xl font-black tracking-tight text-ink">
              O que você procura?
            </h2>
            <p className="mt-2 text-sm text-muted">
              Selecione uma categoria para buscar estabelecimentos na cidade escolhida.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {categories.map((category) => (
                <Link key={category.slug} href={"/buscar?categoria=" + encodeURIComponent(category.slug)}
                  className="rounded-2xl border border-line bg-surface p-4 transition hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                  <span aria-hidden="true" className="text-xl">{category.icon}</span>
                  <span className="mt-2 block text-sm font-black text-ink">{category.name}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted">{category.description}</span>
                </Link>
              ))}
            </div>
          </section>
          {available.length > 0 && (
            <section aria-labelledby="discovery-stores-title">
              <h2 id="discovery-stores-title" className="text-2xl font-black tracking-tight text-ink">
                Conheça vitrines de diferentes cidades
              </h2>
              <p className="mt-2 text-sm text-muted">
                Uma seleção de estabelecimentos publicados. Para descobrir mais, escolha sua cidade ou pesquise pelo nome do negócio.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {available.flatMap(({ city, businesses }) => businesses.map((business) => {
                  const category = Array.isArray(business.categories)
                    ? business.categories[0] : business.categories;
                  return (
                    <article key={business.slug} className="rounded-2xl border border-line bg-surface p-5">
                      <p className="text-xs font-bold uppercase tracking-wide text-brand-dark">
                        {city.name} · {city.state_code}
                      </p>
                      <h3 className="mt-2 text-lg font-black text-ink">{business.name}</h3>
                      <p className="mt-1 text-sm text-muted">
                        {category?.name ?? "Comércio local"}
                        {business.neighborhood ? " · " + business.neighborhood : ""}
                      </p>
                      <Link href={"/loja/" + encodeURIComponent(business.slug)}
                        className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-brand px-4 text-sm font-black text-white transition hover:bg-brand-dark">
                        Ver vitrine <span aria-hidden="true" className="ml-2">→</span>
                      </Link>
                    </article>
                  );
                }))}
              </div>
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
