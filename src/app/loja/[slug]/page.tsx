import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRightIcon,
  ClockIcon,
  MapPinIcon,
  ShieldCheckIcon,
  StarIcon,
  WhatsAppIcon,
} from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { businesses } from "@/data/catalog";
import { getPublicBusiness } from "@/lib/public-business";

type BusinessPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return businesses.map((business) => ({ slug: business.slug }));
}

export async function generateMetadata({
  params,
}: BusinessPageProps): Promise<Metadata> {
  const { slug } = await params;
  const business = await getPublicBusiness(slug);

  if (!business) {
    return { title: "Comércio não encontrado" };
  }

  return {
    title: business.name,
    description: business.description,
  };
}

export default async function BusinessPage({ params }: BusinessPageProps) {
  const { slug } = await params;
  const business = await getPublicBusiness(slug);

  if (!business) {
    notFound();
  }

  const whatsappMessage = encodeURIComponent(
    `Olá! Encontrei a ${business.name} no O Calçadão e gostaria de mais informações.`,
  );
  const whatsappHref = business.whatsapp
    ? `https://wa.me/${business.whatsapp}?text=${whatsappMessage}`
    : null;

  return (
    <>
      <SiteHeader />
      <main className="min-h-[70vh] bg-canvas">
        <section
          className={`relative overflow-hidden bg-gradient-to-br ${business.palette}`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(255,255,255,0.24),transparent_30%)]" />
          <div className="relative mx-auto max-w-7xl px-4 py-12 text-white sm:px-6 sm:py-16 lg:px-8">
            <Link
              href="/buscar"
              className="inline-flex items-center gap-2 rounded-lg text-sm font-bold text-white/80 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white"
            >
              <span aria-hidden="true">←</span>
              Voltar para a avenida
            </Link>

            <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-start gap-4 sm:items-center">
                <span className="grid size-20 shrink-0 place-items-center rounded-3xl border border-white/35 bg-white/20 text-2xl font-black shadow-xl backdrop-blur-sm sm:size-24">
                  {business.initials}
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-white/75">
                    {business.categoryName}
                  </p>
                  <h1 className="mt-2 flex items-center gap-2 text-3xl font-black tracking-[-0.045em] sm:text-5xl">
                    {business.name}
                    {business.verified && (
                      <>
                        <ShieldCheckIcon className="size-6 shrink-0" />
                        <span className="sr-only">Comércio verificado</span>
                      </>
                    )}
                  </h1>
                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-white/85">
                    {business.reviewCount > 0 ? (
                      <span className="inline-flex items-center gap-1.5">
                        <StarIcon className="size-4 fill-accent stroke-accent" />
                        {business.rating.toLocaleString("pt-BR")} ({business.reviewCount})
                      </span>
                    ) : (
                      <span>Nova no O Calçadão</span>
                    )}
                    <span>{business.neighborhood}</span>
                  </p>
                </div>
              </div>
              <span className="w-fit rounded-full bg-white px-4 py-2 text-sm font-black text-ink shadow-md">
                {business.hoursAvailable === false
                  ? "Consulte o horário"
                  : business.isOpen
                    ? `Aberto · até ${business.closesAt}`
                    : "Fechado agora"}
              </span>
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_22rem] lg:px-8">
          <div className="space-y-6">
            <section className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
                Sobre a loja
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">
                Bem-vindo à {business.name}
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-muted">
                {business.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {business.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-canvas px-3 py-1.5 text-xs font-bold text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
                  Vitrine
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">
                  Produtos e serviços
                </h2>
              </div>
              {business.products.length > 0 ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {business.products.map((product) => (
                  <article
                    key={product.id}
                    className="flex min-h-48 flex-col rounded-2xl border border-line bg-canvas p-5"
                  >
                    <span className="text-xs font-black uppercase tracking-wider text-muted">
                      {business.categoryName}
                    </span>
                    <h3 className="mt-3 text-lg font-black text-ink">
                      {product.name}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {product.description}
                    </p>
                    <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                      <div>
                        {product.promotionalPrice && (
                          <span className="block text-xs text-muted line-through">
                            {formatCurrency(product.price)}
                          </span>
                        )}
                        <span className="text-xl font-black text-ink">
                          {formatCurrency(product.promotionalPrice ?? product.price)}
                        </span>
                      </div>
                      <span className="grid size-10 place-items-center rounded-xl bg-surface text-brand shadow-sm">
                        <ArrowRightIcon className="size-4" />
                      </span>
                    </div>
                  </article>
                  ))}
                </div>
              ) : (
                <p className="mt-6 rounded-2xl bg-canvas p-5 text-sm font-semibold text-muted">
                  A loja ainda não publicou produtos ou serviços. Fale diretamente pelo WhatsApp.
                </p>
              )}
            </section>
          </div>

          <aside className="h-fit rounded-3xl border border-line bg-surface p-6 shadow-sm lg:sticky lg:top-24">
            <h2 className="text-xl font-black text-ink">Fale com o comércio</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Tire dúvidas, confirme disponibilidade ou faça seu pedido direto
              com a loja.
            </p>

            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1f9d61] px-5 text-sm font-black text-white transition hover:bg-[#17834f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f9d61] focus-visible:ring-offset-2"
              >
                <WhatsAppIcon className="size-5" />
                Chamar no WhatsApp
              </a>
            ) : (
              <span
                className="mt-5 inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#dce8e2] px-5 text-center text-sm font-black text-[#4d6b5d]"
                aria-disabled="true"
                title="O contato será ativado quando os dados reais forem cadastrados"
              >
                <WhatsAppIcon className="size-5" />
                Contato disponível após publicação
              </span>
            )}

            <dl className="mt-6 space-y-4 border-t border-line pt-6 text-sm">
              <div className="flex gap-3">
                <MapPinIcon className="mt-0.5 size-5 shrink-0 text-brand" />
                <div>
                  <dt className="font-black text-ink">Endereço</dt>
                  <dd className="mt-1 leading-6 text-muted">
                    {business.address}, {business.neighborhood}
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <ClockIcon className="mt-0.5 size-5 shrink-0 text-brand" />
                <div>
                  <dt className="font-black text-ink">Funcionamento</dt>
                  <dd className="mt-1 leading-6 text-muted">
                    {business.hoursAvailable === false
                      ? "Horários ainda não informados"
                      : business.isOpen
                      ? `Aberto agora, fecha às ${business.closesAt}`
                      : business.closesAt}
                  </dd>
                </div>
              </div>
            </dl>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
