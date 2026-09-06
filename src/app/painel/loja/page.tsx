import type { Metadata } from "next";
import Link from "next/link";
import {
  BusinessForm,
  type BusinessFormValue,
} from "@/components/merchant/business-form";
import {
  BusinessHoursForm,
  type BusinessHourValue,
} from "@/components/merchant/business-hours-form";
import {
  AlertTriangleIcon,
  PlusIcon,
  SparklesIcon,
  StoreIcon,
} from "@/components/icons";
import { getMerchantBillingSummary } from "@/lib/merchant/billing";
import { getMerchantWorkspace } from "@/lib/merchant/dal";
import { publicMediaUrl } from "@/lib/merchant/media";

export const metadata: Metadata = {
  title: "Minhas lojas",
};

type BusinessPageProps = {
  searchParams: Promise<{ loja?: string; nova?: string }>;
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
    label: "Suspensa pela moderação",
    className: "border-brand/20 bg-brand/10 text-brand-dark",
  },
};

export default async function BusinessPage({ searchParams }: BusinessPageProps) {
  const params = await searchParams;
  const { supabase, user, businesses } = await getMerchantWorkspace(
    "/painel/loja",
  );
  const billing = await getMerchantBillingSummary(supabase, user.id, businesses);
  const requestedId = Number(params.loja);
  const creating = params.nova === "1" || businesses.length === 0;
  const business = creating
    ? null
    : businesses.find(
        (item) => Number.isSafeInteger(requestedId) && item.id === requestedId,
      ) ??
      businesses[0] ??
      null;
  const canAddStore = businesses.length < billing.storeLimit;

  const [statesResult, categoriesResult, cityResult, hoursResult] =
    await Promise.all([
      supabase
        .from("states")
        .select("code, name")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("categories")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order")
        .order("name"),
      business
        ? supabase
            .from("cities")
            .select("id, name, state_code")
            .eq("id", business.city_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      business
        ? supabase
            .from("business_hours")
            .select("weekday, opens_at, closes_at, is_closed")
            .eq("business_id", business.id)
            .eq("display_order", 0)
            .order("weekday")
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (
    statesResult.error ||
    categoriesResult.error ||
    cityResult.error ||
    hoursResult.error
  ) {
    throw new Error("Não foi possível carregar as opções da loja.");
  }

  const formBusiness: BusinessFormValue = business
    ? {
        id: business.id,
        cityId: business.city_id,
        categoryId: business.category_id,
        name: business.name,
        slug: business.slug,
        description: business.description ?? "",
        whatsapp: business.whatsapp_e164,
        publicEmail: business.public_email ?? "",
        websiteUrl: business.website_url ?? "",
        street: business.street,
        addressNumber: business.address_number,
        complement: business.complement ?? "",
        neighborhood: business.neighborhood,
        postalCode: business.postal_code ?? "",
        latitude: business.latitude,
        longitude: business.longitude,
        isActive: business.is_active,
        logoUrl: publicMediaUrl(supabase, business.logo_path),
        coverUrl: publicMediaUrl(supabase, business.cover_path),
      }
    : null;
  const status = business
    ? statusLabels[business.status] ?? statusLabels.pending
    : null;
  const businessHours: BusinessHourValue[] = (hoursResult.data ?? []).map(
    (hour) => ({
      weekday: hour.weekday,
      opensAt: hour.opens_at,
      closesAt: hour.closes_at,
      isClosed: hour.is_closed,
    }),
  );

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
            Vitrines digitais
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">
            Minhas lojas
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted">
            Administre cada unidade separadamente. Seu plano atual permite até{" "}
            <strong className="text-ink">{billing.storeLimit}</strong> loja
            {billing.storeLimit === 1 ? "" : "s"} ativa
            {billing.storeLimit === 1 ? "" : "s"}.
          </p>
        </div>
        {canAddStore ? (
          <Link
            href="/painel/loja?nova=1"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-black text-white transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <PlusIcon className="size-4" />
            Adicionar loja
          </Link>
        ) : (
          <Link
            href="/painel/assinatura#lojas-adicionais"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-black text-white transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <SparklesIcon className="size-4" />
            Comprar mais lojas
          </Link>
        )}
      </div>

      {businesses.length > 0 && (
        <section className="mt-7 rounded-2xl border border-line bg-surface p-3 shadow-sm">
          <div className="flex gap-2 overflow-x-auto">
            {businesses.map((item, index) => {
              const selected = business?.id === item.id && !creating;
              return (
                <Link
                  key={item.id}
                  href={`/painel/loja?loja=${item.id}`}
                  className={`min-w-48 rounded-xl border px-4 py-3 transition ${
                    selected
                      ? "border-brand/35 bg-brand/8"
                      : "border-line bg-canvas hover:border-brand/25"
                  }`}
                >
                  <span className="block text-xs font-black uppercase tracking-[0.1em] text-muted">
                    Loja {index + 1}
                  </span>
                  <span className="mt-1 block truncate text-sm font-black text-ink">
                    {item.name}
                  </span>
                  {item.billing_suspended && (
                    <span className="mt-1 block text-xs font-black text-brand-dark">
                      Suspensa pelo plano
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {business?.billing_suspended && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-brand/20 bg-brand/8 p-4 text-brand-dark">
          <AlertTriangleIcon className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sm font-black">Loja suspensa pelo limite do plano</p>
            <p className="mt-1 text-sm leading-6">
              Os dados foram preservados. Esta loja volta a ficar disponível
              automaticamente assim que o plano Pro ou a vaga adicional for
              regularizada.
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

      {business?.moderation_note && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-brand/20 bg-brand/8 p-4 text-brand-dark">
          <AlertTriangleIcon className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sm font-black">Ajuste solicitado</p>
            <p className="mt-1 text-sm leading-6">{business.moderation_note}</p>
          </div>
        </div>
      )}

      {status && !business?.billing_suspended && (
        <div className="mt-6">
          <span
            className={`inline-flex w-fit items-center rounded-full border px-3 py-1.5 text-sm font-black ${status.className}`}
          >
            {status.label}
          </span>
        </div>
      )}

      {creating && canAddStore && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-accent-dark/15 bg-accent/20 p-4 text-ink">
          <StoreIcon className="mt-0.5 size-5 shrink-0 text-accent-dark" />
          <p className="text-sm font-bold leading-6">
            Cadastre uma nova unidade. Ela terá endereço, horários, promoções e
            moderação próprios.
          </p>
        </div>
      )}

      {creating && !canAddStore ? (
        <section className="mt-7 rounded-[2rem] border border-line bg-surface p-7 text-center shadow-sm sm:p-10">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand/10 text-brand-dark">
            <SparklesIcon className="size-6" />
          </span>
          <h2 className="mt-4 text-2xl font-black text-ink">
            Limite de lojas atingido
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
            O Pro inclui até 3 lojas. Depois disso, novas vagas são compradas
            individualmente e permanecem vinculadas à assinatura.
          </p>
          <Link
            href="/painel/assinatura#lojas-adicionais"
            className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-brand px-5 text-sm font-black text-white"
          >
            Ver lojas adicionais
          </Link>
        </section>
      ) : (
        <section className="mt-7 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8">
          <BusinessForm
            business={formBusiness}
            states={(statesResult.data ?? []).map((state) => ({
              code: state.code,
              name: state.name,
            }))}
            initialCity={
              cityResult.data
                ? {
                    id: cityResult.data.id,
                    name: cityResult.data.name,
                    stateCode: cityResult.data.state_code,
                  }
                : null
            }
            categories={(categoriesResult.data ?? []).map((category) => ({
              id: category.id,
              label: category.name,
            }))}
          />
        </section>
      )}

      {business && (
        <section className="mt-7 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
              Atendimento
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">
              Horário de funcionamento
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Informe quando esta unidade está aberta ou marque funcionamento 24
              horas.
            </p>
          </div>
          <BusinessHoursForm businessId={business.id} hours={businessHours} />
        </section>
      )}
    </div>
  );
}
