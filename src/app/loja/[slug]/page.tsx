import type { Metadata } from "next";
import type { Business } from "@/types/catalog";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ClockIcon,
  FacebookIcon,
  GlobeIcon,
  InstagramIcon,
  LocateIcon,
  MapPinIcon,
  PhoneIcon,
  ShieldCheckIcon,
  StarIcon,
  WhatsAppIcon,
} from "@/components/icons";
import { HighlightTracker } from "@/components/highlight-tracker";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StorefrontShareButton } from "@/components/storefront-share-button";
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

function seoField(value: string | null | undefined) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text && !/^(não informado|nao informado|outros?|n\/a|sem bairro|sem endere[cç]o|sem informação|sem informacao)$/i.test(text) ? text : null;
}

function seoAddressField(value: string | null | undefined) {
  const address = seoField(value);
  // O campo de endereço pode conter marcador de ausência seguido de "S/N".
  if (!address || /^(sem endere[cç]o|não informado|nao informado|n\/a)(?:\s*,|$)/i.test(address)) return null;
  return address;
}

function originalDescription(b: Business) {
  return seoField(b.description) &&
    b.description !== "Conheça a " + b.name + " no O Calçadão." &&
    b.description !== "Consulte as informações de " + b.name + ".";
}

function seoIntro(b: Business) {
  const city = seoField(b.cityName);
  const state = seoField(b.stateCode);
  const category = seoField(b.categoryName);
  const neighborhood = seoField(b.neighborhood);
  const address = seoAddressField(b.address);
  const intro = [seoTitle(b) + "."];
  if (category) intro.push(category + (neighborhood ? " no bairro " + neighborhood : "") + ".");
  else if (neighborhood) intro.push("Localizado no bairro " + neighborhood + ".");
  if (address) intro.push("Endereço: " + address + ".");
  intro.push("Consulte os dados e canais de contato disponíveis no O Calçadão.");
  return intro.join(" ");
}

function seoTitle(b: Business) {
  const city = seoField(b.cityName);
  if (!city) return b.name;
  const state = seoField(b.stateCode);
  const lower = b.name.toLocaleLowerCase("pt-BR").trim();
  const cityLower = city.toLocaleLowerCase("pt-BR");
  const alreadyHasCity = lower === cityLower || lower.endsWith(" - " + cityLower) || lower.endsWith(", " + cityLower);
  return b.name + (alreadyHasCity ? "" : " em " + city) + (state ? ", " + state : "");
}

function seoDescription(b: Business) {
  const text = seoIntro(b) + (originalDescription(b) ? " " + b.description : "");
  return text.length > 200 ? text.slice(0, 200).replace(/\s+\S*$/, "").trimEnd() + "…" : text;
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length === 12) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.startsWith("55") && digits.length === 13) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  return phone;
}

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
    return { title: "Local não encontrado", robots: { index: false } };
  }

  const pageTitle = seoTitle(business);
  const description = seoDescription(business);
  const canonical = `/loja/${encodeURIComponent(business.slug)}`;
  const socialImage = `/api/cartao-loja/${encodeURIComponent(business.slug)}`;

  return {
    title: pageTitle,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: "O Calçadão",
      title: `${pageTitle} | O Calçadão`,
      description,
      url: canonical,
      images: [{
        url: socialImage,
        width: 1080,
        height: 1080,
        alt: `${business.name} no O Calçadão`,
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${pageTitle} | O Calçadão`,
      description,
      images: [socialImage],
    },
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

  const isPublicPlace = business.listingType === "public_place";
  const summary = seoIntro(business);
  const neighborhood = seoField(business.neighborhood);
  const safeAddress = seoAddressField(business.address);
  const formattedAddress = [safeAddress, neighborhood, business.cityName, business.stateCode].filter(Boolean).join(", ");
  const canonicalUrl = `https://ocalcadao.com.br/loja/${encodeURIComponent(business.slug)}`;
  // Usar apenas dados que aparecem publicamente na vitrine; sem geo/avaliações incertos.
  const localBusinessData = !isAdminPreview && !isPublicPlace && safeAddress && business.cityName && business.stateCode
    ? {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "@id": `${canonicalUrl}#business`,
        name: business.name,
        url: canonicalUrl,
        description: summary,
        address: {
          "@type": "PostalAddress",
          streetAddress: safeAddress,
          addressLocality: business.cityName,
          addressRegion: business.stateCode,
          addressCountry: "BR",
        },
        ...(business.phone ? { telephone: business.phone } : {}),
        ...(business.logoUrl ? { image: business.logoUrl } : {}),
      }
    : null;

  const whatsappMessage = encodeURIComponent(
    `Olá! Encontrei ${business.name} no O Calçadão e gostaria de mais informações.`,
  );
  const whatsappHref = business.whatsapp
    ? `https://wa.me/${business.whatsapp}?text=${whatsappMessage}`
    : null;
  const directionsHref = business.directionsUrl ?? null;
  const appleMapsHref = business.appleMapsUrl ?? null;
  const wazeHref = business.wazeUrl ?? null;
  const optionalContacts = [
    business.officialSourceUrl
      ? {
          href: business.officialSourceUrl,
          label: "Fonte oficial",
          ariaLabel: `Consultar a fonte oficial de ${business.name}`,
          icon: ShieldCheckIcon,
          external: true,
        }
      : null,
    business.websiteUrl
      ? {
          href: business.websiteUrl,
          label: "Site",
          ariaLabel: undefined,
          icon: GlobeIcon,
          external: true,
        }
      : null,
    business.instagramUrl
      ? {
          href: business.instagramUrl,
          label: "Instagram",
          ariaLabel: undefined,
          icon: InstagramIcon,
          external: true,
        }
      : null,
    business.facebookUrl
      ? {
          href: business.facebookUrl,
          label: "Facebook",
          ariaLabel: undefined,
          icon: FacebookIcon,
          external: true,
        }
      : null,
    business.phone
      ? {
          href: `tel:${business.phone}`,
          label: "Telefone",
          ariaLabel: `Ligar para ${formatPhone(business.phone)}`,
          icon: PhoneIcon,
          external: false,
        }
      : null,
  ].filter((contact) => contact !== null);

  return (
    <>
      <SiteHeader />
      {localBusinessData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(localBusinessData).replace(/</g, "\\u003c"),
          }}
        />
      )}
      {isAdminPreview && (
        <div className="border-b border-accent-dark/20 bg-accent/25 px-4 py-3 text-ink">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black">Pré-visualização administrativa</p>
              <p className="text-xs font-semibold text-muted">
                Esta é a aparência do cadastro para o público.
              </p>
            </div>
            <Link
              href="/admin"
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
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={isAdminPreview ? "/admin" : "/buscar"}
                  className="inline-flex min-w-0 items-center gap-2 rounded-lg text-sm font-bold text-white/80 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white"
                >
                  <span aria-hidden="true">←</span>
                  <span className="truncate">
                    {isAdminPreview ? "Voltar para moderação" : "Voltar ao Centro Comercial"}
                  </span>
                </Link>
                {!isAdminPreview && (
                  <StorefrontShareButton
                    businessName={business.name}
                    slug={business.slug}
                  />
                )}
              </div>

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
                          <span className="sr-only">
                            {isPublicPlace ? "Informações conferidas em fonte oficial" : "Comércio verificado"}
                          </span>
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
                        <span>{isPublicPlace ? "Local público" : "Nova no O Calçadão"}</span>
                      )}
                      <span>{neighborhood ?? [business.cityName, business.stateCode].filter(Boolean).join(" - ")}</span>
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
                  {isPublicPlace ? "Sobre o local" : "Sobre a loja"}
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">
                  {isPublicPlace ? business.name : `Informações de ${business.name}`}
                </h2>
                <p className="mt-4 max-w-3xl text-base leading-7 text-muted">
                  {summary}
                </p>
                {originalDescription(business) && (
                  <p className="mt-3 max-w-3xl text-base leading-7 text-muted">{business.description}</p>
                )}
                <div className="mt-5 flex flex-wrap gap-2" data-nosnippet>
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

              {!isPublicPlace && <section className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
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
              </section>}
            </div>

            <aside className="h-fit rounded-3xl border border-line bg-surface p-6 shadow-sm lg:sticky lg:top-24">
              <h2 className="text-xl font-black text-ink">
                {isPublicPlace ? "Contato e localização" : "Fale com o comércio"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {isPublicPlace
                  ? "Consulte os canais disponíveis e trace uma rota até o local."
                  : "Tire dúvidas, confirme disponibilidade ou faça seu pedido direto com a loja."}
              </p>

              <div className={`mt-5 grid gap-3 ${directionsHref && whatsappHref ? "grid-cols-2" : "grid-cols-1"}`}>
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
                ) : !isPublicPlace ? (
                  <span
                    className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#dce8e2] px-3 text-center text-xs font-black text-[#4d6b5d]"
                    aria-disabled="true"
                    title="O contato será ativado quando os dados reais forem cadastrados"
                  >
                    <WhatsAppIcon className="size-5 shrink-0" />
                    Contato indisponível
                  </span>
                ) : null}

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

              {optionalContacts.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {optionalContacts.map((contact) => {
                    const ContactIcon = contact.icon;
                    return (
                      <a
                        key={contact.label}
                        href={contact.href}
                        aria-label={contact.ariaLabel}
                        {...(contact.external
                          ? { target: "_blank", rel: "noreferrer" }
                          : {})}
                        className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-black text-ink transition hover:border-brand/35 hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                      >
                        <ContactIcon className="size-4 shrink-0 text-brand" />
                        <span className="truncate">{contact.label}</span>
                      </a>
                    );
                  })}
                </div>
              )}

              <dl className="mt-6 space-y-4 border-t border-line pt-6 text-sm">
                <div className="flex gap-3">
                  <MapPinIcon className="mt-0.5 size-5 shrink-0 text-brand" />
                  <div>
                    <dt className="font-black text-ink">Endereço</dt>
                    <dd className="mt-1 leading-6 text-muted">
                      {formattedAddress}
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
              {!isAdminPreview && (
                <Link href={`/loja/${business.slug}/denunciar`} className="mt-5 inline-block text-xs font-bold text-muted underline underline-offset-4 hover:text-brand-dark">
                  {isPublicPlace ? "Sinalizar informação incorreta" : "Denunciar informações desta loja"}
                </Link>
              )}
            </aside>
          </div>
        </main>
      </HighlightTracker>
      <SiteFooter />
    </>
  );
}
