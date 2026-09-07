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
import { PromotionCard } from "@/components/promotion-card";
import { NearbyBusinesses } from "@/components/nearby-businesses";
import { SearchForm } from "@/components/search-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CitySelector } from "@/components/city-selector";
import { FeaturedBusinesses } from "@/components/featured-businesses";
import { RegionalPaidBanners } from "@/components/regional-paid-banners";
import { businesses, categories, promotions } from "@/data/catalog";

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
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16 lg:px-8 lg:py-20">
            <div>
              <CitySelector variant="hero" />

              <p className="mt-8 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-brand-dark">
                <SparklesIcon className="size-4" />
                Seu Centro Comercial
              </p>
              <h1 className="mt-3 max-w-3xl text-balance text-4xl font-black leading-[1.03] tracking-[-0.055em] text-ink sm:text-5xl lg:text-6xl">
                Tudo o que sua cidade oferece, mais perto de você.
              </h1>
              <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-muted sm:text-lg sm:leading-8">
                Encontre lojas, serviços, produtos e ofertas locais. Escolha o
                que precisa e fale direto com o comércio pelo WhatsApp.
              </p>

              <div className="mt-8">
                <SearchForm />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-muted sm:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheckIcon className="size-4 text-[#25835f]" />
                  Negócios verificados
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <WhatsAppIcon className="size-4 text-[#25835f]" />
                  Contato sem intermediários
                </span>
              </div>
            </div>

            <aside className="rounded-[2rem] border border-line bg-surface p-4 shadow-[0_28px_70px_rgba(31,45,42,0.13)] sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
                    Perto de você
                  </p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-ink">
                    Comércios próximos
                  </h2>
                </div>
                <span className="rounded-full bg-positive-soft px-3 py-1.5 text-xs font-black text-positive">
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
          className="scroll-mt-24 bg-canvas px-4 py-14 sm:px-6 sm:py-18 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="Explore do seu jeito"
              title="O que você procura?"
              description="Comece por uma categoria e descubra negócios da sua cidade."
              linkHref="/buscar"
              linkLabel="Ver tudo"
            />
            <div className="mt-7">
              <CategoryGrid categories={categories} />
            </div>
          </div>
        </section>

        <section className="bg-canvas px-4 pb-14 sm:px-6 sm:pb-18 lg:px-8">
          <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] border border-line bg-surface shadow-[0_24px_60px_rgba(31,45,42,0.10)] lg:grid-cols-[1.08fr_0.92fr] lg:items-stretch">
            <div className="relative min-h-[250px] sm:min-h-[360px] lg:min-h-[430px]">
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

            <div className="flex flex-col justify-center p-6 sm:p-9 lg:p-12">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
                A rua comercial, agora digital
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">
                O comércio local no centro da cidade e na palma da sua mão.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-muted">
                O Calçadão reúne lojas, serviços e pequenos negócios em um só
                lugar. Descubra o que existe perto de você antes mesmo de sair
                de casa e fale diretamente com cada comércio.
              </p>
              <Link
                href="/buscar"
                className="mt-7 inline-flex w-fit items-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                Explorar o Centro Comercial
                <ArrowRightIcon className="size-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-surface px-4 py-14 sm:px-6 sm:py-18 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="Boas escolhas por perto"
              title="Comércios em destaque"
              description="Vitrines locais para conhecer antes de sair de casa."
              linkHref="/buscar"
              linkLabel="Explorar o Centro Comercial"
            />
            <FeaturedBusinesses fallback={businesses} />
          </div>
        </section>

        <section
          id="ofertas"
          className="scroll-mt-24 bg-canvas px-4 py-14 sm:px-6 sm:py-18 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="Vale aproveitar"
              title="Ofertas da cidade"
              description="Promoções publicadas pelos próprios comércios locais."
            />
            <div className="mt-7 grid gap-5 md:grid-cols-3">
              {promotions.map((promotion) => (
                <PromotionCard key={promotion.id} promotion={promotion} />
              ))}
            </div>
          </div>
        </section>

        <section className="bg-ink px-4 py-16 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.14em] text-accent">
                  Simples e direto
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
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
                    className="rounded-2xl border border-white/12 bg-white/[0.06] p-5"
                  >
                    <span className="text-xs font-black tracking-widest text-accent">
                      {number}
                    </span>
                    <h3 className="mt-5 text-lg font-black">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/65">{text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section
          id="para-empresas"
          className="scroll-mt-24 bg-accent px-4 py-16 sm:px-6 lg:px-8"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-7 rounded-[2rem] border border-ink/10 bg-[#ffd766] p-6 sm:p-9 lg:flex-row lg:items-center lg:justify-between lg:p-12">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white">
                <StoreIcon className="size-4" />
                Para o comércio local
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">
                Sua vitrine aberta para toda a cidade.
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-ink/70">
                Mostre seus produtos, publique promoções e transforme visitas em
                conversas no WhatsApp. Sem intermediar pagamentos no lançamento.
              </p>
            </div>
            <Link
              href="/cadastro"
              className="inline-flex min-h-13 shrink-0 items-center justify-center gap-2 rounded-2xl bg-brand px-6 text-base font-black text-white shadow-[0_12px_25px_rgba(187,61,35,0.2)] transition hover:-translate-y-0.5 hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-accent"
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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">
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
