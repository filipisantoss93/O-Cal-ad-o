import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { EventCard } from "@/components/event-card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CitySelector } from "@/components/city-selector";
import { eventCategories, type EventRecord } from "@/lib/events";
import { selectedCityCookieName } from "@/lib/location";
import { createPublicClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Eventos na sua cidade",
  description: "Encontre shows, feiras, festivais, eventos gratuitos e experiências perto de você.",
  alternates: { canonical: "/eventos" },
};
type Props = { searchParams: Promise<{ categoria?: string; quando?: string }> };

export default async function EventsFeed({ searchParams }: Props) {
  const params = await searchParams;
  const selectedId = Number((await cookies()).get(selectedCityCookieName)?.value);
  const selectedCityId = Number.isSafeInteger(selectedId) && selectedId > 0 ? selectedId : null;
  const supabase = createPublicClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const selectedCategory = params.categoria && Object.hasOwn(eventCategories, params.categoria)
    ? params.categoria : "";
  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  // Sem cidade selecionada, nunca consultar o catálogo nacional de eventos.
  const highlightResult = selectedCityId
    ? await supabase.from("event_highlights").select("event_id")
        .eq("city_id", selectedCityId).eq("status", "active")
        .lte("starts_at", nowIso).gt("ends_at", nowIso).limit(200)
    : null;
  const highlightIds = new Set<number>(
    (highlightResult?.data ?? []).map(row => row.event_id),
  );

  let regularQuery = supabase.from("events").select("*")
    .eq("city_id", selectedCityId ?? -1)
    .gte("ends_at", nowIso).eq("is_active", true)
    .order("starts_at", { ascending: true }).limit(120);
  if (selectedCategory) regularQuery = regularQuery.eq("category", selectedCategory);
  if (params.quando === "semana") regularQuery = regularQuery.lte("starts_at", endOfWeek.toISOString());
  const regularResult = selectedCityId ? await regularQuery : null;

  // Buscar patrocinados separadamente impede que o limite de eventos orgânicos
  // esconda um destaque com data mais distante.
  let paidResult = null;
  if (selectedCityId && highlightIds.size > 0) {
    let paidQuery = supabase.from("events").select("*")
      .in("id", [...highlightIds]).eq("city_id", selectedCityId)
      .gte("ends_at", nowIso).eq("is_active", true);
    if (selectedCategory) paidQuery = paidQuery.eq("category", selectedCategory);
    if (params.quando === "semana") paidQuery = paidQuery.lte("starts_at", endOfWeek.toISOString());
    paidResult = await paidQuery;
  }
  const byId = new Map<number, EventRecord>();
  for (const event of [...(regularResult?.data ?? []), ...(paidResult?.data ?? [])]) {
    byId.set(event.id, event as EventRecord);
  }
  const events = [...byId.values()].sort((a, b) =>
    Number(highlightIds.has(b.id)) - Number(highlightIds.has(a.id))
    || new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    || a.id - b.id
  ).slice(0, 60);
  const error = highlightResult?.error ?? regularResult?.error ?? paidResult?.error ?? null;
  const businessIds = [...new Set(events.map(event => event.business_id))];
  const cityIds = [...new Set(events.map(event => event.city_id))];
  const [businessesResult, citiesResult, selectedCityResult] = await Promise.all([
    businessIds.length
      ? supabase.from("businesses").select("id,name,slug").in("id", businessIds)
      : Promise.resolve({ data: [] as Array<{ id: number; name: string; slug: string }> }),
    cityIds.length
      ? supabase.from("cities").select("id,name,state_code").in("id", cityIds)
      : Promise.resolve({ data: [] as Array<{ id: number; name: string; state_code: string }> }),
    selectedCityId
      ? supabase.from("cities").select("name,state_code").eq("id", selectedCityId).maybeSingle()
      : Promise.resolve({ data: null as { name: string; state_code: string } | null }),
  ]);
  const organizerById = new Map((businessesResult.data ?? []).map(b => [b.id, b]));
  const cityById = new Map((citiesResult.data ?? []).map(c => [c.id, c]));
  const visibleEvents = events.filter(event => organizerById.has(event.business_id));
  const cityName = selectedCityResult.data
    ? selectedCityResult.data.name + " – " + selectedCityResult.data.state_code : "Selecione uma cidade";

  return (<>
    <SiteHeader />
    <main className="mx-auto min-h-[65vh] max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-brand-dark">Acontece por aqui</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">Eventos</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Shows, feiras e experiências perto de você. <strong>{cityName}</strong>
          </p>
        </div>
        <Link href="/painel/eventos" className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-black text-white">
          Divulgar evento
        </Link>
      </div>
      <section className="mt-6 rounded-2xl border border-line bg-surface p-3 sm:p-4" aria-label="Filtros de eventos">
        <div className="mb-4"><CitySelector variant="hero" /></div>
        <form method="get" action="/eventos" className="flex flex-wrap items-end gap-3">
          <label className="min-w-[9rem] flex-1 text-xs font-bold text-ink">Categoria
            <select name="categoria" defaultValue={selectedCategory}
              className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink">
              <option value="">Todas</option>
              {Object.entries(eventCategories).map(([key,value]) => <option key={key} value={key}>{value}</option>)}
            </select>
          </label>
          <label className="min-w-[9rem] flex-1 text-xs font-bold text-ink">Quando
            <select name="quando" defaultValue={params.quando === "semana" ? "semana" : "todos"}
              className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink">
              <option value="todos">Próximos eventos</option>
              <option value="semana">Próximos 7 dias</option>
            </select>
          </label>
          <button type="submit" className="min-h-11 rounded-xl bg-ink px-5 text-sm font-black text-white">Filtrar</button>
        </form>
      </section>
      {!selectedCityId ? <section className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center">
        <h2 className="text-xl font-black text-ink">Escolha sua cidade para ver os eventos</h2>
        <p className="mt-2 text-sm text-muted">Os eventos são exibidos apenas na cidade selecionada. Use o seletor acima para começar.</p>
      </section>
      : error ? <p className="mt-8 rounded-xl border border-line p-5 text-sm text-muted">
        Não foi possível carregar os eventos agora.</p>
      : visibleEvents.length === 0 ? <section className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center">
          <h2 className="text-xl font-black text-ink">Ainda não há eventos para este filtro</h2>
          <p className="mt-2 text-sm text-muted">Escolha outra cidade, categoria ou período.</p>
          <Link href="/eventos" className="mt-4 inline-block text-sm font-black text-brand-dark underline">Limpar filtros</Link>
        </section>
      : <section className="mt-7">
          <p className="mb-3 text-xs font-bold text-muted">Próximos acontecimentos · {visibleEvents.length} exibidos</p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {visibleEvents.map(event => {
              const business = organizerById.get(event.business_id)!;
              const city = cityById.get(event.city_id);
              const imageUrl = supabase.storage.from("business-media").getPublicUrl(event.banner_path).data.publicUrl;
              return <EventCard key={event.id} event={event} imageUrl={imageUrl}
                organizer={business.name} location={city ? city.name + " – " + city.state_code : ""}
                sponsored={highlightIds.has(event.id)} />;
            })}
          </div>
        </section>}
    </main>
    <SiteFooter />
  </>);
}
