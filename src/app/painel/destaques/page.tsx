import type { Metadata } from "next";
import Link from "next/link";
import { startHighlightCheckoutAction } from "@/app/painel/destaques/actions";
import {
  ClockIcon,
  MapPinIcon,
  SparklesIcon,
  StoreIcon,
} from "@/components/icons";
import { getMerchantBillingSummary } from "@/lib/merchant/billing";
import { getMerchantWorkspace } from "@/lib/merchant/dal";
import {
  getMerchantHighlights,
  type HighlightPlacement,
} from "@/lib/highlights/merchant";

export const metadata: Metadata = { title: "Lojas em destaque" };

type HighlightsPageProps = {
  searchParams: Promise<{ loja?: string; erro?: string }>;
};

const placementDetails: Record<
  HighlightPlacement,
  { eyebrow: string; title: string; description: string }
> = {
  category: {
    eyebrow: "Na categoria",
    title: "Destaque de categoria",
    description:
      "Sua loja ganha prioridade patrocinada quando o cliente explora sua categoria na cidade.",
  },
  city: {
    eyebrow: "Página inicial",
    title: "Destaque da cidade",
    description:
      "Sua vitrine participa do rodízio principal de lojas em destaque da sua cidade.",
  },
  combo: {
    eyebrow: "Maior alcance",
    title: "Combo cidade + categoria",
    description:
      "A loja participa dos dois espaços durante todo o período contratado.",
  },
};

const statusLabels: Record<string, string> = {
  pending: "Aguardando pagamento",
  scheduled: "Agendado",
  active: "Em destaque",
  paused: "Pausado",
  completed: "Concluído",
  cancelled: "Cancelado",
  expired: "Expirado",
  refunded: "Reembolsado",
};

const pauseReasonLabels: Record<string, string> = {
  business_unavailable:
    "A exibição foi interrompida até a loja voltar a cumprir os requisitos.",
  payment_dispute:
    "A exibição foi interrompida enquanto a situação do pagamento é analisada.",
  admin: "A exibição foi pausada pela administração da plataforma.",
};

const errorMessages: Record<string, string> = {
  checkout_efi:
    "Não foi possível abrir o checkout da Efí. Nenhuma campanha foi ativada.",
  loja_invalida: "Selecione uma loja válida.",
  loja_destaque_indisponivel:
    "A loja precisa estar aprovada, ativa, liberada pelo plano e ter logo e capa.",
  pacote_destaque_invalido: "O pacote escolhido não está disponível.",
  destaque_ja_contratado:
    "Esta loja já possui uma campanha aberta. Conclua ou aguarde o encerramento dela.",
  data_inicio_invalida: "Escolha uma data de início válida.",
  data_inicio_distante: "O início pode ser agendado com no máximo 90 dias de antecedência.",
  destaque_sem_vagas:
    "As vagas desse espaço estão ocupadas nesse período. Escolha outra opção ou uma data posterior.",
  reserva_destaque: "Não foi possível reservar a vaga de destaque agora.",
  efi_nao_configurada: "A cobrança Efí ainda não está disponível.",
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

function inputDate(offsetDays = 0) {
  const value = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export default async function HighlightsPage({
  searchParams,
}: HighlightsPageProps) {
  const params = await searchParams;
  const { supabase, user, businesses } = await getMerchantWorkspace(
    "/painel/destaques",
  );
  const [highlights, billing] = await Promise.all([
    getMerchantHighlights(supabase, user.id),
    getMerchantBillingSummary(supabase, user.id, businesses),
  ]);
  const selectedId = Number(params.loja);
  const selectedBusiness =
    businesses.find(
      (business) => Number.isSafeInteger(selectedId) && business.id === selectedId,
    ) ??
    businesses[0] ??
    null;
  const selectedCampaign = selectedBusiness
    ? highlights.campaigns.find(
        (campaign) =>
          campaign.business_id === selectedBusiness.id &&
          ["pending", "scheduled", "active", "paused"].includes(campaign.status),
      )
    : null;
  const eligible = Boolean(
    selectedBusiness &&
      selectedBusiness.status === "approved" &&
      selectedBusiness.is_active &&
      !selectedBusiness.billing_suspended &&
      selectedBusiness.logo_path &&
      selectedBusiness.cover_path,
  );
  const metrics = highlights.campaigns.reduce(
    (total, campaign) => {
      const item = highlights.metricsByCampaign.get(campaign.id);
      total.impressions += item?.impressions ?? 0;
      total.storeViews += item?.store_views ?? 0;
      total.contacts +=
        (item?.whatsapp_clicks ?? 0) + (item?.directions_clicks ?? 0);
      return total;
    },
    { impressions: 0, storeViews: 0, contacts: 0 },
  );
  const capacityByPlacement = new Map(
    highlights.rules.map((rule) => [rule.code, rule.max_active]),
  );
  const errorMessage = params.erro ? errorMessages[params.erro] : null;

  return (
    <div>
      <div className="flex items-start gap-4">
        <span className="hidden size-12 place-items-center rounded-2xl bg-accent/30 text-ink sm:grid">
          <SparklesIcon className="size-5" />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
            Mais visibilidade
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">
            Colocar loja em destaque
          </h1>
          <p className="mt-2 max-w-3xl text-base leading-7 text-muted">
            Contrate por 7, 15 ou 30 dias. As lojas patrocinadas entram em
            rodízio equilibrado e cada espaço possui vagas limitadas.
          </p>
        </div>
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="mt-6 rounded-2xl border border-brand/20 bg-brand/8 p-4 text-sm font-bold leading-6 text-brand-dark"
        >
          {errorMessage}
        </p>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ["Impressões", metrics.impressions],
          ["Visitas à vitrine", metrics.storeViews],
          ["Contatos e rotas", metrics.contacts],
        ].map(([label, value]) => (
          <article key={label} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <p className="text-sm font-bold text-muted">{label}</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-ink">
              {Number(value).toLocaleString("pt-BR")}
            </p>
          </article>
        ))}
      </section>

      {billing.proActive ? (
        <div className="mt-6 rounded-2xl border border-positive/20 bg-positive-soft p-4 text-sm font-bold text-positive">
          Seu Calçadão Pro está ativo: o desconto de 10% será aplicado
          automaticamente no checkout.
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-accent-dark/20 bg-accent/20 p-4 text-sm font-bold text-ink">
          Qualquer loja aprovada pode contratar. Assinantes Pro recebem 10% de
          desconto. <Link href="/painel/assinatura" className="underline underline-offset-4">Conhecer o Pro</Link>
        </div>
      )}

      <section className="mt-8 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
              Escolha a vitrine
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">
              Loja que será divulgada
            </h2>
          </div>
          <Link href="/painel/loja" className="text-sm font-black text-brand-dark underline underline-offset-4">
            Gerenciar lojas
          </Link>
        </div>

        {businesses.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-line bg-canvas p-6 text-center">
            <StoreIcon className="mx-auto size-7 text-muted" />
            <p className="mt-3 font-black text-ink">Cadastre sua primeira loja.</p>
          </div>
        ) : (
          <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
            {businesses.map((business) => (
              <Link
                key={business.id}
                href={`/painel/destaques?loja=${business.id}`}
                className={`min-w-52 rounded-2xl border p-4 transition ${
                  selectedBusiness?.id === business.id
                    ? "border-brand/40 bg-brand/8"
                    : "border-line bg-canvas hover:border-brand/25"
                }`}
              >
                <span className="block truncate font-black text-ink">{business.name}</span>
                <span className="mt-1 block text-xs font-bold text-muted">
                  {business.status === "approved" ? "Aprovada" : "Aguardando aprovação"}
                </span>
              </Link>
            ))}
          </div>
        )}

        {selectedCampaign && selectedBusiness && (
          <div className="mt-6 rounded-2xl border border-accent-dark/20 bg-accent/15 p-5">
            <p className="font-black text-ink">
              {selectedBusiness.name}: {statusLabels[selectedCampaign.status]}
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 text-muted">
              Período previsto: {date(selectedCampaign.starts_at)} a {date(selectedCampaign.ends_at)}.
            </p>
            {selectedCampaign.status === "paused" && selectedCampaign.pause_reason ? (
              <p className="mt-2 text-sm font-bold text-brand-dark">
                {pauseReasonLabels[selectedCampaign.pause_reason]}
              </p>
            ) : null}
            {selectedCampaign.status === "pending" && selectedCampaign.provider_payment_url && (
              <a
                href={selectedCampaign.provider_payment_url}
                className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-ink px-4 text-sm font-black text-white"
              >
                Continuar pagamento na Efí
              </a>
            )}
          </div>
        )}

        {selectedBusiness && !eligible && !selectedCampaign && (
          <div className="mt-6 rounded-2xl border border-brand/20 bg-brand/8 p-5">
            <p className="font-black text-brand-dark">Esta loja ainda não pode ser destacada.</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-muted">
              Ela precisa estar aprovada, ativa, liberada pelo plano e possuir logo e imagem de capa.
            </p>
          </div>
        )}
      </section>

      {selectedBusiness && (
        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          {(["category", "city", "combo"] as HighlightPlacement[]).map(
            (placement) => {
              const details = placementDetails[placement];
              const packages = highlights.packages.filter(
                (item) => item.placement === placement,
              );
              const cityCapacity = capacityByPlacement.get("city");
              const categoryCapacity = capacityByPlacement.get("category");
              const capacity = placement === "combo"
                ? cityCapacity !== undefined && categoryCapacity !== undefined
                  ? Math.min(cityCapacity, categoryCapacity)
                  : undefined
                : capacityByPlacement.get(placement);
              return (
                <article key={placement} className="flex flex-col rounded-[2rem] border border-line bg-surface p-6 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
                    {details.eyebrow}
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">
                    {details.title}
                  </h2>
                  <p className="mt-3 min-h-18 text-sm leading-6 text-muted">
                    {details.description}
                  </p>
                  <p className="mt-4 flex items-center gap-2 text-xs font-bold text-muted">
                    <MapPinIcon className="size-4 text-brand" /> Até {capacity ?? "—"} campanhas simultâneas por espaço
                  </p>

                  <form action={startHighlightCheckoutAction} className="mt-6 space-y-4">
                    <input type="hidden" name="business_id" value={selectedBusiness.id} />
                    <label className="block text-sm font-black text-ink">
                      Período
                      <select
                        name="product_code"
                        required
                        disabled={!eligible || Boolean(selectedCampaign)}
                        className="mt-2 min-h-12 w-full rounded-xl border border-line bg-canvas px-3 font-bold outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:opacity-55"
                      >
                        {packages.map((item) => {
                          const price = billing.proActive
                            ? item.price_cents - Math.round(item.price_cents * 0.1)
                            : item.price_cents;
                          return (
                            <option key={item.code} value={item.code}>
                              {item.duration_days} dias · {money(price)}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                    <label className="block text-sm font-black text-ink">
                      Data de início
                      <input
                        type="date"
                        name="starts_on"
                        required
                        defaultValue={inputDate()}
                        min={inputDate()}
                        max={inputDate(90)}
                        disabled={!eligible || Boolean(selectedCampaign)}
                        className="mt-2 min-h-12 w-full rounded-xl border border-line bg-canvas px-3 font-bold outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:opacity-55"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={!eligible || Boolean(selectedCampaign) || packages.length === 0}
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-black text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <SparklesIcon className="size-4" /> Contratar destaque
                    </button>
                    <p className="text-center text-xs font-semibold text-muted">
                      Pagamento seguro por Pix ou cartão na Efí.
                    </p>
                  </form>
                </article>
              );
            },
          )}
        </section>
      )}

      <section className="mt-8 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
          Histórico e resultados
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">Minhas campanhas</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          As métricas contabilizam cada visitante uma vez por tipo de interação a cada dia.
        </p>

        {highlights.campaigns.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-canvas p-5 text-sm font-semibold text-muted">
            Nenhuma campanha contratada até agora.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {highlights.campaigns.map((campaign) => {
              const business = businesses.find((item) => item.id === campaign.business_id);
              const itemMetrics = highlights.metricsByCampaign.get(campaign.id);
              return (
                <article key={campaign.id} className="rounded-2xl border border-line bg-canvas p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-ink">{business?.name ?? "Loja"}</p>
                      <p className="mt-1 text-xs font-bold text-muted">
                        {placementDetails[campaign.placement].title} · {campaign.duration_days} dias
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-black ${campaign.status === "active" ? "bg-positive-soft text-positive" : "bg-white text-muted"}`}>
                      {statusLabels[campaign.status] ?? campaign.status}
                    </span>
                  </div>
                  <p className="mt-4 flex items-center gap-2 text-xs font-bold text-muted">
                    <ClockIcon className="size-4 text-brand" /> {date(campaign.starts_at)} a {date(campaign.ends_at)}
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                    {[
                      ["Impressões", itemMetrics?.impressions ?? 0],
                      ["Visitas", itemMetrics?.store_views ?? 0],
                      ["WhatsApp", itemMetrics?.whatsapp_clicks ?? 0],
                      ["Rotas", itemMetrics?.directions_clicks ?? 0],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-white p-3">
                        <dt className="text-[10px] font-black uppercase tracking-wide text-muted">{label}</dt>
                        <dd className="mt-1 text-lg font-black text-ink">{Number(value).toLocaleString("pt-BR")}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-4 text-sm font-black text-brand-dark">
                    {campaign.provider === "manual" ? "Cortesia da plataforma" : `Investimento: ${money(campaign.charged_price_cents)}`}
                  </p>
                  {campaign.status === "paused" && campaign.pause_reason ? (
                    <p className="mt-2 text-xs font-bold leading-5 text-muted">
                      {pauseReasonLabels[campaign.pause_reason]}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
