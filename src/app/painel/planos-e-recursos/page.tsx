import type { Metadata } from "next";
import Link from "next/link";
import { getMerchantBillingSummary } from "@/lib/merchant/billing";
import { getMerchantWorkspace } from "@/lib/merchant/dal";

export const metadata: Metadata = {
  title: "Planos e recursos",
};

const cycleLabels: Record<string, string> = {
  monthly: "Mensal",
  semiannual: "6 meses",
  annual: "12 meses",
};

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

const featureRows = [
  ["Vitrine comercial", "Sim", "Sim"],
  ["Produtos e serviços", "Sim", "Sim"],
  ["Endereço, localização e distância", "Sim", "Sim"],
  ["Contato direto pelo WhatsApp", "Sim", "Sim"],
  ["Aparecer nas buscas locais", "Sim", "Sim"],
  ["Comprar destaques e banners", "Sim", "Sim"],
] as const;

export default async function PlansAndFeaturesPage() {
  const { supabase, user, businesses } = await getMerchantWorkspace(
    "/painel/planos-e-recursos",
  );

  const [billing, rulesResult] = await Promise.all([
    getMerchantBillingSummary(supabase, user.id, businesses),
    supabase
      .from("billing_plan_rules")
      .select("code, name, included_businesses, included_promotions_per_business")
      .eq("is_active", true),
  ]);

  if (rulesResult.error) {
    throw new Error("Não foi possível carregar a comparação dos planos.");
  }

  const rules = rulesResult.data ?? [];
  const freeRule = rules.find((rule) => rule.code === "free") ?? {
    code: "free",
    name: "Grátis",
    included_businesses: 1,
    included_promotions_per_business: 2,
  };
  const proRule = rules.find((rule) => rule.code === "pro") ?? {
    code: "pro",
    name: "Calçadão Pro",
    included_businesses: 3,
    included_promotions_per_business: 10,
  };

  const extraStore = billing.products.find(
    (product) => product.code === "extra_store",
  );
  const promotionPacks = billing.products
    .filter((product) => product.kind === "promotion_pack")
    .sort((a, b) => a.units - b.units);

  return (
    <div>
      <div className="max-w-4xl">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
          Guia do comerciante
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">
          Planos e recursos
        </h1>
        <p className="mt-3 text-base leading-7 text-muted">
          Entenda o que cada parte do O Calçadão faz, o que está incluído no plano
          gratuito, o que muda no Pro e quais recursos são compras opcionais.
        </p>
      </div>

      <section className="mt-7 rounded-2xl border border-brand/20 bg-brand/5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-dark">
              Seu plano atual
            </p>
            <p className="mt-2 text-2xl font-black text-ink">
              {billing.proActive ? proRule.name : freeRule.name}
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 text-muted">
              {billing.proActive
                ? `${billing.storeLimit} vagas de loja disponíveis no momento.`
                : `${freeRule.included_businesses} loja e ${freeRule.included_promotions_per_business} promoções por loja sem mensalidade.`}
            </p>
          </div>
          <Link
            href="/painel/assinatura"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-black text-white transition hover:brightness-95"
          >
            Gerenciar assinatura
          </Link>
        </div>
      </section>

      <section className="mt-8">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
            Como funciona
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">
            O que é cada recurso
          </h2>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            {
              title: "Vitrine da loja",
              text: "É a página pública do seu negócio. Reúne apresentação, fotos, endereço, localização, WhatsApp, produtos, serviços e promoções.",
            },
            {
              title: "Produtos e serviços",
              text: "É o catálogo permanente do que sua empresa vende ou oferece. Ajuda o cliente a encontrar sua loja pelas buscas da plataforma.",
            },
            {
              title: "Promoções",
              text: "São ofertas com validade e destaque próprio. Elas têm limite por loja conforme o plano contratado.",
            },
            {
              title: "Localização",
              text: "Permite mostrar sua loja para consumidores da região e calcular a distância aproximada até o estabelecimento.",
            },
            {
              title: "Contato direto",
              text: "O cliente fala diretamente com a empresa pelo WhatsApp. O Calçadão não intermedeia a negociação nem o pagamento da compra.",
            },
            {
              title: "Publicidade",
              text: "Destaques e banners aumentam a exposição da loja. São opcionais, cobrados separadamente e não são necessários para manter a vitrine publicada.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-line bg-surface p-5 shadow-sm"
            >
              <h3 className="font-black text-ink">{item.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                {item.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-7">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
            Comparação
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">
            Free x Calçadão Pro
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            O Free já permite publicar e usar a plataforma. O Pro aumenta a
            capacidade da conta; ele não transforma publicidade paga em benefício
            incluso.
          </p>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[620px] border-collapse text-left text-sm">
            <thead className="bg-canvas">
              <tr>
                <th className="px-4 py-4 font-black text-ink">Recurso</th>
                <th className="px-4 py-4 font-black text-ink">Free</th>
                <th className="px-4 py-4 font-black text-brand-dark">Calçadão Pro</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line">
                <td className="px-4 py-4 font-bold text-ink">Lojas incluídas</td>
                <td className="px-4 py-4 font-semibold text-muted">
                  {freeRule.included_businesses}
                </td>
                <td className="px-4 py-4 font-black text-ink">
                  {proRule.included_businesses}
                </td>
              </tr>
              <tr className="border-t border-line">
                <td className="px-4 py-4 font-bold text-ink">Promoções por loja</td>
                <td className="px-4 py-4 font-semibold text-muted">
                  {freeRule.included_promotions_per_business}
                </td>
                <td className="px-4 py-4 font-black text-ink">
                  {proRule.included_promotions_per_business}
                </td>
              </tr>
              {featureRows.map(([feature, free, pro]) => (
                <tr key={feature} className="border-t border-line">
                  <td className="px-4 py-4 font-bold text-ink">{feature}</td>
                  <td className="px-4 py-4 font-semibold text-muted">✓ {free}</td>
                  <td className="px-4 py-4 font-semibold text-ink">✓ {pro}</td>
                </tr>
              ))}
              <tr className="border-t border-line">
                <td className="px-4 py-4 font-bold text-ink">Lojas adicionais</td>
                <td className="px-4 py-4 font-semibold text-muted">—</td>
                <td className="px-4 py-4 font-semibold text-ink">
                  Disponível como adicional
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {billing.prices.map((price) => (
            <article
              key={price.billing_cycle}
              className="rounded-2xl border border-line bg-canvas p-5"
            >
              <p className="text-sm font-black text-muted">
                {cycleLabels[price.billing_cycle] ?? price.billing_cycle}
              </p>
              <p className="mt-2 text-2xl font-black text-ink">
                {money(price.price_cents)}
              </p>
              <p className="mt-1 text-xs font-semibold text-muted">
                {price.interval_months === 1
                  ? "cobrança mensal"
                  : `período de ${price.interval_months} meses`}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-2">
        <article className="rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
            Capacidade extra
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">
            Adicionais do Pro
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Adicionais aumentam a capacidade da conta. Eles não são publicidade.
          </p>

          <div className="mt-5 space-y-3">
            {extraStore && (
              <div className="rounded-2xl border border-line bg-canvas p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-black text-ink">{extraStore.name}</p>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      Cobrança recorrente enquanto permanecer contratada.
                    </p>
                  </div>
                  <p className="shrink-0 font-black text-ink">
                    {money(extraStore.price_cents)}/mês
                  </p>
                </div>
              </div>
            )}

            {promotionPacks.map((pack) => (
              <div
                key={pack.code}
                className="rounded-2xl border border-line bg-canvas p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-black text-ink">+{pack.units} promoções</p>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      Compra única para a loja selecionada.
                    </p>
                  </div>
                  <p className="shrink-0 font-black text-ink">
                    {money(pack.price_cents)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[2rem] border border-accent-dark/20 bg-accent/10 p-5 shadow-sm sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-accent-dark">
            Visibilidade extra
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">
            Destaques e banners
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Publicidade é opcional e cobrada separadamente, tanto para usuários
            Free quanto para Pro. Ela aumenta a exposição; não interfere no direito
            de manter a loja publicada.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Destaque de categoria", "Prioridade dentro da categoria da loja."],
              ["Destaque da cidade", "Mais exposição na página inicial da cidade."],
              ["Cidade + categoria", "Combina os dois posicionamentos."],
              ["Banner regional", "Área publicitária de grande visibilidade na região."],
            ].map(([title, text]) => (
              <div key={title} className="rounded-2xl border border-accent-dark/15 bg-white p-4">
                <p className="font-black text-ink">{title}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-muted">{text}</p>
              </div>
            ))}
          </div>
          <Link
            href="/painel/destaques"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-accent-dark/20 bg-white px-5 text-sm font-black text-ink transition hover:bg-accent/10"
          >
            Ver opções de publicidade
          </Link>
        </article>
      </section>
    </div>
  );
}
