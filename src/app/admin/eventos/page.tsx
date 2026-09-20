import type { Metadata } from "next";
import Link from "next/link";
import { activateEventHighlightAction, cancelEventHighlightRequestAction } from "./actions";
import { requireAdmin } from "@/lib/admin/dal";
import { eventDate } from "@/lib/events";

export const metadata: Metadata = { title: "Destaques de eventos" };
type Params = { searchParams: Promise<{ sucesso?: string; erro?: string }> };

export default async function AdminEvents({ searchParams }: Params) {
  const params = await searchParams;
  const { supabase } = await requireAdmin("/admin/eventos");
  const { data, error } = await supabase.from("event_highlights")
    .select("id,event_id,status,starts_at,ends_at")
    .in("status", ["pending", "active"]).order("created_at", { ascending: true }).limit(100);
  if (error) throw new Error("Não foi possível carregar as solicitações de eventos.");
  const requests = data ?? [];
  const ids = [...new Set(requests.map(row => row.event_id))];
  const eventsResult = ids.length
    ? await supabase.from("events").select("id,business_id,title,city_id,starts_at,ends_at,utc_offset")
        .in("id", ids)
    : null;
  const events = eventsResult?.data ?? [];
  const cityIds = [...new Set(events.map(row => row.city_id))];
  const cityResult = cityIds.length
    ? await supabase.from("cities").select("id,name,state_code").in("id", cityIds) : null;
  const eventById = new Map(events.map(event => [event.id, event]));
  const cityById = new Map((cityResult?.data ?? []).map(city => [city.id, city]));
  const pending = requests.filter(request => request.status === "pending");
  const active = requests.filter(request => request.status === "active" && request.ends_at
    && Date.parse(request.ends_at) > new Date().getTime());
  const field = "mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink";

  return <div>
    <p className="text-xs font-black uppercase tracking-widest text-brand-dark">Administração · Eventos</p>
    <h1 className="mt-2 text-3xl font-black text-ink">Destaques pagos de eventos</h1>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">As solicitações não geram cobrança automaticamente.
      Confirme o pagamento no provedor, verifique o valor recebido e informe sua referência real antes de ativar um destaque.
      O evento sobe somente no feed da cidade à qual pertence.</p>
    {params.sucesso && <p role="status" className="mt-5 rounded-xl bg-positive-soft p-3 text-sm font-bold text-positive">
      {params.sucesso === "cancelado" ? "Solicitação cancelada." : "Destaque ativado após registro da confirmação financeira."}
    </p>}
    {params.erro && <p role="alert" className="mt-5 rounded-xl bg-brand/10 p-3 text-sm font-bold text-brand-dark">{params.erro.slice(0,180)}</p>}
    <section className="mt-7">
      <h2 className="text-xl font-black text-ink">Solicitações pendentes ({pending.length})</h2>
      {!pending.length && <p className="mt-4 rounded-2xl border border-line bg-surface p-5 text-sm text-muted">Não há solicitações pendentes.</p>}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {pending.map(request => {
          const event = eventById.get(request.event_id);
          const city = event ? cityById.get(event.city_id) : null;
          if (!event) return null;
          return <article key={request.id} className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-black uppercase text-brand-dark">Solicitação #{request.id}</p>
            <h3 className="mt-2 text-lg font-black text-ink">{event.title}</h3>
            <p className="mt-1 text-xs text-muted">{city ? city.name + " – " + city.state_code : "Cidade indisponível"} · {eventDate(event.starts_at,event.utc_offset)}</p>
            <Link href={"/eventos/" + event.id} className="mt-2 inline-block text-xs font-bold text-brand-dark underline">Ver evento</Link>
            <form action={activateEventHighlightAction} className="mt-4 grid gap-3 border-t border-line pt-4">
              <input type="hidden" name="highlight_id" value={request.id} />
              <label className="text-xs font-bold text-ink">Referência de pagamento verificado
                <input className={field} name="payment_reference" required minLength={4} maxLength={160}
                  placeholder="ID real da cobrança confirmada" />
              </label>
              <label className="text-xs font-bold text-ink">Valor efetivamente pago (R$)
                <input className={field} name="amount_paid_brl" type="number" min="0.01" step="0.01" required placeholder="Ex.: 9.90" />
              </label>
              <label className="text-xs font-bold text-ink">Duração máxima
                <select className={field} name="duration_days" defaultValue="7">
                  <option value="7">7 dias</option><option value="15">15 dias</option><option value="30">30 dias</option>
                </select>
              </label>
              <p className="text-xs text-muted">O destaque termina quando a vigência contratada acabar ou quando o evento terminar, o que ocorrer primeiro.</p>
              <label className="flex items-start gap-2 text-xs font-bold text-ink">
                <input type="checkbox" name="payment_confirmed" required className="mt-0.5" />
                Conferi no provedor que o pagamento informado foi realmente aprovado.
              </label>
              <button type="submit" className="min-h-11 rounded-xl bg-brand px-4 text-sm font-black text-white">Ativar após confirmação</button>
            </form>
            <form action={cancelEventHighlightRequestAction} className="mt-3">
              <input type="hidden" name="highlight_id" value={request.id} />
              <button type="submit" className="min-h-10 w-full rounded-xl border border-line text-xs font-bold text-muted">Cancelar solicitação</button>
            </form>
          </article>;
        })}
      </div>
    </section>
    <section className="mt-8">
      <h2 className="text-xl font-black text-ink">Destaques ativos ({active.length})</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {active.map(request => {
          const event = eventById.get(request.event_id);
          if (!event) return null;
          const city = cityById.get(event.city_id);
          return <article key={request.id} className="rounded-xl border border-line bg-surface p-4">
            <p className="font-black text-ink">{event.title}</p>
            <p className="mt-1 text-xs text-muted">{city?.name ?? "Cidade indisponível"} · Até {eventDate(request.ends_at!, event.utc_offset)}</p>
          </article>;
        })}
      </div>
    </section>
  </div>;
}
