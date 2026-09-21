import Link from "next/link";
import {
  ArrowRightIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StoreIcon,
  WhatsAppIcon,
} from "@/components/icons";
import { CityPromotions } from "@/components/city-promotions";
import { NearbyBusinesses } from "@/components/nearby-businesses";
import { SearchForm } from "@/components/search-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CitySelector } from "@/components/city-selector";
import { FeaturedBusinesses } from "@/components/featured-businesses";
import { FeaturedCatalogItems } from "@/components/featured-catalog-items";
import { RegionalPaidBanners } from "@/components/regional-paid-banners";
import { CompactCategories } from "@/components/home/compact-categories";
import { DiscoveryBusinesses } from "@/components/home/discovery-businesses";
import { HomeFeedSection } from "@/components/home/home-feed-section";
import { HomeScrollRestoration } from "@/components/home/home-scroll-restoration";
import { categories } from "@/data/catalog";

const homeCategories = categories.filter((category) => category.slug !== "eletropostos").slice(0, 7);

export default function Home() {
  return (
    <>
      <HomeScrollRestoration />
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>
      <SiteHeader />

      <main id="conteudo" className="w-full min-w-0 max-w-full overflow-x-hidden">
        <section className="relative overflow-hidden border-b border-line bg-canvas">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent" />
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8 lg:py-11">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <CitySelector variant="hero" />
                <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-brand-dark sm:text-xs">
                  <SparklesIcon className="size-3.5" />
                  Seu Centro Comercial
                </p>
              </div>

              <h1 className="mt-3 max-w-3xl text-balance text-[1.7rem] font-black leading-[1.07] tracking-[-0.045em] text-ink sm:mt-4 sm:text-[2.45rem] lg:text-[3rem]">
                Encontre o que precisa perto de você.
              </h1>
              <p className="mt-2.5 max-w-2xl text-sm font-semibold leading-6 text-muted sm:mt-3 sm:text-base sm:leading-7">
                Lojas, serviços, ofertas e locais da sua cidade em uma busca simples.
              </p>

              <div className="mt-4 sm:mt-5">
                <SearchForm />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-bold text-muted sm:mt-4 sm:text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheckIcon className="size-3.5 text-[#25835f]" />
                  Informações moderadas
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <WhatsAppIcon className="size-3.5 text-[#25835f]" />
                  Contato direto com o comércio
                </span>
              </div>
            </div>
          </div>
        </section>

        <HomeFeedSection
          id="categorias"
          title="Explore por categoria"
          description="Atalhos rápidos para encontrar o que você procura."
          compact
        >
          <Link
            href="/buscar?categoria=eletropostos"
            className="group mb-3 flex min-h-24 items-center gap-3 rounded-2xl border border-brand/30 bg-[#fff2e9] px-3.5 py-3 shadow-sm transition hover:border-brand/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:gap-4 sm:px-5"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand text-2xl text-white sm:size-14" aria-hidden="true">
              ⚡
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-black uppercase tracking-[0.1em] text-brand-dark">
                Mobilidade elétrica · Em destaque
              </span>
              <span className="mt-0.5 block text-base font-black leading-tight text-ink sm:text-lg">
                Eletropostos
              </span>
              <span className="mt-0.5 block text-xs font-semibold leading-5 text-muted sm:text-sm">
                Encontre pontos de recarga para veículos elétricos na sua cidade.
              </span>
            </span>
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-dark text-white transition group-hover:translate-x-0.5 sm:size-auto sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2" aria-hidden="true">
              <span className="hidden text-xs font-black sm:inline">Ver pontos</span>
              <ArrowRightIcon className="size-4" />
            </span>
          </Link>
          <CompactCategories categories={homeCategories} />
        </HomeFeedSection>

        <NearbyBusinesses />
        <RegionalPaidBanners />
        <FeaturedBusinesses />
        <div id="ofertas" className="scroll-mt-24"><CityPromotions /></div>

        <section className="border-b border-line bg-canvas px-4 py-4 sm:px-6"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black text-ink">O que acontece na sua cidade?</h2><p className="text-xs text-muted">Shows, feiras, festivais e encontros locais.</p></div><Link href="/eventos" className="inline-flex min-h-11 items-center rounded-xl bg-ink px-4 py-3 text-sm font-black text-white">Explorar eventos →</Link></div></section>

        <section className="border-b border-line bg-surface px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-muted">Quer explorar estabelecimentos de outras cidades?</p>
            <Link href="/descobrir" className="inline-flex min-h-11 items-center text-sm font-black text-brand-dark underline underline-offset-4 hover:text-ink">
              Descobrir pelo Brasil →
            </Link>
          </div>
        </section>

        <FeaturedCatalogItems />
        <DiscoveryBusinesses />

        <section
          id="para-empresas"
          className="scroll-mt-24 bg-accent px-4 py-8 sm:px-6 sm:py-11 lg:px-8"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-5 rounded-[1.5rem] border border-ink/10 bg-[#ffd766] p-5 sm:gap-7 sm:rounded-[2rem] sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:p-10">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white sm:text-xs">
                <StoreIcon className="size-4" />
                Para o comércio local
              </span>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-ink sm:mt-4 sm:text-3xl lg:text-4xl">
                Sua vitrine aberta para toda a cidade.
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-ink/70 sm:text-base sm:leading-7">
                Mostre seus produtos, publique promoções e transforme visitas em conversas diretas com clientes.
              </p>
            </div>
            <Link
              href="/cadastro"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-dark px-5 text-sm font-black text-white shadow-[0_12px_25px_rgba(187,61,35,0.2)] transition hover:-translate-y-0.5 hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-accent sm:rounded-2xl sm:px-6 sm:text-base"
            >
              Criar minha vitrine
              <ArrowRightIcon className="size-5" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
