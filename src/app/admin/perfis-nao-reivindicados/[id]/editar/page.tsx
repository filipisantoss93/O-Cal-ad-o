import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { updateUnclaimedBusinessAction } from "@/app/admin/perfis-nao-reivindicados/actions";
import { PreRegistrationLocationFields } from "@/components/admin/pre-registration-location-fields";
import { FloatingNotice } from "@/components/floating-notice";
import { ShieldCheckIcon } from "@/components/icons";
import { requireAdmin } from "@/lib/admin/dal";
import type { DatabaseWithBusinessClaims } from "@/types/business-claims";

export const metadata: Metadata = { title: "Editar perfil não reivindicado" };

const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink outline-none transition placeholder:text-muted/65 focus:border-brand focus:ring-4 focus:ring-brand/10";
const labelClass = "block text-sm font-extrabold text-ink";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; return_to?: string }>;
};

export default async function EditUnclaimedBusinessPage({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const businessId = Number(id);
  if (!Number.isInteger(businessId) || businessId <= 0) notFound();

  const returnTo = query.return_to === "/admin/reivindicacoes"
    ? "/admin/reivindicacoes"
    : "/admin/perfis-nao-reivindicados";
  const { supabase } = await requireAdmin(`/admin/perfis-nao-reivindicados/${businessId}/editar`);
  const client = supabase as unknown as SupabaseClient<DatabaseWithBusinessClaims>;

  const [businessResult, statesResult, categoriesResult] = await Promise.all([
    client
      .from("businesses")
      .select("id, name, slug, city_id, category_id, street, address_number, complement, neighborhood, postal_code, latitude, longitude, publication_status, data_source_url, pre_registered, owner_id, listing_type, cities(state_code)")
      .eq("id", businessId)
      .maybeSingle(),
    supabase.from("states").select("code, name").eq("is_active", true).order("name"),
    supabase.from("categories").select("id, name").eq("is_active", true).neq("slug", "locais-publicos").order("display_order").order("name"),
  ]);

  if (businessResult.error || statesResult.error || categoriesResult.error) {
    throw new Error("Não foi possível carregar os dados para edição.");
  }
  const business = businessResult.data;
  if (!business) notFound();
  if (!business.pre_registered || business.owner_id || business.listing_type !== "business") notFound();
  const city = Array.isArray(business.cities) ? business.cities[0] : business.cities;
  const stateCode = city?.state_code ?? "";

  return <div>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-positive">Administração</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">Editar perfil não reivindicado</h1>
        <p className="mt-2 max-w-3xl text-base leading-7 text-muted">Corrija informações factuais antes que o responsável reivindique a vitrine.</p>
      </div>
      <span className="inline-flex w-fit items-center gap-2 rounded-full bg-positive-soft px-4 py-2 text-sm font-black text-positive"><ShieldCheckIcon className="size-4" /> Edição administrativa</span>
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      <Link href={returnTo} className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-black text-ink">Voltar</Link>
      <Link href={`/loja/${business.slug}`} target="_blank" className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-black text-ink">Abrir perfil público</Link>
    </div>

    {query.erro && <FloatingNotice tone="error">{query.erro}</FloatingNotice>}

    <section className="mt-7 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8">
      <div className="rounded-2xl border border-brand/15 bg-brand/5 p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">Perfil pré-cadastrado</p>
        <p className="mt-1 text-lg font-black text-ink">{business.name}</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-muted">A edição é permitida apenas enquanto este perfil continuar sem proprietário.</p>
      </div>

      <form action={updateUnclaimedBusinessAction} className="mt-7 space-y-8">
        <input type="hidden" name="business_id" value={business.id} />
        <input type="hidden" name="return_to" value={returnTo} />

        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="col-span-full mb-1 text-lg font-black text-ink">Identificação</legend>
          <label className={`${labelClass} sm:col-span-2`} htmlFor="pre-name">Nome do estabelecimento<input className={inputClass} id="pre-name" name="name" minLength={2} maxLength={120} required defaultValue={business.name} /></label>
          <div className="sm:col-span-2"><PreRegistrationLocationFields states={(statesResult.data ?? []).map((state) => ({ code: state.code, name: state.name }))} initialStateCode={stateCode} initialCityId={business.city_id} /></div>
          <label className={`${labelClass} sm:col-span-2`} htmlFor="pre-category">Categoria principal<select className={inputClass} id="pre-category" name="category_id" defaultValue={String(business.category_id)} required>{(categoriesResult.data ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        </fieldset>

        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="col-span-full mb-1 text-lg font-black text-ink">Endereço comercial</legend>
          <label className={labelClass} htmlFor="pre-street">Rua ou avenida<input className={inputClass} id="pre-street" name="street" required maxLength={160} defaultValue={business.street} /></label>
          <label className={labelClass} htmlFor="pre-number">Número<input className={inputClass} id="pre-number" name="address_number" required maxLength={20} defaultValue={business.address_number} /></label>
          <label className={labelClass} htmlFor="pre-neighborhood">Bairro<input className={inputClass} id="pre-neighborhood" name="neighborhood" required maxLength={120} defaultValue={business.neighborhood} /></label>
          <label className={labelClass} htmlFor="pre-postal-code">CEP <span className="font-semibold text-muted">(opcional)</span><input className={inputClass} id="pre-postal-code" name="postal_code" inputMode="numeric" defaultValue={business.postal_code ?? ""} /></label>
          <label className={`${labelClass} sm:col-span-2`} htmlFor="pre-complement">Complemento <span className="font-semibold text-muted">(opcional)</span><input className={inputClass} id="pre-complement" name="complement" maxLength={120} defaultValue={business.complement ?? ""} /><span className="mt-1 block text-xs text-muted">Informe andar, sala, loja ou unidade quando empresas compartilham rua e número. Complementos diferentes permitem cadastros separados.</span></label>
          <label className={labelClass} htmlFor="pre-latitude">Latitude <span className="font-semibold text-muted">(opcional)</span><input className={inputClass} id="pre-latitude" name="latitude" inputMode="decimal" defaultValue={business.latitude ?? ""} /></label>
          <label className={labelClass} htmlFor="pre-longitude">Longitude <span className="font-semibold text-muted">(opcional)</span><input className={inputClass} id="pre-longitude" name="longitude" inputMode="decimal" defaultValue={business.longitude ?? ""} /></label>
        </fieldset>

        <fieldset className="grid gap-5">
          <legend className="mb-1 text-lg font-black text-ink">Controle administrativo</legend>
          <label className={labelClass} htmlFor="pre-source">Fonte consultada <span className="font-semibold text-muted">(opcional)</span><input className={inputClass} id="pre-source" name="data_source_url" placeholder="https://..." defaultValue={business.data_source_url ?? ""} /><span className="mt-1.5 block text-xs font-semibold text-muted">Campo interno para registrar de onde veio a correção.</span></label>
          <label className="flex items-start gap-3 rounded-2xl border border-line bg-canvas p-4 text-sm font-bold text-ink"><input type="checkbox" name="publication_status" defaultChecked={business.publication_status === "published"} className="mt-0.5 size-5 accent-[var(--color-brand)]" /><span>Perfil publicado<span className="mt-1 block text-xs font-semibold leading-5 text-muted">Desmarque apenas se o perfil precisar sair temporariamente do ar.</span></span></label>
        </fieldset>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-6 text-sm font-black text-white transition hover:bg-brand-dark">Salvar correções</button>
          <Link href={returnTo} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-white px-6 text-sm font-black text-ink">Cancelar</Link>
        </div>
      </form>
    </section>
  </div>;
}
