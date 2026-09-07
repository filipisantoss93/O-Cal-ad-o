import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  createComplimentaryHighlightAction,
  manageHighlightCampaignAction,
  reviewBannerCampaignAction,
  updateHighlightCapacityAction,
  updateHighlightPackageAction,
} from "@/app/painel/admin/destaques/actions";
import {
  ShieldCheckIcon,
  SparklesIcon,
  StoreIcon,
} from "@/components/icons";
import { requireAdmin } from "@/lib/admin/dal";
import { getAdminHighlights } from "@/lib/highlights/admin";
import { publicMediaUrl } from "@/lib/merchant/media";

export const metadata: Metadata = { title: "Administração de destaques e banners" };

type AdminHighlightsPageProps = {
  searchParams: Promise<{ status?: string; erro?: string; sucesso?: string }>;
};

const allowedStatuses = [
  "all",
  "pending",
  "scheduled",
  "active",
  "paused",
  "completed",
  "cancelled",
  "expired",
  "refunded",
] as const;

const statusLabels: Record<string, string> = {
  all: "Todas",
  pending: "Aguardando pagamento",
  scheduled: "Agendadas",
  active: "Ativas",
  paused: "Pausadas",
  completed: "Concluídas",
  cancelled: "Canceladas",
  expired: "Expiradas",
  refunded: "Reembolsadas",
};

const placementLabels: Record<string, string> = {
  city: "Cidade",
  category: "Categoria",
  combo: "Cidade + categoria",
  banner: "Banner regional",
};

const pauseReasonLabels: Record<string, string> = {
  business_unavailable: "Loja temporariamente inelegível",
  payment_dispute: "Pagamento em contestação",
  admin: "Pausa administrativa",
  creative_review: "Banner aguardando análise",
  creative_rejected: "Ajustes solicitados no banner",
};

const errorMessages: Record<string, string> = {
  pacote_invalido: "Confira o preço e os dados do pacote.",
  capacidade_invalida: "A capacidade precisa ficar entre 1 e 100 vagas.",
  configuracao: "Não foi possível salvar a configuração.",
  cortesia_invalida: "Confira a loja, o pacote e a data da cortesia.",
  sem_vagas: "Não há vaga disponível para esse espaço e período.",
  campanha_aberta: "A loja já possui uma campanha aberta.",
  loja_inelegivel: "A loja não está apta a receber destaque.",
  cortesia: "Não foi possível criar a cortesia.",
  acao_invalida: "Ação administrativa inválida.",
  acao_campanha: "Não foi possível alterar essa campanha.",
  revisao_banner_invalida: "Informe uma decisão válida e o motivo ao solicitar ajustes.",
  revisao_banner: "Não foi possível concluir a análise do banner.",
};

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function date(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function AdminHighlightsPage({
  searchParams,
}: AdminHighlightsPageProps) {
  const params = await searchParams;
  const selectedStatus = allowedStatuses.includes(
    params.status as (typeof allowedStatuses)[number],
  )
    ? params.status!
    : "all";
  const { supabase } = await requireAdmin("/painel/admin/destaques");
  const data = await getAdminHighlights(supabase, selectedStatus);
  const paidStatuses = new Set(["scheduled", "active", "paused", "completed"]);
  const revenueCents = data.campaigns.reduce(
    (total, campaign) =>
      total +
      (campaign.provider === "efi" && paidStatuses.has(campaign.status)
        ? campaign.charged_price_cents
        : 0),
    0,
  );
  const activeCount = data.campaigns.filter(
    (campaign) => campaign.status === "active",
  ).length;
  const waitingCount = data.campaigns.filter((campaign) =>
    ["pending", "scheduled"].includes(campaign.status),
  ).length;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-positive">
            Administração
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">
            Destaques e banners
          </h1>
          <p className="mt-2 max-w-3xl text-base leading-7 text-muted">
            Controle preços, vagas, moderação, campanhas e resultados dos espaços patrocinados.
          </p>
        </div>
        <Link href="/painel/admin" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-black text-ink">
          <ShieldCheckIcon className="size-4" /> Voltar à moderação
        </Link>
      </div>

      {params.erro && (
        <p role="alert" className="mt-6 rounded-2xl border border-brand/20 bg-brand/8 p-4 text-sm font-bold text-brand-dark">
          {errorMessages[params.erro] ?? "Não foi possível concluir a operação."}
        </p>
      )}
      {params.sucesso && (
        <p role="status" className="mt-6 rounded-2xl border border-positive/20 bg-positive-soft p-4 text-sm font-bold text-positive">
          Alteração salva com sucesso.
        </p>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ["Campanhas ativas", activeCount],
          ["Pendentes ou agendadas", waitingCount],
          ["Receita das listadas", money(revenueCents)],
        ].map(([label, value]) => (
          <article key={label} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <p className="text-sm font-bold text-muted">{label}</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-ink">{value}</p>
          </article>
        ))}
      </section>

      <section id="capacidade" className="mt-8 scroll-mt-40 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">Inventário</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">Vagas simultâneas</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          O combo utiliza uma vaga em cada espaço. Reduzir o limite não interrompe campanhas já pagas, mas impede novas vendas até haver disponibilidade.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {data.rules.map((rule) => (
            <form key={rule.code} action={updateHighlightCapacityAction} className="rounded-2xl border border-line bg-canvas p-5">
              <input type="hidden" name="code" value={rule.code} />
              <p className="font-black text-ink">{rule.name}</p>
              <label className="mt-4 block text-sm font-bold text-muted">
                Máximo por {rule.code === "category" ? "categoria e cidade" : "cidade"}
                <input name="max_active" type="number" min="1" max="100" required defaultValue={rule.max_active} className="mt-2 min-h-11 w-full rounded-xl border border-line bg-white px-3 font-black text-ink" />
              </label>
              <label className="mt-4 flex items-center gap-2 text-sm font-bold text-ink">
                <input name="enabled" value="true" type="checkbox" defaultChecked={rule.is_active} className="size-4 accent-[var(--color-brand)]" />
                Permitir novas campanhas
              </label>
              <button type="submit" className="mt-4 min-h-10 rounded-xl bg-ink px-4 text-sm font-black text-white">Salvar capacidade</button>
            </form>
          ))}
        </div>
      </section>

      <section id="precos" className="mt-8 scroll-mt-40 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">Catálogo comercial</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">Preços dos pacotes</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.packages.map((item) => (
            <form key={item.code} action={updateHighlightPackageAction} className="rounded-2xl border border-line bg-canvas p-5">
              <input type="hidden" name="code" value={item.code} />
              <p className="text-xs font-black uppercase tracking-wide text-brand-dark">{placementLabels[item.placement]}</p>
              <p className="mt-1 font-black text-ink">{item.duration_days} dias</p>
              <label className="mt-4 block text-sm font-bold text-muted">
                Preço em reais
                <input name="price" type="number" min="1" max="10000" step="0.01" required defaultValue={(item.price_cents / 100).toFixed(2)} className="mt-2 min-h-11 w-full rounded-xl border border-line bg-white px-3 font-black text-ink" />
              </label>
              <label className="mt-4 flex items-center gap-2 text-sm font-bold text-ink">
                <input name="enabled" value="true" type="checkbox" defaultChecked={item.is_active} className="size-4 accent-[var(--color-brand)]" />
                Disponível para venda
              </label>
              <button type="submit" className="mt-4 min-h-10 rounded-xl bg-ink px-4 text-sm font-black text-white">Salvar pacote</button>
            </form>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] border border-accent-dark/20 bg-accent/15 p-5 sm:p-8">
        <div className="flex items-start gap-3">
          <SparklesIcon className="mt-1 size-5 shrink-0 text-ink" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">Ação promocional</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">Conceder cortesia</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Crie uma campanha sem cobrança, mantendo os mesmos limites de vagas e métricas.</p>
          </div>
        </div>
        <form action={createComplimentaryHighlightAction} className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-black text-ink">
            Loja
            <select name="business_id" required className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-3 font-bold">
              <option value="">Selecione</option>
              {data.businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-black text-ink">
            Pacote
            <select name="package_code" required className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-3 font-bold">
              <option value="">Selecione</option>
              {data.packages.filter((item) => item.is_active && item.placement !== "banner").map((item) => <option key={item.code} value={item.code}>{placementLabels[item.placement]} · {item.duration_days} dias</option>)}
            </select>
          </label>
          <label className="text-sm font-black text-ink">
            Início
            <input name="starts_on" type="date" required defaultValue={today()} className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-3 font-bold" />
          </label>
          <label className="text-sm font-black text-ink">
            Motivo
            <input name="admin_note" maxLength={1000} placeholder="Ex.: lançamento" className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-3 font-bold" />
          </label>
          <button type="submit" className="min-h-12 rounded-xl bg-brand px-5 text-sm font-black text-white md:col-span-2 lg:col-span-4">Criar campanha de cortesia</button>
        </form>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">Operação</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">Campanhas</h2>
          </div>
          <nav aria-label="Filtrar campanhas" className="flex max-w-full gap-2 overflow-x-auto pb-2">
            {allowedStatuses.map((status) => (
              <Link key={status} href={`/painel/admin/destaques?status=${status}`} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-black ${selectedStatus === status ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted"}`}>{statusLabels[status]}</Link>
            ))}
          </nav>
        </div>

        {data.campaigns.length === 0 ? (
          <div className="mt-6 grid min-h-52 place-items-center rounded-3xl border border-dashed border-line bg-surface p-6 text-center">
            <div><StoreIcon className="mx-auto size-8 text-muted" /><p className="mt-3 font-black text-ink">Nenhuma campanha neste filtro.</p></div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {data.campaigns.map((campaign) => {
              const metrics = data.metricsByCampaign.get(campaign.id);
              const canPause = ["active", "scheduled"].includes(campaign.status);
              const canResume = campaign.status === "paused" &&
                (campaign.placement !== "banner" || campaign.creative_status === "approved");
              const canCancel = !["completed", "cancelled", "expired", "refunded"].includes(campaign.status);
              const canBonus = ["active", "scheduled", "paused"].includes(campaign.status);
              return (
                <article key={campaign.id} className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-7">
                  <div className="flex flex-col gap-5 lg:flex-row lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-accent/25 px-3 py-1 text-[11px] font-black uppercase text-ink">{placementLabels[campaign.placement]}</span>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-black ${campaign.status === "active" ? "bg-positive-soft text-positive" : "bg-canvas text-muted"}`}>{statusLabels[campaign.status]}</span>
                        {campaign.provider === "manual" && <span className="rounded-full bg-brand/8 px-3 py-1 text-[11px] font-black text-brand-dark">Cortesia</span>}
                      </div>
                      <h3 className="mt-3 text-xl font-black text-ink">{campaign.businesses?.name ?? `Loja #${campaign.business_id}`}</h3>
                      <p className="mt-1 text-sm font-semibold text-muted">{campaign.cities?.name}/{campaign.cities?.state_code} · {campaign.categories?.name}</p>
                      <p className="mt-3 text-sm font-bold text-muted">{date(campaign.starts_at)} a {date(campaign.ends_at)} · {campaign.provider === "manual" ? "sem cobrança" : money(campaign.charged_price_cents)}</p>
                      {campaign.status === "paused" && campaign.pause_reason ? <p className="mt-2 text-sm font-black text-brand-dark">{pauseReasonLabels[campaign.pause_reason]}</p> : null}
                      {campaign.admin_note && <p className="mt-2 text-sm leading-6 text-muted">Nota: {campaign.admin_note}</p>}
                      {campaign.placement === "banner" && campaign.creative_image_path ? (
                        <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-ink">
                          <div className="relative aspect-[16/5] min-h-44">
                            <Image src={publicMediaUrl(supabase, campaign.creative_image_path) ?? ""} alt={`Banner de ${campaign.businesses?.name ?? "loja"}`} fill sizes="(min-width: 1024px) 640px, 100vw" className="object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/45 to-transparent" />
                            <div className="absolute inset-0 flex max-w-lg flex-col justify-center p-5 text-white sm:p-7">
                              <p className="text-xs font-black uppercase tracking-wide text-accent">Prévia do anúncio</p>
                              <p className="mt-2 text-xl font-black sm:text-2xl">{campaign.creative_title}</p>
                              <p className="mt-1 line-clamp-2 text-sm font-semibold text-white/80">{campaign.creative_description}</p>
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {campaign.placement === "banner" && campaign.creative_status !== "approved" ? (
                        <form action={reviewBannerCampaignAction} className="mt-4 rounded-2xl border border-accent-dark/20 bg-accent/15 p-4">
                          <input type="hidden" name="campaign_id" value={campaign.id} />
                          <p className="text-sm font-black text-ink">Revisão do criativo</p>
                          <p className="mt-1 text-xs font-semibold leading-5 text-muted">Confira legibilidade, conteúdo, relação com a loja e ausência de material impróprio.</p>
                          <label className="mt-3 block text-xs font-black text-muted">Motivo para solicitar ajustes
                            <input name="reason" maxLength={500} placeholder="Obrigatório somente ao rejeitar" className="mt-1 min-h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink" />
                          </label>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <button name="decision" value="approve" className="min-h-10 rounded-xl bg-positive px-3 text-sm font-black text-white">Aprovar banner</button>
                            <button name="decision" value="reject" className="min-h-10 rounded-xl border border-brand/25 bg-brand/8 px-3 text-sm font-black text-brand-dark">Solicitar ajustes</button>
                          </div>
                        </form>
                      ) : null}
                      <dl className="mt-4 flex flex-wrap gap-2">
                        {[
                          ["Impressões", metrics?.impressions ?? 0],
                          ["Visitas", metrics?.storeViews ?? 0],
                          ["WhatsApp", metrics?.whatsapp ?? 0],
                          ["Rotas", metrics?.directions ?? 0],
                        ].map(([label, value]) => <div key={label} className="rounded-xl bg-canvas px-3 py-2"><dt className="text-[10px] font-black uppercase text-muted">{label}</dt><dd className="text-base font-black text-ink">{Number(value).toLocaleString("pt-BR")}</dd></div>)}
                      </dl>
                    </div>

                    <form action={manageHighlightCampaignAction} className="grid w-full gap-2 rounded-2xl bg-canvas p-4 sm:grid-cols-2 lg:max-w-sm">
                      <input type="hidden" name="campaign_id" value={campaign.id} />
                      {canPause && <button name="intent" value="pause" className="min-h-10 rounded-xl border border-line bg-white px-3 text-sm font-black text-ink">Pausar</button>}
                      {canResume && <button name="intent" value="resume" className="min-h-10 rounded-xl bg-positive px-3 text-sm font-black text-white">Retomar</button>}
                      {canCancel && <button name="intent" value="cancel" className="min-h-10 rounded-xl border border-brand/25 bg-brand/8 px-3 text-sm font-black text-brand-dark">Cancelar</button>}
                      {canBonus && (
                        <>
                          <label className="text-xs font-black text-muted">Bônus em dias<input name="bonus_days" type="number" min="1" max="90" defaultValue="7" className="mt-1 min-h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink" /></label>
                          <button name="intent" value="bonus" className="min-h-10 self-end rounded-xl bg-ink px-3 text-sm font-black text-white">Adicionar bônus</button>
                        </>
                      )}
                      {canCancel ? <p className="text-[11px] font-bold leading-5 text-muted sm:col-span-2">Cancelar retira a loja dos espaços, mas não realiza estorno automático na Efí.</p> : null}
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
