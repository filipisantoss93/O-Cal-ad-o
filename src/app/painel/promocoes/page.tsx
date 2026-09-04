import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, StoreIcon, TagIcon } from "@/components/icons";
import {
  PromotionManager,
  type PromotionFormValue,
} from "@/components/merchant/promotion-manager";
import { getMerchantWorkspace } from "@/lib/merchant/dal";
import { publicMediaUrl } from "@/lib/merchant/media";

export const metadata: Metadata = {
  title: "Promoções",
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

export default async function PromotionsPage() {
  const { supabase, business } = await getMerchantWorkspace(
    "/painel/promocoes",
  );

  if (!business) {
    return (
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
          Promoções
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">
          Primeiro, cadastre sua loja.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
          Toda promoção precisa estar ligada à sua vitrine digital.
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

  const { data, error } = await supabase
    .from("promotions")
    .select(
      "id, title, description, original_price, offer_price, starts_at, ends_at, image_path, is_active",
    )
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Não foi possível carregar as promoções.");

  const promotions: PromotionFormValue[] = (data ?? []).map((promotion) => ({
    id: promotion.id,
    title: promotion.title,
    description: promotion.description ?? "",
    originalPrice: promotion.original_price,
    offerPrice: promotion.offer_price,
    startsOn: dateInSaoPaulo(promotion.starts_at),
    endsOn: dateInSaoPaulo(promotion.ends_at),
    isActive: promotion.is_active,
    imageUrl: publicMediaUrl(supabase, promotion.image_path),
  }));
  const todayDate = new Date();
  const suggestedEndDate = new Date(todayDate);
  suggestedEndDate.setDate(suggestedEndDate.getDate() + 7);

  return (
    <div>
      <div className="flex items-start gap-4">
        <span className="hidden size-12 place-items-center rounded-2xl bg-accent/25 text-accent-dark sm:grid">
          <TagIcon className="size-5" />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
            Ofertas da loja
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">
            Promoções
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted">
            Crie ofertas com período definido e controle quando cada uma fica
            disponível.
          </p>
        </div>
      </div>

      {business.status !== "approved" && (
        <div className="mt-6 rounded-2xl border border-accent-dark/15 bg-accent/20 p-4 text-sm font-bold leading-6 text-ink">
          Você já pode preparar suas promoções. Elas aparecerão para o público
          depois que a loja for aprovada.
        </div>
      )}

      <div className="mt-8">
        <PromotionManager
          promotions={promotions}
          today={dateInSaoPaulo(todayDate)}
          suggestedEndDate={dateInSaoPaulo(suggestedEndDate)}
        />
      </div>
    </div>
  );
}
