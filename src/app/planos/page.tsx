import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  ArrowRightIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StoreIcon,
  WhatsAppIcon,
} from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database-runtime";

export const metadata: Metadata = {
  title: "Planos para comerciantes",
  description:
    "Conheça o plano Grátis e o Calçadão Pro. Crie sua vitrine, publique produtos, serviços e promoções e seja encontrado na sua cidade.",
  alternates: {
    canonical: "/planos",
  },
};

export const revalidate = 300;

type PlanRule = {
  code: string;
  name: string;
  included_businesses: number;
  included_promotions_per_business: number;
  included_catalog_items: number;
};

type PlanPrice = {
  billing_cycle: string;
  interval_months: number;
  price_cents: number;
};

type BillingProduct = {
  code: string;
  name: string;
  kind: string;
  units: number;
  price_cents: number;
  billing_mode: string;
};

const fallbackFree: PlanRule = {
  code: "free",
  name: "Grátis",
  included_businesses: 1,
  included_promotions_per_business: 2,
  included_catalog_items: 4,
};

const fallbackPro: PlanRule = {
  code: "pro",
  name: "Calçadão Pro",
  included_businesses: 3,
  included_promotions_per_business: 10,
  included_catalog_items: 20,
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

async function getPublicBillingCatalog() {
  const { url, publishableKey } = getSupabaseEnv();
  const supabase = createClient<Database>(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const [rulesResult, pricesResult, productsResult] = await Promise.all([
    supabase
      .from("billing_plan_rules")
      .select(
        "code, name, included_businesses, included_promotions_per_business, included_catalog_items",
      )
      .eq("is_active", true),
    supabase
      .from("billing_plan_prices")
      .select("billing_cycle, interval_months, price_cents")
      .eq("plan_code", "pro")
      .eq("is_active", true)
      .order("interval_months"),
    supabase
      .from("billing_products")
      .select("code, name, kind, units, price_cents, billing_mode")
      .eq("is_active", true)
      .order("units"),
  ]);

  if (rulesResult.error) {
    console.error("Erro ao carregar regras públicas dos planos:", rulesResult.error);
  }
  if (pricesResult.error) {
    console.error("Erro ao carregar preços públicos dos planos:", pricesResult.error);
  }
  if (productsResult.error) {
    console.error("Erro ao carregar adicionais públicos:", productsResult.error);
  }

  const rules = (rulesResult.data ?? []) as PlanRule[];

  return {
    freeRule: rules.find((rule) => rule.code === "free") ?? fallbackFree,
    proRule: rules.find((rule) => rule.code === "pro") ?? fallbackPro,
    prices: (pricesResult.data ?? []) as PlanPrice[],
    products: (productsResult.data ?? []) as BillingProduct[],
  };
}

export default async function PublicPlansPage() {
  const { freeRule, proRule, prices, products } = await getPublicBillingCatalog();
  const extraStore = products.find((product) => product.code === "extra_store");
  const promotionPacks = products
    .filter((product) => product.kind === "promotion_pack")
    .sort((a, b) => a.units - b.units);

  const comparisonRows = [
    ["Vitrine comercial", "Sim", "Sim"],
    ["Lojas incluídas", String(freeRule.included_businesses), String(proRule.included_businesses)],
    [
      "Produtos e serviços por conta",
      String(freeRule.included_catalog_items),
      String(proRule.included_catalog_items),
    ],
    [
      "Promoções por loja",
      String(freeRule.included_promotions_per_business),
      String(proRule.included_promotions_per_business),
    ],
    ["Endereço, localização e distância", "Sim", "Sim"],
    ["Contato direto pelo WhatsApp", "Sim", "Sim"],
    ["Aparecer nas buscas locais", "Sim", "Sim"],
    ["Contratar destaque de loja", "Sim", "Sim"],
    ["Contratar banner regional", "Sim", "Sim"],
    ["Destacar uma promoção", "—", "Sim"],
    ["Desconto de 10% em publicidade", "—", "Sim"],
    ["Adicionais de capacidade", "—", "Sim"],
  ] as const;

  const benefits = [
    {
      title: "Sua própria vitrine",
      text: "Tenha uma página pública com apresentação, logo, capa, endereço, localização, horários e formas de contato.",
    },
    {
      title: "Produtos e serviços",
      text: "Mostre o que sua empresa vende ou oferece e ajude consumidores a encontrar exatamente o que procuram.",
    },
    {
      title: "Promoções",
      text: "Publique ofertas com validade para chamar atenção e transformar visitantes em novos contatos.",
    },
    {
      title: "Negócios próximos",
      text: "A localização permite aparecer para consumidores da região e mostrar a distância aproximada até o estabelecimento.",
    },
    {
      title: "WhatsApp direto",
      text: "O consumidor fala diretamente com sua empresa. O Calçadão não interfere na negociação nem cobra comissão sobre a venda.",
    },
    {
      title: "Mais formas de aparecer",
      text: "Quem quiser ampliar a exposição pode contratar destaques e banners publicitários separadamente.",
    },
  ];

  const faq = [
    {
      question: "Preciso pagar para cadastrar minha empresa?",
      answer: `Não. O plano ${freeRule.name} permite começar sem mensalidade, com ${freeRule.included_businesses} loja, até ${freeRule.included_catalog_items} produtos ou serviços e ${freeRule.included_promotions_per_business} promoções por loja.`,
    },
    {
      question: "O plano Grátis tem cobrança recorrente?",
      answer:
        "Não. O plano Grátis não possui mensalidade. Os limites e condições vigentes ficam sempre indicados nesta página.",
    },
    {
      question: "Preciso ser Pro para contratar um banner?",
      answer:
        "Não. Banners e destaques de loja são publicidade opcional e podem ser contratados separadamente por usuários Grátis e Pro.",
    },
    {
      question: "Posso destacar uma promoção no plano Grátis?",
      answer:
        "Não. O destaque de uma promoção específica é exclusivo para assinantes do Calçadão Pro.",
    },
    {
      question: "O Calçadão cobra comissão das minhas vendas?",
      answer:
        "Não. O Calçadão ajuda o consumidor a encontrar sua empresa, mas a negociação e o pagamento da compra acontecem diretamente entre vocês.",
    },
    {
      question: "Como o cliente entra em contato comigo?",
      answer:
        "A vitrine disponibiliza contato direto com a empresa, incluindo acesso ao WhatsApp cadastrado pelo comerciante.",
    },
    {
      question: "Posso cadastrar serviços ou somente produtos?",
      answer:
        "Pode cadastrar ambos. O catálogo foi feito para produtos e serviços e usa o mesmo limite de itens do plano contratado.",
    },
    {
      question: "Posso cadastrar mais de uma empresa?",
      answer: `O plano Grátis inclui ${freeRule.included_businesses} loja. O ${proRule.name} inclui até ${proRule.included_businesses} lojas e pode oferecer capacidade adicional conforme as opções disponíveis.`,
    },
    {
      question: "Minha vitrine passa por moderação?",
      answer:
        "Sim. As vitrines podem permanecer publicadas enquanto passam por moderação contínua. Conteúdos fora das regras podem receber solicitação de ajuste ou ter a publicação anulada.",
    },
    {
      question: "Posso cancelar o Pro?",
      answer:
        "O gerenciamento da assinatura é feito pelo painel do comerciante, conforme o ciclo contratado e as condições do meio de pagamento utilizado.",
    },
    {
      question: "Preciso instalar algum aplicativo?",
      answer:
        "Não. O Calçadão funciona pelo navegador e também pode ser instalado como PWA em dispositivos compatíveis.",
    },
  ];

  return (
    <>
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>
      <SiteHeader />

      <main id="conteudo">
        <section className="relative overflow-hidden border-b border-line bg-canvas px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent" />
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-brand-dark sm:text-sm">
                <StoreIcon className="size-4" />
                Para o comércio local
              </p>
              <h1 className="mt-4 max-w-4xl text-balance text-4xl font-black leading-[1.03] tracking-[-0.05em] text-ink sm:text-5xl lg:text-6xl">
                Coloque seu negócio no Centro Comercial da sua cidade.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
                Crie sua vitrine, publique produtos, serviços e promoções e seja
                encontrado por pessoas próximas ao seu negócio. Comece grátis e
                evolua para o Calçadão Pro quando precisar de mais capacidade.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/cadastro"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-black text-white shadow-[0_14px_28px_rgba(187,61,35,0.2)] transition hover:-translate-y-0.5 hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:text-base"
                >
                  Criar minha vitrine grátis
                  <ArrowRightIcon className="size-5" />
                </Link>
                <a
                  href="#comparar"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface px-6 text-sm font-black text-ink transition hover:border-ink/20 hover:bg-white sm:text-base"
                >
                  Ver comparação dos planos
                </a>
              </div>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-muted">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheckIcon className="size-4 text-positive" />
                  Sem comissão sobre suas vendas
                </span>
                <span className="inline-flex items-center gap-2">
                  <WhatsAppIcon className="size-4 text-positive" />
                  Contato direto com o cliente
                </span>
              </div>
            </div>

            <aside className="rounded-[2rem] border border-line bg-surface p-5 shadow-[0_28px_70px_rgba(31,45,42,0.12)] sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
                Comece sem custo
              </p>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-4xl font-black tracking-tight text-ink">R$ 0</span>
                <span className="pb-1 text-sm font-bold text-muted">no plano Grátis</span>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {[
                  [String(freeRule.included_businesses), "loja"],
                  [String(freeRule.included_catalog_items), "itens no catálogo"],
                  [String(freeRule.included_promotions_per_business), "promoções por loja"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl border border-line bg-canvas p-4">
                    <p className="text-2xl font-black text-ink">{value}</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-muted">{label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-sm font-semibold leading-6 text-muted">
                Sua vitrine pode incluir localização, horários, WhatsApp, catálogo e
                promoções. Publicidade é opcional e contratada separadamente.
              </p>
            </aside>
          </div>
        </section>

        <section className="bg-surface px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionIntro
              eyebrow="Mais visibilidade para seu negócio"
              title="Tudo o que você precisa para apresentar sua empresa na sua cidade."
              text="Uma presença local organizada para o consumidor descobrir o que você oferece e entrar em contato sem intermediários."
            />
            <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {benefits.map((benefit) => (
                <article key={benefit.title} className="rounded-2xl border border-line bg-canvas p-5">
                  <h3 className="font-black text-ink">{benefit.title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-muted">{benefit.text}</p>
                </article>
              ))}
            </div>
            <div className="mt-7">
              <PrimaryCta label="Criar minha vitrine grátis" />
            </div>
          </div>
        </section>

        <section className="bg-ink px-4 py-12 text-white sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-accent">Simples para começar</p>
            <h2 className="mt-2 max-w-3xl text-3xl font-black tracking-[-0.045em] sm:text-4xl">
              Sua empresa pode estar no Calçadão em poucos passos.
            </h2>
            <ol className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                ["01", "Crie sua conta", "Faça seu cadastro gratuitamente como comerciante."],
                ["02", "Monte sua vitrine", "Cadastre empresa, localização, fotos, horários e WhatsApp."],
                ["03", "Publique o que oferece", "Adicione produtos, serviços e promoções dentro do limite do seu plano."],
                ["04", "Comece a ser encontrado", "Sua empresa passa a fazer parte do Centro Comercial da sua região."],
              ].map(([number, title, text]) => (
                <li key={number} className="rounded-2xl border border-white/12 bg-white/[0.06] p-5">
                  <span className="text-xs font-black tracking-widest text-accent">{number}</span>
                  <h3 className="mt-5 text-lg font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/65">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="comparar" className="scroll-mt-24 bg-canvas px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionIntro
              eyebrow="Escolha o que faz sentido para você"
              title="Comece grátis. Cresça quando precisar."
              text="O plano Grátis já coloca sua empresa no Centro Comercial. O Pro aumenta sua capacidade e libera recursos exclusivos."
            />

            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              <article className="rounded-[2rem] border border-line bg-surface p-6 shadow-sm sm:p-8">
                <p className="text-sm font-black text-muted">{freeRule.name}</p>
                <p className="mt-3 text-4xl font-black tracking-tight text-ink">R$ 0</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                  Para colocar seu negócio na plataforma sem mensalidade.
                </p>
                <PlanList
                  items={[
                    `${freeRule.included_businesses} loja`,
                    `Até ${freeRule.included_catalog_items} produtos ou serviços`,
                    `Até ${freeRule.included_promotions_per_business} promoções por loja`,
                    "Vitrine comercial completa",
                    "Localização e distância aproximada",
                    "Contato direto pelo WhatsApp",
                    "Presença nas buscas locais",
                    "Pode contratar publicidade separadamente",
                  ]}
                />
                <div className="mt-7">
                  <PrimaryCta label="Começar grátis" full />
                </div>
              </article>

              <article className="relative overflow-hidden rounded-[2rem] border border-brand/25 bg-brand/5 p-6 shadow-[0_22px_55px_rgba(187,61,35,0.1)] sm:p-8">
                <div className="absolute right-5 top-5 rounded-full bg-brand px-3 py-1 text-xs font-black text-white">
                  Mais capacidade
                </div>
                <p className="text-sm font-black text-brand-dark">{proRule.name}</p>
                <p className="mt-3 text-3xl font-black tracking-tight text-ink">
                  Para negócios que querem crescer
                </p>
                <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-muted">
                  Mais lojas, mais itens, mais promoções e vantagens exclusivas para ampliar sua presença.
                </p>
                <PlanList
                  items={[
                    `Até ${proRule.included_businesses} lojas`,
                    `Até ${proRule.included_catalog_items} produtos ou serviços`,
                    `Até ${proRule.included_promotions_per_business} promoções por loja`,
                    "Todos os recursos do plano Grátis",
                    "Pode destacar uma promoção",
                    "10% de desconto em publicidade",
                    "Acesso a adicionais de capacidade",
                  ]}
                />
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <PrimaryCta label="Criar conta e conhecer o Pro" />
                  <a
                    href="#precos"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-brand/20 bg-white px-5 text-sm font-black text-brand-dark transition hover:bg-brand/5"
                  >
                    Ver preços
                  </a>
                </div>
              </article>
            </div>

            <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead className="bg-canvas">
                  <tr>
                    <th className="px-4 py-4 font-black text-ink">Recurso</th>
                    <th className="px-4 py-4 font-black text-ink">{freeRule.name}</th>
                    <th className="px-4 py-4 font-black text-brand-dark">{proRule.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map(([feature, free, pro]) => (
                    <tr key={feature} className="border-t border-line">
                      <td className="px-4 py-4 font-bold text-ink">{feature}</td>
                      <td className="px-4 py-4 font-semibold text-muted">{free === "Sim" ? "✓ " : ""}{free}</td>
                      <td className="px-4 py-4 font-semibold text-ink">{pro === "Sim" ? "✓ " : ""}{pro}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="precos" className="scroll-mt-24 bg-surface px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionIntro
              eyebrow="Planos flexíveis"
              title="Escolha o período que combina com seu negócio."
              text="Os valores abaixo vêm diretamente das configurações atuais da plataforma."
            />
            {prices.length > 0 ? (
              <div className="mt-7 grid gap-4 md:grid-cols-3">
                {prices.map((price) => (
                  <article key={price.billing_cycle} className="rounded-2xl border border-line bg-canvas p-6">
                    <p className="text-sm font-black text-muted">
                      {cycleLabels[price.billing_cycle] ?? price.billing_cycle}
                    </p>
                    <p className="mt-3 text-3xl font-black tracking-tight text-ink">{money(price.price_cents)}</p>
                    <p className="mt-2 text-xs font-semibold leading-5 text-muted">
                      {price.interval_months === 1
                        ? "Cobrança mensal."
                        : `Período contratado de ${price.interval_months} meses.`}
                    </p>
                    <Link
                      href="/cadastro"
                      className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-ink px-5 text-sm font-black text-white transition hover:bg-brand-dark"
                    >
                      Escolher {cycleLabels[price.billing_cycle]?.toLowerCase() ?? "plano"}
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-7 rounded-2xl border border-line bg-canvas p-6">
                <p className="font-black text-ink">Preços temporariamente indisponíveis.</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                  Você ainda pode criar sua conta gratuitamente e consultar as opções do Pro pelo painel.
                </p>
                <div className="mt-5"><PrimaryCta label="Criar conta grátis" /></div>
              </div>
            )}
          </div>
        </section>

        <section className="bg-canvas px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-2">
            <article className="rounded-[2rem] border border-accent-dark/20 bg-accent/10 p-6 sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-accent-dark">Quer mais visibilidade?</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">Publicidade é opcional.</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-muted">
                Você não precisa contratar publicidade para manter sua loja publicada. Destaques e banners servem para aumentar a exposição e são cobrados separadamente do plano.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ["Destaque na categoria", "Prioridade dentro da categoria da loja."],
                  ["Destaque na cidade", "Mais exposição para consumidores da cidade."],
                  ["Cidade + categoria", "Combina os dois posicionamentos."],
                  ["Banner regional", "Espaço publicitário de grande visibilidade na região."],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-2xl border border-accent-dark/15 bg-white p-4">
                    <p className="font-black text-ink">{title}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-muted">{text}</p>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-xs font-bold leading-5 text-muted">
                Banners e destaques de loja podem ser contratados no Grátis ou no Pro. O destaque de uma promoção específica é exclusivo do Pro.
              </p>
            </article>

            <article className="rounded-[2rem] border border-line bg-surface p-6 shadow-sm sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">Precisa de mais espaço?</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink">Adicionais do Pro.</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-muted">
                Adicionais aumentam a capacidade da conta. Eles não são publicidade e não aumentam automaticamente a posição da empresa nas buscas.
              </p>
              <div className="mt-5 space-y-3">
                {extraStore && (
                  <div className="rounded-2xl border border-line bg-canvas p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-black text-ink">{extraStore.name}</p>
                        <p className="mt-1 text-xs font-semibold text-muted">Capacidade adicional de loja.</p>
                      </div>
                      <p className="shrink-0 font-black text-ink">{money(extraStore.price_cents)}/mês</p>
                    </div>
                  </div>
                )}
                {promotionPacks.map((pack) => (
                  <div key={pack.code} className="rounded-2xl border border-line bg-canvas p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-black text-ink">+{pack.units} promoções</p>
                        <p className="mt-1 text-xs font-semibold text-muted">Compra única para a loja selecionada.</p>
                      </div>
                      <p className="shrink-0 font-black text-ink">{money(pack.price_cents)}</p>
                    </div>
                  </div>
                ))}
                {!extraStore && promotionPacks.length === 0 && (
                  <p className="rounded-2xl border border-line bg-canvas p-4 text-sm font-semibold text-muted">
                    As opções adicionais aparecem aqui quando estiverem disponíveis.
                  </p>
                )}
              </div>
            </article>
          </div>
        </section>

        <section className="bg-surface px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionIntro
              eyebrow="Feito para negócios locais"
              title="Se você atende sua cidade, sua empresa pode estar aqui."
              text="O Calçadão foi pensado para lojas, serviços e profissionais que querem ser encontrados por consumidores da própria região."
            />
            <div className="mt-7 flex flex-wrap gap-2">
              {[
                "Roupas e calçados",
                "Mercados e comércio de bairro",
                "Oficinas e serviços automotivos",
                "Salões e barbearias",
                "Restaurantes e alimentação",
                "Profissionais autônomos",
                "Prestadores de serviços",
                "Academias e bem-estar",
                "Tecnologia",
                "Construção e manutenção",
                "Pet shops",
                "Outros negócios locais",
              ].map((item) => (
                <span key={item} className="rounded-full border border-line bg-canvas px-4 py-2 text-sm font-bold text-ink">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-ink px-4 py-12 text-white sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-accent">Sem complicação</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">O cliente encontra. Você negocia.</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-white/70 sm:text-base">
                O Calçadão funciona como uma ponte entre consumidores e empresas da mesma região. A negociação e o pagamento continuam acontecendo diretamente entre você e seu cliente.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Sem comissão sobre suas vendas",
                "Contato direto com o cliente",
                "WhatsApp da própria empresa",
                "Presença local",
                "Plano gratuito disponível",
                "Publicidade opcional",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/12 bg-white/[0.06] p-4 text-sm font-black">
                  ✓ {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-canvas px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <SectionIntro eyebrow="Dúvidas frequentes" title="Antes de começar." text="As respostas mais importantes sobre cadastro, planos, publicidade e funcionamento da plataforma." />
            <div className="mt-7 space-y-3">
              {faq.map((item) => (
                <details key={item.question} className="group rounded-2xl border border-line bg-surface p-5 shadow-sm">
                  <summary className="cursor-pointer list-none pr-6 font-black text-ink marker:hidden">
                    {item.question}
                  </summary>
                  <p className="mt-3 text-sm font-semibold leading-6 text-muted">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-accent px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 rounded-[2rem] border border-ink/10 bg-[#ffd766] p-6 sm:p-10 lg:flex-row lg:items-center lg:justify-between lg:p-12">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-ink/70">
                <SparklesIcon className="size-4" />
                Sua empresa pode começar grátis
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">
                Faça parte do Centro Comercial da sua cidade.
              </h2>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-ink/70 sm:text-base">
                Crie sua vitrine e comece a mostrar seus produtos, serviços e promoções. Contrate o Pro somente quando precisar de mais capacidade.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <PrimaryCta label="Criar minha vitrine grátis" />
              <Link
                href="/entrar"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-ink/15 bg-white/70 px-6 text-sm font-black text-ink transition hover:bg-white"
              >
                Já tenho conta
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function SectionIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">{title}</h2>
      <p className="mt-3 text-sm font-semibold leading-7 text-muted sm:text-base">{text}</p>
    </div>
  );
}

function PlanList({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm font-semibold leading-6 text-ink">
          <span className="mt-0.5 font-black text-positive">✓</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PrimaryCta({ label, full = false }: { label: string; full?: boolean }) {
  return (
    <Link
      href="/cadastro"
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-black text-white shadow-[0_12px_25px_rgba(187,61,35,0.18)] transition hover:-translate-y-0.5 hover:bg-brand-dark ${full ? "w-full" : ""}`}
    >
      {label}
      <ArrowRightIcon className="size-4" />
    </Link>
  );
}
