import type { Metadata } from "next";
import Link from "next/link";
import {
  replaceBannerCreativeAction,
  startHighlightCheckoutAction,
} from "@/app/painel/destaques/actions";
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

export const metadata: Metadata = { title: "Destaques e banners" };

type HighlightsPageProps = {
  searchParams: Promise<{ loja?: string; erro?: string; sucesso?: string }>;
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
  banner: {
    eyebrow: "Publicidade premium",
    title: "Banner regional na página inicial",
    description:
      "Sua arte aparece em destaque para visitantes que selecionarem a cidade da sua loja.",
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
  creative_review: "O pagamento foi reconhecido. O banner aguarda aprovação da administração; os dias contratados ainda não começaram a contar.",
  creative_rejected: "A arte precisa ser corrigida conforme a orientação da administração antes de ser exibida.",
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
  banner_titulo_invalido: "O título do banner deve ter entre 3 e 90 caracteres.",
  banner_descricao_invalida: "A descrição do banner deve ter entre 3 e 180 caracteres.",
  banner_imagem_obrigatoria: "Envie a imagem que será usada no banner.",
  banner_imagem_invalida: "Envie uma imagem JPG, PNG, WebP ou AVIF de até 5 MB.",
  banner_criativo_invalido: "Revise a imagem e os textos do banner.",
  banner_ja_contratado: "Esta loja já possui um banner aberto.",
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
  const selectedCampaigns = selectedBusiness
    ? highlights.campaigns.filter(
        (campaign) => campaign.business_id === selectedBusiness.id &&
          ["pending", "scheduled", "active", "paused"].includes(campaign.status),
      )
    : [];
  const selectedStoreCampaign = selectedCampaigns.find(
    (campaign) => campaign.placement !== "banner",
  );
  const selectedBannerCampaign = selectedCampaigns.find(
    (campaign) => campaign.placement === "banner",
  );
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
            Destaques e banners pagos
          </h1>
          <p className="mt-2 max-w-3xl text-base leading-7 text-muted">
            Contrate por 7, 15 ou 30 dias. Escolha entre prioridade para a
            vitrine ou um banner regional na página inicial.
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
      {params.sucesso === "banner_reenviado" && (
        <p role="status" className="mt-6 rounded-2xl border border-positive/20 bg-positive-soft p-4 text-sm font-bold text-positive">
          Nova arte enviada para análise.
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

        {selectedBusiness && selectedCampaigns.map((campaign) => (
          <div key={campaign.id} className="mt-6 rounded-2xl border border-accent-dark/20 bg-accent/15 p-5">
            <p className="font-black text-ink">
              {placementDetails[campaign.placement].title}: {statusLabels[campaign.status]}
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 text-muted">
              Período previsto: {date(campaign.starts_at)} a {date(campaign.ends_at)}.
            </p>
            {campaign.status === "paused" && campaign.pause_reason ? (
              <p className="mt-2 text-sm font-bold text-brand-dark">
                {pauseReasonLabels[campaign.pause_reason]}
              </p>
            ) : null}
            {campaign.creative_status === "rejected" && campaign.creative_rejection_reason ? (
              <p className="mt-2 text-sm font-bold text-brand-dark">
                Ajuste solicitado: {campaign.creative_rejection_reason}
              </p>
            ) : null}
            {campaign.placement === "banner" && campaign.creative_status === "rejected" ? (
              <form action={replaceBannerCreativeAction} encType="multipart/form-data" className="mt-5 grid gap-3 rounded-2xl bg-white/70 p-4 sm:grid-cols-2">
                <input type="hidden" name="campaign_id" value={campaign.id} />
                <input type="hidden" name="business_id" value={selectedBusiness.id} />
                <label className="text-xs font-black text-ink sm:col-span-2">Nova imagem<input type="file" name="banner_image" accept="image/jpeg,image/png,image/webp,image/avif" required className="mt-1 block w-full rounded-xl border border-line bg-white p-3 text-xs" /></label>
                <label className="text-xs font-black text-ink">Novo título<input name="banner_title" minLength={3} maxLength={90} required defaultValue={campaign.creative_title ?? ""} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm" /></label>
                <label className="text-xs font-black text-ink">Nova descrição<input name="banner_description" minLength={3} maxLength={180} required defaultValue={campaign.creative_description ?? ""} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm" /></label>
                <button className="min-h-11 rounded-xl bg-ink px-4 text-sm font-black text-white sm:col-span-2">Reenviar para análise</button>
              </form>
            ) : null}
            {campaign.status === "pending" && campaign.provider_payment_url && (
              <a href={campaign.provider_payment_url} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-ink px-4 text-sm font-black text-white">
                Continuar pagamento na Efí
              </a>
            )}
          </div>
        ))}

        {selectedBusiness && !eligible && selectedCampaigns.length === 0 && (
          <div className="mt-6 rounded-2xl border border-brand/20 bg-brand/8 p-5">
            <p className="font-black text-brand-dark">Esta loja ainda não pode ser destacada.</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-muted">
              Ela precisa estar aprovada, ativa, liberada pelo plano e possuir logo e imagem de capa.
            </p>
          </div>
        )}
      </section>

      {selectedBusiness && (
        <section className="mt-8 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {(["category", "city", "combo", "banner"] as HighlightPlacement[]).map(
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
              const openCampaign = placement === "banner"
                ? selectedBannerCampaign
                : selectedStoreCampaign;
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

                  <form action={startHighlightCheckoutAction} encType="multipart/form-data" className="mt-6 space-y-4">
                    <input type="hidden" name="business_id" value={selectedBusiness.id} />
                    <label className="block text-sm font-black text-ink">
                      Período
                      <select
                        name="product_code"
                        required
                        disabled={!eligible || Boolean(openCampaign)}
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
                        disabled={!eligible || Boolean(openCampaign)}
                        className="mt-2 min-h-12 w-full rounded-xl border border-line bg-canvas px-3 font-bold outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:opacity-55"
                      />
                    </label>
                    {placement === "banner" && (
                      <>
                        <label className="block text-sm font-black text-ink">
                          Imagem do banner
                          <input
                            type="file"
                            name="banner_image"
                            accept="image/jpeg,image/png,image/webp,image/avif"
                            required
                            disabled={!eligible || Boolean(openCampaign)}
                            className="mt-2 block w-full rounded-xl border border-dashed border-line bg-canvas p-3 text-xs font-bold text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-2 file:font-black file:text-white disabled:opacity-55"
                          />
                          <span className="mt-1 block text-xs font-semibold leading-5 text-muted">Formato horizontal recomendado: 1600 × 500 px. Máximo de 5 MB.</span>
                        </label>
                        <label className="block text-sm font-black text-ink">
                          Título do anúncio
                          <input name="banner_title" minLength={3} maxLength={90} required disabled={!eligible || Boolean(openCampaign)} placeholder="Ex.: Revisão completa com condições especiais" className="mt-2 min-h-12 w-full rounded-xl border border-line bg-canvas px-3 font-bold outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:opacity-55" />
                        </label>
                        <label className="block text-sm font-black text-ink">
                          Descrição
                          <textarea name="banner_description" minLength={3} maxLength={180} required disabled={!eligible || Boolean(openCampaign)} rows={3} placeholder="Explique a oferta ou o principal diferencial da sua loja." className="mt-2 w-full rounded-xl border border-line bg-canvas p-3 font-semibold outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:opacity-55" />
                        </label>
                      </>
                    )}
                    <button
                      type="submit"
                      disabled={!eligible || Boolean(openCampaign) || packages.length === 0}
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-black text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <SparklesIcon className="size-4" /> {placement === "banner" ? "Contratar banner" : "Contratar destaque"}
                    </button>
                    <p className="text-center text-xs font-semibold text-muted">
                      {placement === "banner" ? "Após o pagamento, a arte será revisada antes da exibição." : "Pagamento seguro por Pix ou cartão na Efí."}
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
                  {campaign.placement === "banner" ? (
                    <p className="mt-2 text-xs font-bold leading-5 text-muted">
                      Criativo: {campaign.creative_status === "approved" ? "aprovado" : campaign.creative_status === "rejected" ? "ajustes solicitados" : "aguardando análise"}.
                    </p>
                  ) : null}
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
