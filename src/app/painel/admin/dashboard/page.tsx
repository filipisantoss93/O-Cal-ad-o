import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/dal";
import { getAdminDashboard } from "@/lib/admin/dashboard";

export const metadata: Metadata = { title: "Dashboard administrativo" };
export const dynamic = "force-dynamic";

const number = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
const money = (cents: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
}).format(cents / 100);
const date = (value: string) => new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", year: "numeric",
}).format(new Date(value));
const statuses: Record<string, string> = {
  pending: "Aguardando análise", approved: "Aprovada", rejected: "Ajustes solicitados",
  suspended: "Suspensa", active: "Ativa", scheduled: "Agendada",
  paused: "Pausada", completed: "Concluída", cancelled: "Cancelada",
  expired: "Expirada", refunded: "Reembolsada",
};

function Metric({ label, value, detail, href }: {
  label: string; value: string; detail: string; href?: string;
}) {
  const content = <>
    <dt className="text-sm font-bold text-muted">{label}</dt>
    <dd className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">{value}</dd>
    <p className="mt-2 text-xs font-semibold leading-5 text-muted">{detail}</p>
  </>;
  return <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
    {href ? <Link href={href} className="block rounded-lg outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-brand">{content}</Link> : content}
  </div>;
}

export default async function AdminDashboard({ searchParams }: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo } = await searchParams;
  const days: 7 | 30 | 90 = periodo === "7" ? 7 : periodo === "90" ? 90 : 30;
  const { supabase } = await requireAdmin("/painel/admin/dashboard");
  const { metrics: m, stores, campaigns } = await getAdminDashboard(supabase, days);
  const peak = Math.max(1, ...m.monthly.flatMap((point) => [point.accounts, point.stores]));

  return <div className="space-y-8">
    <header className="rounded-[2rem] bg-ink p-6 text-white sm:p-9">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">Administração · Visão geral</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Dashboard de moderação</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">Contas, lojas, ofertas, publicidade e pendências, com dados atualizados ao abrir a página.</p>
        </div>
        <Link href="/painel/admin" className="inline-flex min-h-11 items-center rounded-xl bg-white px-5 text-sm font-black text-ink">Abrir fila de lojas</Link>
      </div>
    </header>

    <nav aria-label="Período dos indicadores" className="flex flex-wrap items-center gap-2">
      <span className="mr-2 text-sm font-bold text-muted">Novos no período:</span>
      {([7, 30, 90] as const).map((value) =>
        <Link key={value} href={`/painel/admin/dashboard?periodo=${value}`}
          aria-current={days === value ? "page" : undefined}
          className={`rounded-full border px-4 py-2 text-sm font-black ${days === value ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted"}`}>{value} dias</Link>)}
      <span className="ml-auto text-xs font-semibold text-muted">Totais e filas consideram todo o histórico.</span>
    </nav>

    <section aria-labelledby="alcance">
      <h2 id="alcance" className="text-xl font-black text-ink">Plataforma</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Contas cadastradas" value={number(m.accounts.total)} detail={`+${number(m.accounts.recent)} nos últimos ${days} dias`} />
        <Metric label="Lojas cadastradas" value={number(m.stores.total)} detail={`+${number(m.stores.recent)} nos últimos ${days} dias`} href="/painel/admin" />
        <Metric label="Lojas publicadas" value={number(m.stores.published)} detail={`${number(m.stores.approved)} aprovadas · ${number(m.stores.billing_suspended)} com cobrança suspensa`} href="/painel/admin?status=approved" />
        <Metric label="Promoções cadastradas" value={number(m.offers.total)} detail={`${number(m.offers.visible)} visíveis agora · +${number(m.offers.recent)} no período`} />
      </dl>
    </section>

    <section aria-labelledby="valores">
      <div>
        <h2 id="valores" className="text-xl font-black text-ink">Publicidade e valores</h2>
        <p className="mt-1 text-sm text-muted">Valores das campanhas de destaque e banner cobradas pela Efí. Cortesias e campanhas reembolsadas não entram nos valores confirmados.</p>
      </div>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Valor confirmado" value={money(m.ads.confirmed_cents)} detail="Campanhas pagas agendadas, ativas, pausadas ou concluídas" href="/painel/admin/destaques" />
        <Metric label={`Confirmado · ${days} dias`} value={money(m.ads.recent_confirmed_cents)} detail="Campanhas criadas no período e com cobrança confirmada" />
        <Metric label="Campanhas pagas" value={number(m.ads.paid)} detail={`${number(m.ads.active)} campanhas ativas agora · ${number(m.ads.total)} no total`} href="/painel/admin/destaques" />
        <Metric label="Aguardando pagamento" value={money(m.ads.awaiting_payment_cents)} detail={`${number(m.ads.awaiting_payment)} campanhas ainda não pagas`} href="/painel/admin/destaques?status=pending" />
      </dl>
      <p className="mt-3 text-xs leading-5 text-muted">Assinaturas Pro ativas: <strong className="text-ink">{number(m.accounts.pro)}</strong>. Valores de planos e adicionais não representam receita recebida, pois não há histórico de cada cobrança nesta base.</p>
    </section>

    <section aria-labelledby="pendencias">
      <h2 id="pendencias" className="text-xl font-black text-ink">Fila de trabalho</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { label: "Lojas para revisar", count: m.stores.pending, href: "/painel/admin?status=pending" },
          { label: "Banners para revisar", count: m.ads.banners_to_review, href: "/painel/admin/destaques" },
          { label: "Mensagens de suporte", count: m.inbox.support_open, href: "/painel/admin/notificacoes?tipo=support" },
          { label: "Denúncias de lojas", count: m.inbox.reports_open, href: "/painel/admin/notificacoes?tipo=report" },
          { label: "Notificações não lidas", count: m.inbox.unread, href: "/painel/admin/notificacoes" },
          { label: "Lojas suspensas", count: m.stores.suspended, href: "/painel/admin?status=suspended" },
        ].map((item) => <Link key={item.label} href={item.href} className="flex min-h-20 items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-5 shadow-sm hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          <span className="text-sm font-bold text-ink">{item.label}</span>
          <strong className={`rounded-xl px-3 py-1.5 text-xl ${item.count ? "bg-brand/8 text-brand-dark" : "bg-positive-soft text-positive"}`}>{number(item.count)}</strong>
        </Link>)}
      </div>
    </section>

    <section aria-labelledby="evolucao" className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-7">
      <h2 id="evolucao" className="text-xl font-black text-ink">Novos cadastros por mês</h2>
      <p className="mt-1 text-sm text-muted">Últimos seis meses, incluindo o atual.</p>
      <div className="mt-6 space-y-4">
        {m.monthly.map((point) => <div key={point.month} className="grid grid-cols-[4.5rem_1fr] items-center gap-3 sm:grid-cols-[6rem_1fr]">
          <span className="text-xs font-black capitalize text-muted">{new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${point.month}-01T12:00:00Z`))}</span>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2"><span className="h-3 min-w-0 rounded-full bg-brand" style={{ width: `${Math.max(point.accounts ? 2 : 0, point.accounts / peak * 100)}%` }} /><span className="shrink-0 text-xs font-bold text-ink">{number(point.accounts)}</span></div>
            <div className="flex items-center gap-2"><span className="h-3 min-w-0 rounded-full bg-positive" style={{ width: `${Math.max(point.stores ? 2 : 0, point.stores / peak * 100)}%` }} /><span className="shrink-0 text-xs font-bold text-ink">{number(point.stores)}</span></div>
          </div>
        </div>)}
      </div>
      <p className="mt-5 flex gap-5 text-xs font-bold text-muted"><span>● <span className="text-ink">Contas</span></span><span className="text-positive">● <span className="text-ink">Lojas</span></span></p>
    </section>

    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="ultimas-lojas" className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-7">
        <div className="flex items-center justify-between gap-3"><h2 id="ultimas-lojas" className="text-xl font-black text-ink">Últimas lojas</h2><Link href="/painel/admin" className="text-sm font-black text-brand-dark hover:underline">Ver moderação</Link></div>
        {stores.length ? <ul className="mt-5 divide-y divide-line">{stores.map((store) => {
          const city = Array.isArray(store.cities) ? store.cities[0] : store.cities;
          return <li key={store.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
            <div className="min-w-0"><Link href={`/loja/${store.slug}?preview=admin`} className="font-black text-ink hover:underline">{store.name}</Link><p className="mt-1 text-xs text-muted">{city?.name}/{city?.state_code} · {date(store.created_at)}</p></div>
            <span className="shrink-0 text-xs font-bold text-muted">{statuses[store.status] ?? store.status}</span>
          </li>;
        })}</ul> : <p className="mt-5 text-sm text-muted">Nenhuma loja cadastrada.</p>}
      </section>
      <section aria-labelledby="ultimas-campanhas" className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-7">
        <div className="flex items-center justify-between gap-3"><h2 id="ultimas-campanhas" className="text-xl font-black text-ink">Últimas campanhas</h2><Link href="/painel/admin/destaques" className="text-sm font-black text-brand-dark hover:underline">Gerir publicidade</Link></div>
        {campaigns.length ? <ul className="mt-5 divide-y divide-line">{campaigns.map((campaign) => {
          const store = Array.isArray(campaign.businesses) ? campaign.businesses[0] : campaign.businesses;
          return <li key={campaign.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
            <div className="min-w-0"><p className="font-black text-ink">{store?.name ?? `Campanha #${campaign.id}`}</p><p className="mt-1 text-xs text-muted">{campaign.placement === "banner" ? "Banner" : "Destaque"} · {date(campaign.created_at)} · {campaign.provider === "manual" ? "Cortesia" : money(campaign.charged_price_cents)}</p></div>
            <span className="shrink-0 text-xs font-bold text-muted">{statuses[campaign.status] ?? campaign.status}</span>
          </li>;
        })}</ul> : <p className="mt-5 text-sm text-muted">Nenhuma campanha cadastrada.</p>}
      </section>
    </div>
  </div>;
}
