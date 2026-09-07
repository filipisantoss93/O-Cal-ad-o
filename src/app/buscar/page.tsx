import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { SearchIcon } from "@/components/icons";
import { SearchForm } from "@/components/search-form";
import { SearchBusinessResults } from "@/components/search-business-results";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { categories } from "@/data/catalog";
import { selectedCityCookieName } from "@/lib/location";
import { searchPublicBusinesses } from "@/lib/public-search";

export const metadata: Metadata = {
  title: "Explorar comércios",
  description:
    "Pesquise lojas, produtos e serviços disponíveis no comércio local.",
};

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    categoria?: string;
  }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "", categoria } = await searchParams;
  const cookieStore = await cookies();
  const cityId = Number(cookieStore.get(selectedCityCookieName)?.value ?? "");
  const hasSelectedCity = Number.isInteger(cityId) && cityId > 0;
  const selectedCategory = categories.find((item) => item.slug === categoria);
  const results = hasSelectedCity
    ? await searchPublicBusinesses(q, selectedCategory?.slug, cityId)
    : [];
  const hasFilter = Boolean(q.trim() || selectedCategory);

  return (
    <>
      <SiteHeader />
      <main className="min-h-[70vh] bg-canvas">
        <section className="border-b border-line bg-surface px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
              Centro Comercial
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">
              Encontre na sua cidade
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">
              Pesquise pelo nome da loja, produto, serviço, tag ou bairro. Os resultados são limitados à cidade selecionada.
            </p>
            <div className="mt-6">
              <SearchForm
                compact
                initialQuery={q}
                category={selectedCategory?.slug}
              />
            </div>

            <nav
              className="mt-5 flex gap-2 overflow-x-auto pb-2"
              aria-label="Filtrar por categoria"
            >
              <Link
                href={q ? `/buscar?q=${encodeURIComponent(q)}` : "/buscar"}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-extrabold transition ${
                  !selectedCategory
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-canvas text-muted hover:border-ink/20 hover:text-ink"
                }`}
              >
                Todas
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/buscar?categoria=${category.slug}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-extrabold transition ${
                    selectedCategory?.slug === category.slug
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-canvas text-muted hover:border-ink/20 hover:text-ink"
                  }`}
                >
                  {category.icon} {category.name}
                </Link>
              ))}
            </nav>
          </div>
        </section>

        <section className="px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-muted">
                  {hasSelectedCity
                    ? hasFilter
                      ? "Resultados encontrados na cidade selecionada"
                      : "Comércios da cidade selecionada"
                    : "Selecione sua cidade"}
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-ink">
                  {selectedCategory?.name ?? (q ? `Busca por “${q}”` : "Explore o Centro Comercial")}
                </h2>
              </div>
              {hasSelectedCity && (
                <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-black text-muted">
                  {results.length} {results.length === 1 ? "resultado" : "resultados"}
                </span>
              )}
            </div>

            {!hasSelectedCity ? (
              <div className="mt-7 flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-surface px-6 text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-canvas text-muted">
                  <SearchIcon className="size-6" />
                </span>
                <h2 className="mt-5 text-xl font-black text-ink">
                  Escolha sua cidade para pesquisar
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted">
                  Use o seletor de cidade no topo da página ou sua localização atual. Assim mostramos somente comércios da sua cidade.
                </p>
              </div>
            ) : results.length > 0 ? (
              <SearchBusinessResults businesses={results} />
            ) : (
              <div className="mt-7 flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-surface px-6 text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-canvas text-muted">
                  <SearchIcon className="size-6" />
                </span>
                <h2 className="mt-5 text-xl font-black text-ink">
                  Nenhum comércio encontrado nesta cidade
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted">
                  Tente outro termo ou retire o filtro de categoria para ampliar a busca dentro da cidade selecionada.
                </p>
                <Link
                  href="/buscar"
                  className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-black text-white transition hover:bg-ink-soft"
                >
                  Limpar filtros
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
