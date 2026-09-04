import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  EditIcon,
  PlusIcon,
  StoreIcon,
  TagIcon,
} from "@/components/icons";
import { getMerchantWorkspace } from "@/lib/merchant/dal";

export const metadata: Metadata = {
  title: "Painel do comerciante",
};

type DashboardPageProps = {
  searchParams: Promise<{ "boas-vindas"?: string }>;
};

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Em análise",
    className: "border-accent-dark/20 bg-accent/25 text-accent-dark",
  },
  approved: {
    label: "Publicada",
    className: "border-positive/20 bg-positive-soft text-positive",
  },
  rejected: {
    label: "Ajustes necessários",
    className: "border-brand/20 bg-brand/10 text-brand-dark",
  },
  suspended: {
    label: "Suspensa",
    className: "border-brand/20 bg-brand/10 text-brand-dark",
  },
};

const planLabels: Record<string, string> = {
  free: "Grátis",
  featured: "Destaque",
};

export default async function MerchantDashboard({
  searchParams,
}: DashboardPageProps) {
  const params = await searchParams;
  const { supabase, profile, business } = await getMerchantWorkspace("/painel");
  const firstName = profile?.full_name?.split(/\s+/)[0] || "Comerciante";

  let promotionsCount = 0;
  let activePromotions = 0;
  if (business) {
    const { data } = await supabase
      .from("promotions")
      .select("id, is_active, starts_at, ends_at")
      .eq("business_id", business.id);
    const now = new Date().getTime();
    promotionsCount = data?.length ?? 0;
    activePromotions =
      data?.filter(
        (promotion) =>
          promotion.is_active &&
          new Date(promotion.starts_at).getTime() <= now &&
          new Date(promotion.ends_at).getTime() >= now,
      ).length ?? 0;
  }

  const status = business
    ? statusLabels[business.status] ?? statusLabels.pending
    : null;

  return (
    <div>
      {params["boas-vindas"] === "1" && (
        <div
          role="status"
          className="mb-6 rounded-2xl border border-positive/20 bg-positive-soft p-4 text-sm font-bold text-positive"
        >
          Conta confirmada. Agora complete sua loja para começar.
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
            Área do comerciante
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">
            Olá, {firstName}.
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted">
            Acompanhe sua presença no O Calçadão e mantenha sua vitrine pronta
            para receber novos contatos.
          </p>
        </div>
        <Link
          href={business ? "/painel/promocoes#nova-promocao" : "/painel/loja"}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(185,61,37,0.2)] transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          {business ? (
            <>
              <PlusIcon className="size-4" />
              Nova promoção
            </>
          ) : (
            <>
              <StoreIcon className="size-4" />
              Cadastrar loja
            </>
          )}
        </Link>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <p className="text-sm font-bold text-muted">Minha loja</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xl font-black text-ink">
                {business?.name ?? "Não cadastrada"}
              </p>
              {status && (
                <span
                  className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${status.className}`}
                >
                  {status.label}
                </span>
              )}
            </div>
            <span className="grid size-11 place-items-center rounded-xl bg-brand/10 text-brand-dark">
              <StoreIcon className="size-5" />
            </span>
          </div>
        </article>

        <article className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <p className="text-sm font-bold text-muted">Promoções cadastradas</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-3xl font-black text-ink">{promotionsCount}</p>
            <span className="grid size-11 place-items-center rounded-xl bg-accent/25 text-accent-dark">
              <TagIcon className="size-5" />
            </span>
          </div>
          <p className="mt-2 text-xs font-bold text-muted">
            {activePromotions} ativa{activePromotions === 1 ? "" : "s"} agora
          </p>
        </article>

        <article className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:col-span-2 lg:col-span-1">
          <p className="text-sm font-bold text-muted">Plano atual</p>
          <p className="mt-4 text-xl font-black text-ink">
            {business ? planLabels[business.plan] ?? business.plan : "Grátis"}
          </p>
          <p className="mt-2 text-xs font-bold text-muted">
            Sem intermediação de pagamentos.
          </p>
        </article>
      </section>

      <section className="mt-8 rounded-[2rem] border border-line bg-surface p-6 shadow-sm sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
              Próximo passo
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">
              {business
                ? "Mantenha sua vitrine atualizada"
                : "Cadastre os dados da sua loja"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              {business
                ? "Revise endereço, WhatsApp, imagens e informações públicas. Alterações importantes voltam para análise."
                : "Informe endereço, categoria, WhatsApp e imagens. A equipe fará uma análise antes da publicação."}
            </p>
          </div>
          <span className="hidden size-12 place-items-center rounded-2xl bg-canvas text-brand-dark sm:grid">
            <EditIcon className="size-5" />
          </span>
        </div>
        <Link
          href="/painel/loja"
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-ink/10 px-4 text-sm font-black text-ink transition hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {business ? "Editar minha loja" : "Começar cadastro"}
          <ArrowRightIcon className="size-4" />
        </Link>
      </section>
    </div>
  );
}
