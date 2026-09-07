import Link from "next/link";
import Image from "next/image";
import { CategoryGrid } from "@/components/category-grid";
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
import { categories } from "@/data/catalog";

const homeCategories = categories.slice(0, 6);

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>
      <SiteHeader />

      <main id="conteudo">
        <section className="relative overflow-hidden border-b border-line bg-canvas">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent" />
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16 lg:px-8 lg:py-20">
            <div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <CitySelector variant="hero" />
                <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.13em] text-brand-dark sm:gap-2 sm:text-sm sm:tracking-[0.14em]">
                  <SparklesIcon className="size-3.5 sm:size-4" />
                  Seu Centro Comercial
                </p>
              </div>

              <h1 className="mt-5 max-w-3xl text-balance text-[2rem] font-black leading-[1.02] tracking-[-0.052em] text-ink sm:mt-6 sm:text-5xl lg:text-6xl">
                Tudo o que sua cidade oferece, mais perto de você.
              </h1>
              <p className="mt-4 max-w-2xl text-pretty text-[0.95rem] leading-6 text-muted sm:mt-5 sm:text-lg sm:leading-8">
                Encontre lojas, serviços, produtos e ofertas locais. Escolha o
                que precisa e fale direto com o comércio pelo WhatsApp.
              </p>

              <div className="mt-6 sm:mt-8">
                <SearchForm />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-bold text-muted sm:mt-5 sm:gap-x-5 sm:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheckIcon className="size-3.5 text-[#25835f] sm:size-4" />
                  Negócios verificados
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <WhatsAppIcon className="size-3.5 text-[#25835f] sm:size-4" />
                  Contato sem intermediários
                </span>
              </div>
            </div>

            <aside className="rounded-[1.5rem] border border-line bg-surface p-3.5 shadow-[0_24px_60px_rgba(31,45,42,0.12)] sm:rounded-[2rem] sm:p-6 sm:shadow-[0_28px_70px_rgba(31,45,42,0.13)]">
              <div className="flex items-center justify-between gap-3 sm:gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.13em] text-brand-dark sm:text-xs sm:tracking-[0.14em]">
                    Perto de você
                  </p>
                  <h2 className="mt-0.5 text-lg font-black tracking-tight text-ink sm:mt-1 sm:text-xl">
                    Comércios próximos
                  </h2>
                </div>
                <span className="rounded-full bg-positive-soft px-2.5 py-1 text-[11px] font-black text-positive sm:px-3 sm:py-1.5 sm:text-xs">
                  Agora
                </span>
              </div>

              <NearbyBusinesses />
            </aside>
          </div>
        </section>

        <RegionalPaidBanners />

        <section
          id="categorias"
          className="scroll-mt-24 bg-canvas px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16"
        >
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="Explore do seu jeito"
              title="O que você procura?"
              description="Comece por uma categoria e descubra negócios da sua cidade."
              linkHref="/buscar"
              linkLabel="Ver todas as categorias"
            />
            <div className="mt-5 sm:mt-7">
              <CategoryGrid categories={homeCategories} />
            </div>
          </div>
        </section>

        <section className="bg-canvas px-4 pb-10 sm:px-6 sm:pb-14 lg:px-8 lg:pb-16">
          <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[1.5rem] border border-line bg-surface shadow-[0_20px_50px_rgba(31,45,42,0.09)] sm:rounded-[2rem] lg:grid-cols-[1.08fr_0.92fr] lg:items-stretch">
            <div className="relative min-h-[220px] sm:min-h-[340px] lg:min-h-[430px]">
              <Image
                src="/api/commerce-image"
                alt="Calçadão comercial amplo e movimentado, com lojas e serviços locais"
                fill
                priority
                sizes="(min-width: 1024px) 54vw, 100vw"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/20 via-transparent to-transparent" />
            </div>

            <div className="flex flex-col justify-center p-5 sm:p-8 lg:p-12">
              <p className="text-[11px] font-black uppercase tracking-[0.13em] text-brand-dark sm:text-xs sm:tracking-[0.14em]">
                A rua comercial, agora digital
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-ink sm:mt-3 sm:text-4xl sm:tracking-[-0.045em]">
                O comércio local no centro da cidade e na palma da sua mão.
              </h2>
              <p className="mt-3 max-w-xl text-[0.95rem] leading-6 text-muted sm:mt-4 sm:text-base sm:leading-7">
                O Calçadão reúne lojas, serviços e pequenos negócios em um só
                lugar. Descubra o que existe perto de você antes mesmo de sair
                de casa e fale diretamente com cada comércio.
              </p>
              <Link
                href="/buscar"
                className="mt-5 inline-flex w-fit items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:mt-7 sm:px-5 sm:py-3"
              >
                Explorar o Centro Comercial
                <ArrowRightIcon className="size-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-surface px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="Boas escolhas por perto"
              title="Comércios em destaque"
              description="Vitrines reais que contrataram mais visibilidade na sua cidade."
              linkHref="/buscar"
              linkLabel="Explorar o Centro Comercial"
            />
            <FeaturedBusinesses />
          </div>
        </section>

        <section className="bg-canvas px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="Escolhidos pelas lojas"
              title="Produtos e serviços em destaque"
              description="Cada comércio pode escolher um item da própria vitrine para ganhar mais visibilidade."
            />
            <FeaturedCatalogItems />
          </div>
        </section>

        <section
          id="ofertas"
          className="scroll-mt-24 bg-surface px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16"
        >
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="Vale aproveitar"
              title="Ofertas da cidade"
              description="Promoções reais publicadas pelos próprios comércios locais. A oferta escolhida como destaque aparece primeiro."
            />
            <CityPromotions />
          </div>
        </section>

        <section className="bg-ink px-4 py-12 text-white sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 sm:gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end lg:gap-10">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-accent sm:text-sm">
                  Simples e direto
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:mt-3 sm:text-4xl sm:tracking-[-0.045em]">
                  Da descoberta à conversa em três passos.
                </h2>
              </div>
              <ol className="grid gap-3 sm:grid-cols-3">
                {[
                  ["01", "Busque", "Digite o que precisa ou escolha uma categoria."],
                  ["02", "Conheça", "Compare vitrines, produtos e ofertas locais."],
                  ["03", "Converse", "Chame o comércio diretamente pelo WhatsApp."],
                ].map(([number, title, text]) => (
                  <li
                    key={number}
                    className="rounded-2xl border border-white/12 bg-white/[0.06] p-4 sm:p-5"
                  >
                    <span className="text-xs font-black tracking-widest text-accent">
                      {number}
                    </span>
                    <h3 className="mt-4 text-lg font-black sm:mt-5">{title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-white/65 sm:mt-2">{text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section
          id="para-empresas"
          className="scroll-mt-24 bg-accent px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-5 rounded-[1.5rem] border border-ink/10 bg-[#ffd766] p-5 sm:gap-7 sm:rounded-[2rem] sm:p-9 lg:flex-row lg:items-center lg:justify-between lg:p-12">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white sm:text-xs">
                <StoreIcon className="size-4" />
                Para o comércio local
              </span>
              <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-ink sm:mt-5 sm:text-4xl sm:tracking-[-0.045em]">
                Sua vitrine aberta para toda a cidade.
              </h2>
              <p className="mt-2.5 max-w-2xl text-[0.95rem] leading-6 text-ink/70 sm:mt-3 sm:text-base sm:leading-7">
                Mostre seus produtos, publique promoções e transforme visitas em
                conversas no WhatsApp. Sem intermediar pagamentos no lançamento.
              </p>
            </div>
            <Link
              href="/cadastro"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-black text-white shadow-[0_12px_25px_rgba(187,61,35,0.2)] transition hover:-translate-y-0.5 hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-accent sm:min-h-13 sm:rounded-2xl sm:px-6 sm:text-base"
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

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  linkHref?: string;
  linkLabel?: string;
};

function SectionHeading({
  eyebrow,
  title,
  description,
  linkHref,
  linkLabel,
}: SectionHeadingProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.13em] text-brand-dark sm:text-xs sm:tracking-[0.14em]">
          {eyebrow}
        </p>
        <h2 className="mt-1.5 text-2xl font-black tracking-[-0.04em] text-ink sm:mt-2 sm:text-3xl lg:text-4xl lg:tracking-[-0.045em]">
          {title}
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted sm:mt-2 sm:text-base">
          {description}
        </p>
      </div>
      {linkHref && linkLabel && (
        <Link
          href={linkHref}
          className="inline-flex w-fit items-center gap-2 rounded-lg text-sm font-black text-ink outline-none hover:text-brand-dark focus-visible:ring-2 focus-visible:ring-brand"
        >
          {linkLabel}
          <ArrowRightIcon className="size-4" />
        </Link>
      )}
    </div>
  );
}
