import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ClockIcon,
  LocateIcon,
  MapPinIcon,
  ShieldCheckIcon,
  StarIcon,
  WhatsAppIcon,
} from "@/components/icons";
import { HighlightTracker } from "@/components/highlight-tracker";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  catalogConversionLabel,
  catalogWhatsappHref,
} from "@/lib/catalog-conversion";
import { catalogPricePresentation } from "@/lib/catalog-pricing";
import {
  getAdminBusinessPreview,
  getPublicBusiness,
} from "@/lib/public-business";

type BusinessPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string; item?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: BusinessPageProps): Promise<Metadata> {
  const { preview } = await searchParams;
  if (preview === "admin") {
    return {
      title: "Pré-visualização administrativa",
      robots: { index: false, follow: false },
    };
  }
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

export default async function BusinessPage({
  params,
  searchParams,
}: BusinessPageProps) {
  const { slug } = await params;
  const { preview, item } = await searchParams;
  const isAdminPreview = preview === "admin";
  const focusedItemId = item?.trim() || null;
  const business = isAdminPreview
    ? await getAdminBusinessPreview(slug)
    : await getPublicBusiness(slug);

  if (!business) {
    notFound();
  }

  const whatsappMessage = encodeURIComponent(
    `Olá! Encontrei a ${business.name} no O Calçadão e gostaria de mais informações.`,
  );
  const whatsappHref = business.whatsapp
    ? `https://wa.me/${business.whatsapp}?text=${whatsappMessage}`
    : null;
  const directionsHref = business.directionsUrl ?? null;
  const appleMapsHref = business.appleMapsUrl ?? null;
  const wazeHref = business.wazeUrl ?? null;

  return (
    <>
      <SiteHeader />
      {isAdminPreview && (
        <div className="border-b border-accent-dark/20 bg-accent/25 px-4 py-3 text-ink">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black">Pré-visualização administrativa</p>
              <p className="text-xs font-semibold text-muted">
                Esta é a aparência da loja para o público após a aprovação.
              </p>
            </div>
            <Link
              href="/painel/admin"
              className="inline-flex min-h-10 items-center rounded-xl border border-ink/15 bg-white px-4 text-sm font-black text-ink transition hover:border-ink/30"
            >
              Voltar para moderação
            </Link>
          </div>
        </div>
      )}
      <HighlightTracker
        campaignId={isAdminPreview ? null : (business.highlightCampaignId ?? null)}
      >
        <main className="min-h-[70vh] bg-canvas">
          <section
            className={`relative overflow-hidden bg-gradient-to-br ${business.palette}`}
          >
            {business.coverUrl && (
              <Image
                src={business.coverUrl}
                alt={`Capa da ${business.name}`}
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
            )}
            {business.coverUrl && <div className="absolute inset-0 bg-ink/55" />}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(255,255,255,0.24),transparent_30%)]" />
            <div className="relative mx-auto max-w-7xl px-4 py-12 text-white sm:px-6 sm:py-16 lg:px-8">
              <Link
                href={isAdminPreview ? "/painel/admin" : "/buscar"}
                className="inline-flex items-center gap-2 rounded-lg text-sm font-bold text-white/80 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white"
              >
                <span aria-hidden="true">←</span>
                {isAdminPreview ? "Voltar para moderação" : "Voltar ao Centro Comercial"}
              </Link>

              <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-start gap-4 sm:items-center">
                  <span className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-3xl border border-white/35 bg-white/20 text-2xl font-black shadow-xl backdrop-blur-sm sm:size-24">
                    {business.logoUrl ? (
                      <Image
                        src={business.logoUrl}
                        alt={`Logo da ${business.name}`}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    ) : (
                      business.initials
                    )}
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
                  {business.alwaysOpen
                    ? "Aberto 24 horas"
                    : business.hoursAvailable === false
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
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Escolha um item e fale direto com o comércio pelo WhatsApp.
                  </p>
                </div>
                {business.products.length > 0 ? (
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {business.products.map((product) => {
                      const price = catalogPricePresentation(
                        product.priceMode,
                        product.price,
                        product.promotionalPrice,
                      );
                      const itemWhatsappHref = catalogWhatsappHref(
                        business.whatsapp,
                        business.name,
                        product,
                      );
                      const conversionLabel = catalogConversionLabel(product);
                      const isFocused = product.id === focusedItemId;

                      return (
                        <article
                          id={`item-${product.id}`}
                          key={product.id}
                          className={`scroll-mt-24 flex min-h-48 flex-col overflow-hidden rounded-2xl border bg-canvas transition ${
                            isFocused
                              ? "border-brand ring-2 ring-brand/20 shadow-md"
                              : product.isFeatured
                                ? "border-accent-dark/35 ring-1 ring-accent-dark/10"
                                : "border-line"
                          }`}
                        >
                          {product.imageUrl ? (
                            <div className="relative aspect-[16/8] w-full overflow-hidden bg-surface">
                              <Image
                                src={product.imageUrl}
                                alt={product.name}
                                fill
                                sizes="(max-width: 768px) 90vw, 40vw"
                                className="object-cover"
                              />
                            </div>
                          ) : null}
                          <div className="flex flex-1 flex-col p-5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-black uppercase tracking-wider text-muted">
                                {product.kind === "service" ? "Serviço" : "Produto"}
                              </span>
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                {isFocused ? (
                                  <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[0.65rem] font-black text-brand-dark">
                                    ITEM SELECIONADO
                                  </span>
                                ) : null}
                                {product.isFeatured ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/30 px-2.5 py-1 text-[0.65rem] font-black text-ink">
                                    <StarIcon className="size-3" /> Destaque da loja
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <h3 className="mt-3 text-lg font-black text-ink">
                              {product.name}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-muted">
                              {product.description}
                            </p>

                            <div className="mt-auto pt-5">
                              {price.original ? (
                                <span className="block text-xs font-bold text-muted line-through">
                                  {price.original}
                                </span>
                              ) : null}
                              <span className="text-xl font-black text-ink">
                                {price.primary}
                              </span>

                              {itemWhatsappHref ? (
                                <a
                                  href={itemWhatsappHref}
                                  data-highlight-event="whatsapp"
                                  data-catalog-item-id={product.id}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1f9d61] px-4 text-sm font-black text-white transition hover:bg-[#17834f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f9d61] focus-visible:ring-offset-2"
                                >
                                  <WhatsAppIcon className="size-5 shrink-0" />
                                  {conversionLabel}
                                </a>
                              ) : (
                                <span className="mt-4 inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#dce8e2] px-4 text-sm font-black text-[#4d6b5d]">
                                  <WhatsAppIcon className="size-5 shrink-0" />
                                  Contato indisponível
                                </span>
                              )}
                              {itemWhatsappHref ? (
                                <p className="mt-2 text-center text-[0.7rem] font-bold leading-5 text-muted">
                                  A mensagem já vai com o nome deste item para agilizar o atendimento.
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      );
                    })}
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

              <div className={`mt-5 grid gap-3 ${directionsHref ? "grid-cols-2" : "grid-cols-1"}`}>
                {whatsappHref ? (
                  <a
                    href={whatsappHref}
                    data-highlight-event="whatsapp"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Chamar no WhatsApp"
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1f9d61] px-3 text-sm font-black text-white transition hover:bg-[#17834f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f9d61] focus-visible:ring-offset-2"
                  >
                    <WhatsAppIcon className="size-5 shrink-0" />
                    WhatsApp
                  </a>
                ) : (
                  <span
                    className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#dce8e2] px-3 text-center text-xs font-black text-[#4d6b5d]"
                    aria-disabled="true"
                    title="O contato será ativado quando os dados reais forem cadastrados"
                  >
                    <WhatsAppIcon className="size-5 shrink-0" />
                    Contato indisponível
                  </span>
                )}

                {directionsHref && appleMapsHref && wazeHref && (
                  <details className="group relative">
                    <summary className="inline-flex min-h-12 w-full cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-brand/25 bg-brand/8 px-3 text-sm font-black text-brand-dark transition hover:border-brand/45 hover:bg-brand/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                      <LocateIcon className="size-5 shrink-0" />
                      Como chegar
                    </summary>
                    <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-56 overflow-hidden rounded-2xl border border-line bg-white p-2 shadow-xl">
                      <a
                        href={appleMapsHref}
                        data-highlight-event="directions"
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-11 items-center rounded-xl px-3 text-sm font-black text-ink transition hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        Mapas da Apple
                      </a>
                      <a
                        href={wazeHref}
                        data-highlight-event="directions"
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-11 items-center rounded-xl px-3 text-sm font-black text-ink transition hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        Waze
                      </a>
                      <a
                        href={directionsHref}
                        data-highlight-event="directions"
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-11 items-center rounded-xl px-3 text-sm font-black text-ink transition hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        Google Maps
                      </a>
                    </div>
                  </details>
                )}
              </div>

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
                      {business.alwaysOpen
                        ? "Aberto 24 horas, todos os dias"
                        : business.hoursAvailable === false
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
      </HighlightTracker>
      <SiteFooter />
    </>
  );
}
