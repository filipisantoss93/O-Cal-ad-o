import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { deleteEventAction, saveEventAction, toggleEventAction, requestEventHighlightAction } from "./actions";
import { eventCategories, eventDate, eventInputDate, eventPrice, type EventRecord } from "@/lib/events";
import { getMerchantWorkspace, type MerchantBusiness } from "@/lib/merchant/dal";
import { publicMediaUrl } from "@/lib/merchant/media";

export const metadata: Metadata = { title: "Meus eventos" };
type Params = { searchParams: Promise<{ loja?: string; erro?: string; sucesso?: string }> };
const inputClass = "mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand";
function EventForm({ business, event, address }: { business: MerchantBusiness; event?: EventRecord; address: string }) {
  const offset = event?.utc_offset ?? "-03:00";
  return (
    <form action={saveEventAction} encType="multipart/form-data" className="mt-5 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="business_id" value={business.id} />
      <input type="hidden" name="event_id" value={event?.id ?? ""} />
      <label className="text-sm font-bold text-ink sm:col-span-2">Nome do evento *
        <input name="title" required minLength={3} maxLength={160} defaultValue={event?.title ?? ""} className={inputClass} placeholder="Ex.: Festival de Música e Gastronomia" />
      </label>
      <label className="text-sm font-bold text-ink sm:col-span-2">Banner do evento {event ? "(opcional na edição)" : "*"}
        <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/avif" required={!event}
          className="mt-2 block w-full min-w-0 text-xs text-muted file:mr-3 file:rounded-xl file:border-0 file:bg-brand file:px-3 file:py-2 file:font-black file:text-white" />
        <span className="mt-1 block text-xs font-normal text-muted">Imagem horizontal 16:9 recomendada; compressão automática antes do envio.</span>
      </label>
      <label className="text-sm font-bold text-ink sm:col-span-2">Descrição e programação
        <textarea name="description" rows={4} maxLength={2500} defaultValue={event?.description ?? ""}
          className={inputClass} placeholder="Detalhes, atrações, regras de entrada..." />
      </label>
      <label className="text-sm font-bold text-ink">Categoria *
        <select name="category" defaultValue={event?.category ?? "outros"} className={inputClass}>
          {Object.entries(eventCategories).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </label>
      <label className="text-sm font-bold text-ink">Fuso horário do evento *
        <select name="utc_offset" defaultValue={offset} className={inputClass}>
          <option value="-02:00">UTC−2 · Fernando de Noronha</option>
          <option value="-03:00">UTC−3 · Brasília</option>
          <option value="-04:00">UTC−4 · Amazonas / MT / MS</option>
          <option value="-05:00">UTC−5 · Acre</option>
        </select>
      </label>
      <label className="text-sm font-bold text-ink">Início *
        <input name="starts_at" type="datetime-local" required defaultValue={event ? eventInputDate(event.starts_at, offset) : ""}
          className={inputClass} />
      </label>
      <label className="text-sm font-bold text-ink">Término *
        <input name="ends_at" type="datetime-local" required defaultValue={event?.ends_at ? eventInputDate(event.ends_at, offset) : ""}
          className={inputClass} />
      </label>
      <label className="text-sm font-bold text-ink">Nome do local *
        <input name="venue_name" required minLength={2} maxLength={160} defaultValue={event?.venue_name ?? business.name}
          className={inputClass} />
      </label>
      <label className="text-sm font-bold text-ink">Endereço completo do evento *
        <input name="venue_address" required minLength={5} maxLength={300} defaultValue={event?.venue_address ?? address}
          className={inputClass} />
        <span className="mt-1 block text-xs font-normal text-muted">Nesta versão, o evento deve acontecer na mesma cidade da vitrine organizadora.</span>
      </label>
      <label className="text-sm font-bold text-ink">Tipo de entrada *
        <select name="free_entry" defaultValue={event?.free_entry === false ? "false" : "true"} className={inputClass}>
          <option value="true">Entrada franca</option>
          <option value="false">Ingresso pago</option>
        </select>
      </label>
      <label className="text-sm font-bold text-ink">Ingresso (R$) — apenas se pago
        <input name="ticket_price" type="number" min="0.01" max="1000000" step="0.01"
          defaultValue={event?.ticket_price_cents != null ? (event.ticket_price_cents / 100).toFixed(2) : ""}
          className={inputClass} placeholder="Ex.: 25,00" />
      </label>
      <label className="text-sm font-bold text-ink sm:col-span-2">Link para comprar ingresso (opcional)
        <input name="ticket_url" type="url" maxLength={500} defaultValue={event?.ticket_url ?? ""}
          className={inputClass} placeholder="https://..." />
        <span className="mt-1 block text-xs font-normal text-muted">A venda acontece fora do Calçadão, no site informado pelo organizador.</span>
      </label>
      <button type="submit" className="min-h-12 rounded-xl bg-brand px-5 text-sm font-black text-white sm:col-span-2">
        {event ? "Salvar alterações" : "Publicar evento"}
      </button>
    </form>
  );
}
export default async function MerchantEvents({ searchParams }: Params) {
  const params = await searchParams;
  const { supabase, businesses } = await getMerchantWorkspace("/painel/eventos");
  const requestedId = Number(params.loja);
  const business = businesses.find(b => Number.isSafeInteger(requestedId) && b.id === requestedId) ?? businesses[0];
  if (!business) return <div><h1 className="text-3xl font-black text-ink">Meus eventos</h1>
    <p className="mt-3 text-muted">Cadastre sua loja para começar a publicar eventos.</p>
    <Link href="/painel/loja" className="mt-4 inline-block rounded-xl bg-brand px-4 py-3 font-black text-white">Cadastrar loja</Link></div>;
  const [eventsResult, cityResult] = await Promise.all([
    supabase.from("events").select("*").eq("business_id", business.id).order("starts_at", { ascending: false }).limit(100),
    supabase.from("cities").select("name,state_code").eq("id", business.city_id).maybeSingle(),
  ]);
  const events = (eventsResult.data ?? []) as EventRecord[];
  const highlightResult = events.length
    ? await supabase.from("event_highlights")
        .select("event_id,status,ends_at").in("event_id", events.map(event => event.id))
        .in("status", ["pending", "active"])
        .order("created_at", { ascending: false }).limit(100)
    : null;
  const highlightByEvent = new Map((highlightResult?.data ?? [])
    .map(highlight => [highlight.event_id, highlight]));

  const address = [business.street, business.address_number, business.neighborhood,
    cityResult.data?.name, cityResult.data?.state_code].filter(Boolean).join(", ");
  const ready = business.is_active && !business.billing_suspended;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-widest text-brand-dark">Divulgação local</p>
          <h1 className="mt-2 text-3xl font-black text-ink">Meus eventos</h1>
          <p className="mt-2 text-sm text-muted">Publique e compartilhe eventos da sua cidade.</p></div>
        <Link href="/eventos" className="rounded-xl border border-line px-4 py-2 text-sm font-black text-ink">Ver feed público →</Link>
      </div>
      {params.erro && <p role="alert" className="mt-5 rounded-xl bg-brand/10 p-4 text-sm font-bold text-brand-dark">{params.erro.slice(0, 180)}</p>}
      {params.sucesso && <p role="status" className="mt-5 rounded-xl bg-positive-soft p-4 text-sm font-bold text-positive">
        {params.sucesso === "excluido" ? "Evento excluído." : params.sucesso === "destaque_solicitado" ? "Solicitação registrada. O destaque só começa após confirmação do pagamento pela administração." : "Evento salvo com sucesso."}</p>}
      <div className="mt-6 flex gap-2 overflow-x-auto">
        {businesses.map(item => <Link key={item.id} href={"/painel/eventos?loja=" + item.id}
          className={"min-w-40 rounded-xl border px-4 py-3 text-sm font-black " +
            (item.id === business.id ? "border-brand bg-brand/10 text-ink" : "border-line bg-surface text-muted")}>
          {item.name}</Link>)}
      </div>
      {!ready && <p className="mt-5 rounded-xl border border-brand/20 bg-brand/10 p-4 text-sm font-bold text-brand-dark">
        A vitrine está suspensa; regularize-a para criar ou editar eventos.</p>}
      {business.publication_status !== "published" && <p className="mt-4 rounded-xl bg-accent/20 p-4 text-sm font-bold text-ink">
        Os eventos só ficam visíveis publicamente quando a vitrine estiver publicada.</p>}
      {ready && <section className="mt-6 rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <h2 className="text-xl font-black text-ink">Criar evento</h2>
        <EventForm business={business} address={address} />
      </section>}
      <section className="mt-8">
        <h2 className="text-xl font-black text-ink">Eventos cadastrados ({events.length})</h2>
        <p className="mt-2 text-xs text-muted">O destaque pago dá prioridade apenas no feed da cidade do evento.
          A solicitação não gera cobrança nem ativa o destaque automaticamente; a contratação e a confirmação do pagamento dependem da administração.</p>
        {eventsResult.error && <p className="mt-4 text-sm text-brand-dark">Não foi possível carregar os eventos.</p>}
        {events.length === 0 && !eventsResult.error && <p className="mt-4 rounded-xl bg-surface p-5 text-sm text-muted">Nenhum evento cadastrado nesta loja.</p>}
        <div className="mt-4 grid gap-4">
          {events.map(event => <article key={event.id} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex flex-wrap gap-4">
              <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-canvas sm:w-40">
                {publicMediaUrl(supabase,event.banner_path) && <Image src={publicMediaUrl(supabase,event.banner_path)!} alt={event.title}
                  fill sizes="160px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1"><h3 className="font-black text-ink">{event.title}</h3>
                <p className="mt-1 text-xs font-bold text-muted">{eventDate(event.starts_at,event.utc_offset)} · {eventPrice(event.free_entry,event.ticket_price_cents)}</p>
                <p className="mt-1 text-xs text-muted">{event.is_active ? "Publicado" : "Pausado"} · {event.venue_name}</p>
                {highlightByEvent.get(event.id)?.status === "pending" &&
                  <p className="mt-2 text-xs font-bold text-muted">Destaque solicitado · aguardando contratação e pagamento</p>}
                {highlightByEvent.get(event.id)?.status === "active" &&
                  <p className="mt-2 text-xs font-bold text-brand-dark">Destaque pago · ativo até {highlightByEvent.get(event.id)?.ends_at
                    ? eventDate(highlightByEvent.get(event.id)!.ends_at!, event.utc_offset)
                    : "a data contratada"}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={"/eventos/" + event.id} className="rounded-lg border border-line px-3 py-2 text-xs font-black">Abrir link público</Link>
                  {!highlightByEvent.has(event.id) && event.is_active &&
                    Date.parse(event.ends_at ?? event.starts_at) > Date.now() && ready &&
                    <form action={requestEventHighlightAction}>
                      <input type="hidden" name="business_id" value={business.id} />
                      <input type="hidden" name="event_id" value={event.id} />
                      <button type="submit" className="rounded-lg border border-accent-dark/30 bg-accent/20 px-3 py-2 text-xs font-black text-ink">Solicitar destaque pago</button>
                    </form>}
                  <form action={toggleEventAction}><input type="hidden" name="business_id" value={business.id} />
                    <input type="hidden" name="event_id" value={event.id} />
                    <input type="hidden" name="next_active" value={String(!event.is_active)} />
                    <button className="rounded-lg border border-line px-3 py-2 text-xs font-black" type="submit">{event.is_active ? "Pausar" : "Reativar"}</button>
                  </form>
                  <form action={deleteEventAction}><input type="hidden" name="business_id" value={business.id} />
                    <input type="hidden" name="event_id" value={event.id} />
                    <button className="rounded-lg border border-brand/30 px-3 py-2 text-xs font-black text-brand-dark" type="submit">Excluir</button>
                  </form>
                </div>
              </div>
            </div>
            {ready && <details className="mt-4 border-t border-line pt-4"><summary className="cursor-pointer text-sm font-black text-brand-dark">Editar evento</summary>
              <EventForm business={business} event={event} address={address} />
            </details>}
          </article>)}
        </div>
      </section>
    </div>
  );
}
