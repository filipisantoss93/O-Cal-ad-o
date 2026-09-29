import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { CitySelector } from "@/components/city-selector";
import { TagIcon } from "@/components/icons";
import { PromotionCard } from "@/components/promotion-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { selectedCityCookieName } from "@/lib/location";
import {
  listCityPromotions,
  OFFERS_PAGE_SIZE,
  type CityPromotionsResult,
} from "@/lib/public-promotions";
import { createPublicClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Ofertas da sua cidade",
  description: "Descubra promoções e oportunidades publicadas pelos comércios da sua cidade.",
  alternates: { canonical: "/ofertas" },
  robots: { index: false, follow: true },
};

type OffersPageProps = {
  searchParams: Promise<{ pagina?: string }>;
};

function pageHref(page: number) {
  return page > 1 ? `/ofertas?pagina=${page}` : "/ofertas";
}

function emptyPromotions(page: number): CityPromotionsResult {
  return {
    promotions: [],
    total: 0,
    featuredTotal: 0,
    organicTotal: 0,
    page,
    pageSize: OFFERS_PAGE_SIZE,
    totalPages: 0,
  };
}

export default async function OffersPage({ searchParams }: OffersPageProps) {
  const { pagina } = await searchParams;
  const parsedPage = Number.parseInt(pagina ?? "1", 10);
  const requestedPage = Number.isSafeInteger(parsedPage) && parsedPage > 0
    ? parsedPage
    : 1;
  const selectedId = Number((await cookies()).get(selectedCityCookieName)?.value);
  const cityId = Number.isSafeInteger(selectedId) && selectedId > 0
    ? selectedId
    : null;
  const supabase = createPublicClient();

  let loadError = false;
  let result = emptyPromotions(requestedPage);
  let city: { name: string; state_code: string } | null = null;

  if (cityId) {
    const [offersResult, cityResult] = await Promise.allSettled([
      listCityPromotions(cityId, requestedPage),
      supabase
        .from("cities")
        .select("name,state_code")
        .eq("id", cityId)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

    if (offersResult.status === "fulfilled") {
      result = offersResult.value;
    } else {
      loadError = true;
      console.error("[ofertas] public feed failed", offersResult.reason);
    }

    if (cityResult.status === "fulfilled" && !cityResult.value.error) {
      city = cityResult.value.data;
    }
  }

  const cityLabel = city ? `${city.name} – ${city.state_code}` : null;

  return (
    <>
      <SiteHeader />
      <main className="min-h-[70vh] bg-canvas">
        <section className="border-b border-line bg-surface px-4 py-8 sm:px-6 sm:py-11 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div className="max-w-3xl">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
                  Vale aproveitar
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">
                  Ofertas da sua cidade
                </h1>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted sm:text-base sm:leading-7">
                  Encontre promoções ativas perto de você e fale diretamente com o comércio.
                </p>
              </div>
              <CitySelector variant="hero" />
            </div>

            <div className="mt-6 flex gap-3 rounded-2xl border border-brand/20 bg-[#fff2e9] p-4 text-sm leading-6 text-ink">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-white">
                <TagIcon className="size-4" />
              </span>
              <p>
                <strong>Destaques aparecem primeiro em cada grupo</strong> e recebem identificação especial.
                As demais ofertas são intercaladas para manter variedade e oportunidades para todos.
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {!cityId ? (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-surface px-6 text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-canvas text-brand-dark">
                  <TagIcon className="size-6" />
                </span>
                <h2 className="mt-5 text-xl font-black text-ink">Escolha sua cidade</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted">
                  Use o seletor no topo para ver somente ofertas válidas na sua cidade.
                </p>
              </div>
            ) : loadError ? (
              <div className="rounded-3xl border border-line bg-surface p-8 text-center">
                <h2 className="text-xl font-black text-ink">Não foi possível carregar as ofertas</h2>
                <p className="mt-2 text-sm text-muted">Tente novamente em alguns instantes.</p>
              </div>
            ) : result.promotions.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-surface px-6 text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-canvas text-brand-dark">
                  <TagIcon className="size-6" />
                </span>
                <h2 className="mt-5 text-xl font-black text-ink">Ainda não há ofertas ativas</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted">
                  {cityLabel
                    ? `Nenhuma promoção válida foi publicada em ${cityLabel} neste momento.`
                    : "Nenhuma promoção válida foi publicada nesta cidade neste momento."}
                </p>
                <Link
                  href="/buscar"
                  className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-ink px-5 text-sm font-black text-white"
                >
                  Explorar comércios
                </Link>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-muted">
                      {cityLabel ?? "Cidade selecionada"}
                    </p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight text-ink">
                      Todas as ofertas ativas
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-black text-muted">
                    <span className="rounded-full border border-line bg-surface px-3 py-1.5">
                      {result.total} {result.total === 1 ? "oferta" : "ofertas"}
                    </span>
                    {result.featuredTotal > 0 ? (
                      <span className="rounded-full bg-ink px-3 py-1.5 text-white">
                        {result.featuredTotal} em destaque
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                  {result.promotions.map((promotion) => (
                    <PromotionCard key={promotion.id} promotion={promotion} />
                  ))}
                </div>

                {result.totalPages > 1 ? (
                  <nav className="mt-9 flex flex-wrap items-center justify-center gap-3" aria-label="Paginação das ofertas">
                    {result.page > 1 ? (
                      <Link href={pageHref(result.page - 1)} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-4 text-sm font-black text-ink transition hover:bg-canvas">
                        Anterior
                      </Link>
                    ) : (
                      <span className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-4 text-sm font-black text-muted/45">
                        Anterior
                      </span>
                    )}
                    <span className="rounded-full bg-surface px-4 py-2 text-sm font-black text-muted">
                      Página {result.page} de {result.totalPages}
                    </span>
                    {result.page < result.totalPages ? (
                      <Link href={pageHref(result.page + 1)} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-4 text-sm font-black text-ink transition hover:bg-canvas">
                        Próxima
                      </Link>
                    ) : (
                      <span className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-4 text-sm font-black text-muted/45">
                        Próxima
                      </span>
                    )}
                  </nav>
                ) : null}
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
