import type { Metadata } from "next";
import Link from "next/link";
import { setFeaturedPromotionAction } from "@/app/painel/promocoes/actions";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  StarIcon,
  StoreIcon,
  TagIcon,
} from "@/components/icons";
import {
  PromotionManager,
  type PromotionFormValue,
} from "@/components/merchant/promotion-manager";
import { getMerchantBillingSummary } from "@/lib/merchant/billing";
import { getMerchantWorkspace } from "@/lib/merchant/dal";
import { publicMediaUrl } from "@/lib/merchant/media";

type PromotionRow = {
  id: number;
  title: string;
  description: string | null;
  original_price: number | null;
  offer_price: number;
  starts_at: string;
  ends_at: string;
  image_path: string | null;
  is_active: boolean;
  is_featured: boolean;
  billing_suspended: boolean;
};

export const metadata: Metadata = {
  title: "Promoções",
};

type PromotionsPageProps = {
  searchParams: Promise<{ loja?: string }>;
};

function dateInSaoPaulo(value: Date | string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export default async function PromotionsPage({
  searchParams,
}: PromotionsPageProps) {
  const params = await searchParams;
  const { supabase, user, businesses } = await getMerchantWorkspace(
    "/painel/promocoes",
  );

  if (businesses.length === 0) {
    return (
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
          Promoções
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">
          Primeiro, cadastre sua loja.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
          Toda promoção precisa estar ligada a uma vitrine digital.
        </p>
        <div className="mt-8 rounded-[2rem] border border-line bg-surface p-7 shadow-sm">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand-dark">
            <StoreIcon className="size-5" />
          </span>
          <h2 className="mt-5 text-xl font-black text-ink">
            Complete o cadastro da loja
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Depois você poderá criar, editar, pausar e excluir promoções.
          </p>
          <Link
            href="/painel/loja"
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-black text-white transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            Cadastrar loja
            <ArrowRightIcon className="size-4" />
          </Link>
        </div>
      </div>
    );
  }

  const requestedId = Number(params.loja);
  const business =
    businesses.find(
      (item) => Number.isSafeInteger(requestedId) && item.id === requestedId,
    ) ?? businesses[0];
  const billing = await getMerchantBillingSummary(supabase, user.id, businesses);
  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Não foi possível carregar as promoções.");

  const rows = (data ?? []) as unknown as PromotionRow[];
  const promotions: PromotionFormValue[] = rows.map((promotion) => ({
    id: promotion.id,
    title: promotion.title,
    description: promotion.description ?? "",
    originalPrice: promotion.original_price,
    offerPrice: promotion.offer_price,
    startsOn: dateInSaoPaulo(promotion.starts_at),
    endsOn: dateInSaoPaulo(promotion.ends_at),
    isActive: promotion.is_active,
    billingSuspended: promotion.billing_suspended,
    imageUrl: publicMediaUrl(supabase, promotion.image_path),
  }));
  const todayDate = new Date();
  const suggestedEndDate = new Date(todayDate);
  suggestedEndDate.setDate(suggestedEndDate.getDate() + 7);
  const promotionLimit = billing.promotionLimitByBusiness[business.id] ?? 0;
  const canCreate =
    !business.billing_suspended && promotions.length < promotionLimit;

  return (
    <div>
      <div className="flex items-start gap-4">
        <span className="hidden size-12 place-items-center rounded-2xl bg-accent/25 text-accent-dark sm:grid">
          <TagIcon className="size-5" />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
            Ofertas das lojas
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">
            Promoções
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted">
            Cada loja tem sua própria cota. Ao atingir o limite, você pode
            comprar pacotes de 5, 10, 20 ou 50 promoções adicionais.
          </p>
        </div>
      </div>

      <section className="mt-7 rounded-2xl border border-line bg-surface p-3 shadow-sm">
        <div className="flex gap-2 overflow-x-auto">
          {businesses.map((item) => (
            <Link
              key={item.id}
              href={`/painel/promocoes?loja=${item.id}`}
              className={`min-w-48 rounded-xl border px-4 py-3 transition ${
                item.id === business.id
                  ? "border-brand/35 bg-brand/8"
                  : "border-line bg-canvas hover:border-brand/25"
              }`}
            >
              <span className="block truncate text-sm font-black text-ink">
                {item.name}
              </span>
              <span className="mt-1 block text-xs font-bold text-muted">
                {item.billing_suspended
                  ? "Suspensa pelo plano"
                  : `Limite: ${billing.promotionLimitByBusiness[item.id] ?? 0}`}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {business.billing_suspended && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-brand/20 bg-brand/8 p-4 text-brand-dark">
          <AlertTriangleIcon className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sm font-black">Esta loja está suspensa pelo plano</p>
            <p className="mt-1 text-sm leading-6">
              As promoções permanecem salvas e serão liberadas automaticamente
              quando a assinatura e a vaga da loja forem regularizadas.
            </p>
            <Link
              href="/painel/assinatura"
              className="mt-2 inline-flex text-sm font-black underline underline-offset-4"
            >
              Regularizar assinatura
            </Link>
          </div>
        </div>
      )}

      {business.publication_status !== "published" && !business.billing_suspended && (
        <div className="mt-6 rounded-2xl border border-brand/20 bg-brand/8 p-4 text-sm font-bold leading-6 text-brand-dark">
          As promoções continuam salvas, mas não aparecem ao público enquanto a vitrine estiver fora do ar.
        </div>
      )}

      {rows.length > 0 && (
        <section className="mt-8 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/30 text-ink">
              <StarIcon className="size-5" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
                Oferta em destaque
              </p>
              <h2 className="mt-1 text-xl font-black text-ink">
                Escolha a promoção que aparece primeiro
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Cada loja pode ter uma oferta destacada por vez. Trocar o destaque não apaga as outras promoções.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((promotion) => (
              <article
                key={promotion.id}
                className={`rounded-2xl border p-4 ${
                  promotion.is_featured
                    ? "border-accent-dark/30 bg-accent/20"
                    : "border-line bg-canvas"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-ink">{promotion.title}</p>
                    <p className="mt-1 text-xs font-bold text-muted">
                      {promotion.is_active ? "Ativa" : "Pausada"}
                    </p>
                  </div>
                  {promotion.is_featured && (
                    <span className="rounded-full bg-ink px-2.5 py-1 text-[0.65rem] font-black text-white">
                      DESTAQUE
                    </span>
                  )}
                </div>
                <form action={setFeaturedPromotionAction} className="mt-4">
                  <input type="hidden" name="business_id" value={business.id} />
                  <input type="hidden" name="promotion_id" value={promotion.id} />
                  <input
                    type="hidden"
                    name="next_featured"
                    value={promotion.is_featured ? "false" : "true"}
                  />
                  <button
                    type="submit"
                    className="min-h-10 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm font-black text-ink transition hover:border-brand/35"
                  >
                    {promotion.is_featured ? "Remover destaque" : "Destacar esta oferta"}
                  </button>
                </form>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8">
        <PromotionManager
          businessId={business.id}
          promotions={promotions}
          today={dateInSaoPaulo(todayDate)}
          suggestedEndDate={dateInSaoPaulo(suggestedEndDate)}
          limit={promotionLimit}
          canCreate={canCreate}
        />
      </div>
    </div>
  );
}
