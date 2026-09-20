import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventShareButton } from "@/components/event-share-button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { eventCategoryName, eventDate, eventDirectionsUrl, eventPrice, type EventRecord } from "@/lib/events";
import { createPublicClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };
async function getEventPage(id: string) {
  const number = Number(id);
  if (!Number.isSafeInteger(number) || number <= 0) return null;
  const supabase = createPublicClient();
  const { data: event } = await supabase.from("events").select("*").eq("id", number).maybeSingle();
  if (!event) return null;
  const [businessResult, cityResult] = await Promise.all([
    supabase.from("businesses").select("name,slug,whatsapp_e164").eq("id", event.business_id).maybeSingle(),
    supabase.from("cities").select("name,state_code").eq("id", event.city_id).maybeSingle(),
  ]);
  const business = businessResult.data;
  if (!business) return null;
  const imageUrl = supabase.storage.from("business-media").getPublicUrl(event.banner_path).data.publicUrl;
  return { event: event as EventRecord, business, city: cityResult.data, imageUrl };
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const page = await getEventPage(id);
  if (!page) return { title: "Evento não encontrado", robots: { index: false, follow: false } };
  const { event, imageUrl, business } = page;
  const description = event.title + " · " + eventDate(event.starts_at, event.utc_offset) +
    " · " + event.venue_name + ". Organizado por " + business.name + ".";
  return {
    title: event.title,
    description,
    alternates: { canonical: "/eventos/" + event.id },
    openGraph: {
      type: "website", title: event.title, description,
      url: "/eventos/" + event.id,
      images: [{ url: imageUrl, alt: "Banner do evento " + event.title }],
    },
    twitter: { card: "summary_large_image", title: event.title, description, images: [imageUrl] },
  };
}
export default async function EventDetailPage({ params }: Props) {
  const { id } = await params;
  const page = await getEventPage(id);
  if (!page) notFound();
  const { event, business, city, imageUrl } = page;
  const cityLabel = city ? city.name + " – " + city.state_code : "";
  const directionsUrl = eventDirectionsUrl(event.venue_address + ", " + cityLabel);
  const whatsappUrl = business.whatsapp_e164
    ? "https://wa.me/" + business.whatsapp_e164.replace(/\D/g, "") + "?text=" +
      encodeURIComponent("Olá! Gostaria de informações sobre o evento " + event.title + " no O Calçadão.")
    : null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description || event.title,
    startDate: event.starts_at,
    endDate: event.ends_at ?? undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    image: [imageUrl],
    url: "https://ocalcadao.com.br/eventos/" + event.id,
    location: {
      "@type": "Place", name: event.venue_name,
      address: { "@type": "PostalAddress", streetAddress: event.venue_address,
        addressLocality: city?.name, addressRegion: city?.state_code, addressCountry: "BR" },
    },
    organizer: { "@type": "Organization", name: business.name,
      url: "https://ocalcadao.com.br/loja/" + business.slug },
    offers: event.free_entry
      ? { "@type": "Offer", price: "0", priceCurrency: "BRL",
          url: "https://ocalcadao.com.br/eventos/" + event.id }
      : event.ticket_price_cents != null
        ? { "@type": "Offer", price: (event.ticket_price_cents / 100).toFixed(2),
            priceCurrency: "BRL", url: event.ticket_url ?? "https://ocalcadao.com.br/eventos/" + event.id }
        : undefined,
  };
  return (<>
    <SiteHeader />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <main className="mx-auto min-h-[65vh] max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <Link href="/eventos" className="text-sm font-black text-brand-dark">← Voltar para eventos</Link>
      <article className="mt-5 overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
        <div className="relative aspect-video w-full bg-canvas">
          <Image src={imageUrl} alt={"Banner de " + event.title} fill priority
            sizes="(max-width: 1024px) 100vw, 1024px" className="object-contain" />
        </div>
        <div className="p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-black text-brand-dark">
              {eventCategoryName(event.category)}
            </span>
            <EventShareButton title={event.title} id={event.id} />
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-ink sm:text-4xl">{event.title}</h1>
          <p className="mt-3 text-lg font-black text-brand-dark">{eventPrice(event.free_entry, event.ticket_price_cents)}</p>
          <div className="mt-6 grid gap-4 rounded-2xl bg-canvas p-4 sm:grid-cols-2 sm:p-6">
            <div><h2 className="text-xs font-black uppercase tracking-wider text-muted">Quando</h2>
              <p className="mt-2 text-sm font-bold text-ink">Início: {eventDate(event.starts_at, event.utc_offset)}</p>
              {event.ends_at && <p className="mt-1 text-sm text-muted">Término: {eventDate(event.ends_at, event.utc_offset)}</p>}
              <p className="mt-1 text-xs text-muted">Horário local UTC{event.utc_offset}</p>
            </div>
            <div><h2 className="text-xs font-black uppercase tracking-wider text-muted">Onde</h2>
              <p className="mt-2 text-sm font-black text-ink">{event.venue_name}</p>
              <p className="mt-1 text-sm text-muted">{event.venue_address}{cityLabel ? ", " + cityLabel : ""}</p>
              <a href={directionsUrl} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-line px-4 text-sm font-black text-brand-dark">Como chegar ↗</a>
            </div>
          </div>
          {event.description && <section className="mt-7">
            <h2 className="text-lg font-black text-ink">Sobre o evento</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted">{event.description}</p>
          </section>}
          <section className="mt-7 border-t border-line pt-6">
            <h2 className="text-xs font-black uppercase tracking-wider text-muted">Organizado por</h2>
            <Link href={"/loja/" + business.slug} className="mt-2 inline-block text-lg font-black text-ink underline underline-offset-4">{business.name}</Link>
            <div className="mt-5 flex flex-wrap gap-3">
              {!event.free_entry && event.ticket_url && <a href={event.ticket_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center rounded-xl bg-brand px-5 text-sm font-black text-white">Comprar ingresso ↗</a>}
              {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center rounded-xl border border-line px-5 text-sm font-black text-ink">Falar com o organizador ↗</a>}
            </div>
            {event.ticket_url && <p className="mt-3 text-xs text-muted">Ingressos vendidos em site externo. Confira as condições diretamente com o organizador.</p>}
          </section>
        </div>
      </article>
    </main>
    <SiteFooter />
  </>);
}
