import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckIcon,
  SparklesIcon,
  StoreIcon,
  TagIcon,
} from "@/components/icons";
import {
  cancelAddonAction,
  startExtraStoreCheckoutAction,
  startProCardCheckoutAction,
  startProPixCheckoutAction,
  startPromotionPackCheckoutAction,
} from "@/app/painel/assinatura/actions";
import { getMerchantBillingSummary } from "@/lib/merchant/billing";
import { getMerchantWorkspace } from "@/lib/merchant/dal";

export const metadata: Metadata = {
  title: "Assinatura",
};

type BillingPageProps = {
  searchParams: Promise<{ loja?: string; erro?: string; sucesso?: string }>;
};

const cycleLabels: Record<string, string> = {
  monthly: "Mensal",
  semiannual: "Semestral",
  annual: "Anual",
};

const paymentLabels: Record<string, string> = {
  credit_card: "Cartão de crédito",
  pix: "Pix",
  pix_auto: "Pix Automático",
};

const errorMessages: Record<string, string> = {
  efi_nao_configurada:
    "A cobrança Efí ainda não está configurada no Supabase. O cadastro e os limites já funcionam, mas o checkout depende das credenciais nas Edge Functions.",
  checkout_efi:
    "Não foi possível abrir o checkout da Efí. Nenhum benefício foi liberado sem confirmação de pagamento.",
  periodo_invalido: "Período de assinatura inválido.",
  preco_indisponivel: "Este período está temporariamente indisponível.",
  pro_necessario:
    "Ative o Calçadão Pro antes de comprar lojas ou promoções adicionais.",
  pro_ja_ativo: "Sua assinatura Pro já está ativa.",
  produto_indisponivel: "Este adicional está temporariamente indisponível.",
  produto_invalido: "Adicional inválido.",
  loja_invalida: "Selecione uma loja válida para comprar promoções adicionais.",
  adicional_invalido: "Não foi possível localizar este adicional.",
  adicional_indisponivel: "Este adicional está temporariamente indisponível.",
  adicional_nao_recorrente: "Este adicional é uma compra única e não possui cobrança recorrente para cancelar.",
  adicional_nao_cancelavel: "Este adicional não possui uma recorrência ativa que possa ser cancelada.",
  cancelamento_efi: "Não foi possível cancelar a recorrência na Efí agora. Tente novamente em alguns instantes.",
  cancelamento_local: "A Efí recebeu o cancelamento, mas não foi possível atualizar a tela. Recarregue a página em alguns instantes.",
};

const successMessages: Record<string, string> = {
  adicional_cancelado:
    "Cancelamento do adicional agendado. O Plano Pro continua ativo e a vaga adicional permanece disponível até o fim do período já pago.",
};

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function date(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = await searchParams;
  const { supabase, user, businesses } = await getMerchantWorkspace(
    "/painel/assinatura",
  );
  const billing = await getMerchantBillingSummary(supabase, user.id, businesses);
  const providerConfigured = true;
  const selectedId = Number(params.loja);
  const selectedBusiness =
    businesses.find(
      (business) =>
        Number.isSafeInteger(selectedId) && business.id === selectedId,
    ) ??
    businesses[0] ??
    null;
  const extraStore = billing.products.find(
    (product) => product.code === "extra_store",
  );
  const promoPacks = billing.products
    .filter((product) => product.kind === "promotion_pack")
    .sort((a, b) => a.units - b.units);
  const visibleAddons = billing.addons.filter((addon) =>
    ["pending", "active", "past_due"].includes(addon.status),
  );
  const errorMessage = params.erro ? errorMessages[params.erro] : null;
  const successMessage = params.sucesso ? successMessages[params.sucesso] : null;

  return (
    <div>
      <div className="flex items-start gap-4">
        <span className="hidden size-12 place-items-center rounded-2xl bg-brand/10 text-brand-dark sm:grid">
          <SparklesIcon className="size-5" />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
            Plano e adicionais
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">
            Assinatura
          </h1>
          <p className="mt-2 max-w-3xl text-base leading-7 text-muted">
            O Pro libera até 3 lojas e 10 promoções por loja. Acima disso,
            compre lojas individualmente ou pacotes de promoções para a unidade
            que precisar.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-brand/20 bg-brand/8 p-4 text-sm font-bold leading-6 text-brand-dark"
        >
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="mt-6 rounded-2xl border border-positive/20 bg-positive-soft p-4 text-sm font-bold leading-6 text-positive"
        >
          {successMessage}
        </div>
      )}

      {!providerConfigured && (
        <div className="mt-6 rounded-2xl border border-accent-dark/20 bg-accent/20 p-4 text-sm font-bold leading-6 text-ink">
          Checkout em preparação: é necessário configurar as credenciais da Efí
          nas Edge Functions do Supabase. Nenhuma cobrança é simulada ou liberada
          manualmente.
        </div>
      )}

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <p className="text-sm font-bold text-muted">Plano atual</p>
          <p className="mt-3 text-2xl font-black text-ink">
            {billing.proActive ? "Calçadão Pro" : "Grátis"}
          </p>
          <p className="mt-2 text-sm font-semibold text-muted">
            {billing.proActive
              ? `${billing.storeLimit} vagas de loja disponíveis`
              : "1 loja e 2 promoções por loja"}
          </p>
        </article>
        <article className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <p className="text-sm font-bold text-muted">Lojas</p>
          <p className="mt-3 text-2xl font-black text-ink">
            {billing.activeStoreCount}/{billing.storeLimit}
          </p>
          <p className="mt-2 text-sm font-semibold text-muted">
            {billing.storeCount - billing.activeStoreCount > 0
              ? `${billing.storeCount - billing.activeStoreCount} suspensa(s) pelo limite`
              : `${billing.extraStoreSlots} vaga(s) adicional(is) contratada(s)`}
          </p>
        </article>
        <article className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <p className="text-sm font-bold text-muted">Situação</p>
          <p className="mt-3 text-2xl font-black text-ink">
            {billing.subscription?.status === "active"
              ? "Regular"
              : billing.subscription?.status === "past_due"
                ? "Pagamento pendente"
                : billing.subscription?.status === "pending"
                  ? "Aguardando pagamento"
                  : billing.proActive
                    ? "Ativa"
                    : "Sem Pro ativo"}
          </p>
          {billing.subscription && (
            <p className="mt-2 text-sm font-semibold text-muted">
              {cycleLabels[billing.subscription.billing_cycle] ??
                billing.subscription.billing_cycle}
              {billing.subscription.current_period_end
                ? ` · até ${date(billing.subscription.current_period_end)}`
                : ""}
            </p>
          )}
        </article>
      </section>

      <section
        id="meus-adicionais"
        className="mt-8 scroll-mt-40 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8"
      >
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
            Contratações extras
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">
            Meus adicionais
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Gerencie suas lojas adicionais recorrentes e consulte os pacotes de
            promoções já adquiridos. Cancelar uma loja adicional não cancela o
            seu Plano Pro.
          </p>
        </div>

        {visibleAddons.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-line bg-canvas p-5">
            <p className="text-sm font-black text-ink">Nenhum adicional contratado.</p>
            <p className="mt-1 text-sm leading-6 text-muted">
              Quando você comprar uma loja adicional ou um pacote de promoções,
              ele aparecerá aqui.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {visibleAddons.map((addon) => {
              const product = billing.products.find(
                (item) => item.code === addon.product_code,
              );
              const business = addon.business_id
                ? businesses.find((item) => item.id === addon.business_id)
                : null;
              const recurring = product?.billing_mode === "recurring";
              const canCancel =
                recurring &&
                !addon.cancel_at_period_end &&
                Boolean(addon.provider_subscription_id) &&
                ["active", "past_due"].includes(addon.status);

              let statusText = "Aguardando confirmação de pagamento";
              if (addon.cancel_at_period_end) {
                statusText = addon.active_until
                  ? `Cancelamento agendado · disponível até ${date(addon.active_until)}`
                  : "Cancelamento agendado";
              } else if (addon.status === "active") {
                statusText = recurring
                  ? addon.active_until
                    ? `Ativo · ciclo atual até ${date(addon.active_until)}`
                    : "Ativo"
                  : "Compra única ativa";
              } else if (addon.status === "past_due") {
                statusText = "Pagamento pendente";
              }

              return (
                <article
                  key={addon.id}
                  className="rounded-2xl border border-line bg-canvas p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {product?.kind === "promotion_pack" ? (
                          <TagIcon className="size-4 shrink-0 text-brand-dark" />
                        ) : (
                          <StoreIcon className="size-4 shrink-0 text-brand-dark" />
                        )}
                        <p className="truncate font-black text-ink">
                          {product?.name ?? addon.product_code}
                        </p>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-muted">
                        {product?.kind === "promotion_pack" && business
                          ? `${business.name} · +${product.units * addon.quantity} promoções`
                          : recurring
                            ? `${money((product?.price_cents ?? 0) * addon.quantity)}/mês`
                            : "Compra única"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-black text-muted">
                      {recurring ? "Mensal" : "Compra única"}
                    </span>
                  </div>

                  <p
                    className={`mt-4 text-sm font-bold leading-6 ${
                      addon.cancel_at_period_end
                        ? "text-brand-dark"
                        : addon.status === "past_due"
                          ? "text-brand-dark"
                          : "text-muted"
                    }`}
                  >
                    {statusText}
                  </p>

                  {canCancel && (
                    <form action={cancelAddonAction} className="mt-4">
                      <input type="hidden" name="addon_id" value={addon.id} />
                      <button
                        type="submit"
                        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-brand/25 bg-white px-4 text-sm font-black text-brand-dark transition hover:bg-brand/8"
                      >
                        Cancelar adicional
                      </button>
                      <p className="mt-2 text-xs font-semibold leading-5 text-muted">
                        O Pro permanece ativo. A vaga continua disponível até o
                        fim do período já pago.
                      </p>
                    </form>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section
        id="calcadao-pro"
        className="mt-8 scroll-mt-40 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8"
      >
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
            Calçadão Pro
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">
            3 lojas e 10 promoções por loja
          </h2>
          <div className="mt-4 grid gap-2 text-sm font-bold text-muted sm:grid-cols-2">
            <p className="flex items-center gap-2">
              <CheckIcon className="size-4 text-positive" /> Até 3 lojas incluídas
            </p>
            <p className="flex items-center gap-2">
              <CheckIcon className="size-4 text-positive" /> 10 promoções por loja
            </p>
            <p className="flex items-center gap-2">
              <CheckIcon className="size-4 text-positive" /> Lojas extras compradas individualmente
            </p>
            <p className="flex items-center gap-2">
              <CheckIcon className="size-4 text-positive" /> Pacotes extras por loja
            </p>
          </div>
        </div>

        {billing.proActive ? (
          <div className="mt-6 rounded-2xl border border-positive/20 bg-positive-soft p-5 text-positive">
            <p className="font-black">Seu Pro está ativo.</p>
            <p className="mt-1 text-sm font-semibold leading-6">
              {billing.subscription
                ? `${paymentLabels[billing.subscription.payment_method] ?? billing.subscription.payment_method} · ${cycleLabels[billing.subscription.billing_cycle] ?? billing.subscription.billing_cycle}`
                : "Benefícios liberados."}
            </p>
          </div>
        ) : (
          <div className="mt-7 grid gap-4 lg:grid-cols-3">
            {billing.prices.map((price) => {
              const label = cycleLabels[price.billing_cycle] ?? price.billing_cycle;
              const monthlyEquivalent = Math.round(
                price.price_cents / price.interval_months,
              );
              return (
                <article
                  key={price.billing_cycle}
                  className="rounded-2xl border border-line bg-canvas p-5"
                >
                  <p className="text-sm font-black text-brand-dark">{label}</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-ink">
                    {money(price.price_cents)}
                  </p>
                  <p className="mt-1 text-xs font-bold text-muted">
                    {price.interval_months > 1
                      ? `equivale a ${money(monthlyEquivalent)}/mês`
                      : "cobrança mensal"}
                  </p>
                  <div className="mt-5 space-y-2">
                    <form action={startProCardCheckoutAction}>
                      <input
                        type="hidden"
                        name="billing_cycle"
                        value={price.billing_cycle}
                      />
                      <button
                        type="submit"
                        disabled={!providerConfigured}
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-black text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Assinar com cartão
                      </button>
                    </form>
                    <form action={startProPixCheckoutAction}>
                      <input
                        type="hidden"
                        name="billing_cycle"
                        value={price.billing_cycle}
                      />
                      <button
                        type="submit"
                        disabled={!providerConfigured}
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-black text-ink transition hover:border-brand/30 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Pagar período via Pix
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section
        id="lojas-adicionais"
        className="mt-8 scroll-mt-40 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
              Acima de 3 lojas
            </p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-black tracking-tight text-ink">
              <StoreIcon className="size-5" /> Loja adicional
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Cada compra acrescenta uma vaga enquanto o Pro estiver regular.
              Se o Pro vencer, as lojas excedentes são suspensas sem apagar os
              dados e retornam automaticamente após a regularização.
            </p>
          </div>
          {extraStore && (
            <div className="rounded-xl bg-canvas px-4 py-3 text-right">
              <p className="text-lg font-black text-ink">
                {money(extraStore.price_cents)}/mês
              </p>
              <p className="text-xs font-bold text-muted">por loja adicional</p>
            </div>
          )}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-canvas px-3 py-1.5 text-xs font-black text-muted">
            {billing.extraStoreSlots} adicional(is) ativa(s)
          </span>
          {billing.proActive && extraStore ? (
            <form action={startExtraStoreCheckoutAction}>
              <button
                type="submit"
                disabled={!providerConfigured}
                className="inline-flex min-h-11 items-center rounded-xl bg-ink px-4 text-sm font-black text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-45"
              >
                Comprar 1 loja adicional
              </button>
            </form>
          ) : (
            <a
              href="#calcadao-pro"
              className="text-sm font-black text-brand-dark underline underline-offset-4"
            >
              Ative o Pro para comprar vagas extras
            </a>
          )}
        </div>
      </section>

      <section
        id="promocoes-extras"
        className="mt-8 scroll-mt-40 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8"
      >
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
            Capacidade adicional
          </p>
          <h2 className="mt-2 flex items-center gap-2 text-2xl font-black tracking-tight text-ink">
            <TagIcon className="size-5" /> Pacotes de promoções
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Os pacotes são comprados para uma loja específica e aumentam o
            limite de cadastros daquela unidade em 5, 10, 20 ou 50 itens.
          </p>
        </div>

        {businesses.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-line bg-canvas p-5">
            <p className="text-sm font-bold text-muted">
              Cadastre uma loja antes de comprar promoções adicionais.
            </p>
            <Link
              href="/painel/loja"
              className="mt-3 inline-flex text-sm font-black text-brand-dark underline underline-offset-4"
            >
              Ir para Minhas lojas
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6 flex gap-2 overflow-x-auto">
              {businesses.map((business) => (
                <Link
                  key={business.id}
                  href={`/painel/assinatura?loja=${business.id}#promocoes-extras`}
                  className={`min-w-48 rounded-xl border px-4 py-3 transition ${
                    selectedBusiness?.id === business.id
                      ? "border-brand/35 bg-brand/8"
                      : "border-line bg-canvas hover:border-brand/25"
                  }`}
                >
                  <span className="block truncate text-sm font-black text-ink">
                    {business.name}
                  </span>
                  <span className="mt-1 block text-xs font-bold text-muted">
                    Limite atual: {billing.promotionLimitByBusiness[business.id] ?? 0}
                  </span>
                </Link>
              ))}
            </div>

            {selectedBusiness && (
              <div className="mt-5 rounded-2xl border border-line bg-canvas p-4">
                <p className="text-sm font-black text-ink">
                  {selectedBusiness.name}
                </p>
                <p className="mt-1 text-xs font-bold text-muted">
                  {billing.promotionPackUnitsByBusiness[selectedBusiness.id] ?? 0}{" "}
                  promoções extras compradas · limite total atual{" "}
                  {billing.promotionLimitByBusiness[selectedBusiness.id] ?? 0}
                </p>
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {promoPacks.map((product) => (
                <article
                  key={product.code}
                  className="rounded-2xl border border-line bg-canvas p-5"
                >
                  <p className="text-2xl font-black text-ink">+{product.units}</p>
                  <p className="mt-1 text-xs font-black uppercase tracking-[0.1em] text-muted">
                    promoções
                  </p>
                  <p className="mt-4 text-lg font-black text-brand-dark">
                    {money(product.price_cents)}
                  </p>
                  {billing.proActive && selectedBusiness ? (
                    <form action={startPromotionPackCheckoutAction} className="mt-4">
                      <input
                        type="hidden"
                        name="product_code"
                        value={product.code}
                      />
                      <input
                        type="hidden"
                        name="business_id"
                        value={selectedBusiness.id}
                      />
                      <button
                        type="submit"
                        disabled={!providerConfigured}
                        className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-brand px-3 text-sm font-black text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Comprar pacote
                      </button>
                    </form>
                  ) : (
                    <p className="mt-4 text-xs font-bold leading-5 text-muted">
                      Requer Pro ativo.
                    </p>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="mt-8 rounded-2xl border border-accent-dark/15 bg-accent/20 p-5">
        <p className="text-sm font-black text-ink">Proteção dos seus dados</p>
        <p className="mt-1 text-sm leading-6 text-muted">
          Vencimento de assinatura não exclui lojas nem promoções. O sistema
          reduz automaticamente a capacidade ao limite válido, suspende o
          excedente e libera novamente quando o pagamento for regularizado.
        </p>
      </div>
    </div>
  );
}
