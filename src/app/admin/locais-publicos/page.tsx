import type { Metadata } from "next";
import Link from "next/link";
import {
  savePublicPlaceHoursAction,
} from "@/app/admin/actions";
import {
  PublicPlaceForm,
  type PublicPlaceFormValue,
} from "@/components/admin/public-place-form";
import { MapPinIcon, PlusIcon, ShieldCheckIcon } from "@/components/icons";
import {
  BusinessHoursForm,
  type BusinessHourValue,
} from "@/components/merchant/business-hours-form";
import { requireAdmin } from "@/lib/admin/dal";
import type { CityOption, StateOption } from "@/lib/location";
import type { PublicPlaceKind } from "@/types/catalog";

export const metadata: Metadata = { title: "Locais públicos" };
export const dynamic = "force-dynamic";

const kindLabels: Record<PublicPlaceKind, string> = {
  government: "Atendimento governamental",
  health: "Saúde",
  education: "Educação",
  transport: "Transporte",
  safety: "Segurança e emergência",
  culture: "Cultura",
  leisure: "Lazer e áreas públicas",
  social_service: "Assistência e serviço social",
  other: "Outro serviço público",
};

export default async function PublicPlacesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ local?: string; novo?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin("/admin/locais-publicos");
  const requestedId = Number(params.local);

  const [statesResult, placesResult, assisResult] = await Promise.all([
    supabase
      .from("states")
      .select("code, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("businesses")
      .select(
        "id, city_id, public_place_kind, name, slug, description, tags, whatsapp_e164, phone_e164, public_email, website_url, instagram_url, facebook_url, official_source_url, street, address_number, complement, neighborhood, postal_code, latitude, longitude, is_active, publication_status, created_at, cities(name, state_code)",
      )
      .eq("listing_type", "public_place")
      .order("name")
      .limit(200),
    supabase
      .from("cities")
      .select("id, name, state_code")
      .eq("slug", "assis-sp")
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (statesResult.error || placesResult.error || assisResult.error || !assisResult.data) {
    throw new Error("Não foi possível carregar a gestão de locais públicos.");
  }

  const places = placesResult.data ?? [];
  // A listagem exibe so os 200 primeiros locais. Permitir editar diretamente
  // qualquer registro apontado pela fila SEO, sem depender da posicao na lista.
  const requestedPlaceResult = params.novo !== "1" && Number.isSafeInteger(requestedId) && requestedId > 0
    ? await supabase.from("businesses")
        .select("id, city_id, public_place_kind, name, slug, description, tags, whatsapp_e164, phone_e164, public_email, website_url, instagram_url, facebook_url, official_source_url, street, address_number, complement, neighborhood, postal_code, latitude, longitude, is_active, publication_status, created_at, cities(name, state_code)")
        .eq("id", requestedId)
        .eq("listing_type", "public_place")
        .maybeSingle()
    : { data: null, error: null };
  if (requestedPlaceResult.error) throw new Error("Não foi possível localizar o local público solicitado.");
  const editing = params.novo === "1"
    ? null
    : places.find((place) => Number.isSafeInteger(requestedId) && place.id === requestedId)
      ?? requestedPlaceResult.data
      ?? null;
  const [editingCityResult, hoursResult] = await Promise.all([
    editing && editing.city_id !== assisResult.data.id
      ? supabase
          .from("cities")
          .select("id, name, state_code")
          .eq("id", editing.city_id)
          .maybeSingle()
      : Promise.resolve({ data: assisResult.data, error: null }),
    editing
      ? supabase
          .from("business_hours")
          .select("weekday, opens_at, closes_at, is_closed")
          .eq("business_id", editing.id)
          .eq("display_order", 0)
          .order("weekday")
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (editingCityResult.error || !editingCityResult.data || hoursResult.error) {
    throw new Error("Não foi possível carregar os dados do local público.");
  }

  const states: StateOption[] = statesResult.data.map((state) => ({
    code: state.code,
    name: state.name,
  }));
  const initialCity: CityOption = {
    id: editingCityResult.data.id,
    name: editingCityResult.data.name,
    stateCode: editingCityResult.data.state_code,
  };
  const formValue: PublicPlaceFormValue = editing
    ? {
        id: editing.id,
        cityId: editing.city_id,
        kind: editing.public_place_kind as PublicPlaceKind,
        name: editing.name,
        slug: editing.slug,
        description: editing.description ?? "",
        tags: editing.tags ?? [],
        whatsapp: editing.whatsapp_e164 ?? "",
        phone: editing.phone_e164 ?? "",
        publicEmail: editing.public_email ?? "",
        websiteUrl: editing.website_url ?? "",
        instagramUrl: editing.instagram_url ?? "",
        facebookUrl: editing.facebook_url ?? "",
        officialSourceUrl: editing.official_source_url ?? "",
        street: editing.street,
        addressNumber: editing.address_number,
        complement: editing.complement ?? "",
        neighborhood: editing.neighborhood,
        postalCode: editing.postal_code ?? "",
        latitude: editing.latitude,
        longitude: editing.longitude,
        isActive: editing.is_active,
        isPublished: editing.publication_status === "published",
      }
    : null;
  const hours: BusinessHourValue[] = (hoursResult.data ?? []).map((hour) => ({
    weekday: hour.weekday,
    opensAt: hour.opens_at,
    closesAt: hour.closes_at,
    isClosed: hour.is_closed,
  }));

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-positive">Administração</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">Locais públicos</h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted">
            Cadastre serviços e equipamentos públicos sem vinculá-los a um comerciante, plano ou vitrine de produtos.
          </p>
        </div>
        <Link
          href="/admin/locais-publicos?novo=1"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-black text-white transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <PlusIcon className="size-4" /> Novo local
        </Link>
      </header>

      <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-8">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-dark">Cadastro administrativo</p>
            <h2 className="mt-1 text-2xl font-black text-ink">{editing ? `Editar ${editing.name}` : "Adicionar local público"}</h2>
          </div>
          {editing && (
            <Link href={`/loja/${editing.slug}?preview=admin`} target="_blank" className="text-sm font-black text-brand-dark underline underline-offset-4">
              Visualizar cadastro
            </Link>
          )}
        </div>
        <PublicPlaceForm
          key={editing?.id ?? "new"}
          publicPlace={formValue}
          states={states}
          initialCity={initialCity}
        />
      </section>

      {editing && (
        <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-dark">Funcionamento</p>
            <h2 className="mt-1 text-2xl font-black text-ink">Horários de {editing.name}</h2>
          </div>
          <BusinessHoursForm
            key={`hours-${editing.id}`}
            businessId={editing.id}
            hours={hours}
            saveAction={savePublicPlaceHoursAction}
            subjectLabel="o local"
          />
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-dark">Cadastros existentes</p>
            <h2 className="mt-1 text-2xl font-black text-ink">{places.length} {places.length === 1 ? "local" : "locais"}</h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-positive-soft px-3 py-1.5 text-xs font-black text-positive">
            <ShieldCheckIcon className="size-4" /> Gestão exclusiva do admin
          </span>
        </div>

        {places.length ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {places.map((place) => {
              const city = Array.isArray(place.cities) ? place.cities[0] : place.cities;
              const active = place.is_active && place.publication_status === "published";
              return (
                <article key={place.id} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-wider text-brand-dark">
                        {kindLabels[place.public_place_kind as PublicPlaceKind] ?? "Local público"}
                      </p>
                      <h3 className="mt-1 text-lg font-black text-ink">{place.name}</h3>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-black ${active ? "bg-positive-soft text-positive" : "bg-brand/8 text-brand-dark"}`}>
                      {active ? "Publicado" : "Fora do ar"}
                    </span>
                  </div>
                  <p className="mt-3 flex items-start gap-2 text-sm font-semibold leading-6 text-muted">
                    <MapPinIcon className="mt-1 size-4 shrink-0 text-brand" />
                    {place.street}, {place.address_number} · {place.neighborhood} · {city?.name}/{city?.state_code}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Link href={`/admin/locais-publicos?local=${place.id}`} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-ink px-4 text-sm font-black text-white">Editar</Link>
                    <Link href={`/loja/${place.slug}?preview=admin`} target="_blank" className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-black text-ink">Visualizar</Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-3xl border border-dashed border-line bg-surface p-8 text-center text-sm font-semibold text-muted">
            Nenhum local público cadastrado.
          </div>
        )}
      </section>
    </div>
  );
}
