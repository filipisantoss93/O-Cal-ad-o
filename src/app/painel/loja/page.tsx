import type { Metadata } from "next";
import { BusinessForm, type BusinessFormValue } from "@/components/merchant/business-form";
import {
  BusinessHoursForm,
  type BusinessHourValue,
} from "@/components/merchant/business-hours-form";
import { AlertTriangleIcon, StoreIcon } from "@/components/icons";
import { getMerchantWorkspace } from "@/lib/merchant/dal";
import { publicMediaUrl } from "@/lib/merchant/media";

export const metadata: Metadata = {
  title: "Minha loja",
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

export default async function BusinessPage() {
  const { supabase, business } = await getMerchantWorkspace("/painel/loja");
  const [statesResult, categoriesResult, cityResult, hoursResult] = await Promise.all([
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
            Vitrine digital
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">
            {business ? "Minha loja" : "Cadastrar minha loja"}
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted">
            Estas são as informações que ajudam as pessoas a encontrar e
            conhecer seu negócio.
          </p>
        </div>
        {status && (
          <span
            className={`inline-flex w-fit items-center rounded-full border px-3 py-1.5 text-sm font-black ${status.className}`}
          >
            {status.label}
          </span>
        )}
      </div>

      {business?.moderation_note && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-brand/20 bg-brand/8 p-4 text-brand-dark">
          <AlertTriangleIcon className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sm font-black">Ajuste solicitado</p>
            <p className="mt-1 text-sm leading-6">{business.moderation_note}</p>
          </div>
        </div>
      )}

      {!business && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-accent-dark/15 bg-accent/20 p-4 text-ink">
          <StoreIcon className="mt-0.5 size-5 shrink-0 text-accent-dark" />
          <p className="text-sm font-bold leading-6">
            Complete os dados abaixo. Sua loja ficará em análise e será
            publicada depois da aprovação.
          </p>
        </div>
      )}

      <section className="mt-7 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8">
        <BusinessForm
          business={formBusiness}
          states={(statesResult.data ?? []).map((state) => ({
            code: state.code,
            name: state.name,
          }))}
          initialCity={cityResult.data ? {
            id: cityResult.data.id,
            name: cityResult.data.name,
            stateCode: cityResult.data.state_code,
          } : null}
          categories={(categoriesResult.data ?? []).map((category) => ({
            id: category.id,
            label: category.name,
          }))}
        />
      </section>

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
              Informe quando sua loja está aberta ou marque funcionamento 24 horas.
            </p>
          </div>
          <BusinessHoursForm hours={businessHours} />
        </section>
      )}
    </div>
  );
}
