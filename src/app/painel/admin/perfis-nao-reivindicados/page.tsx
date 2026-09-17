import type { Metadata } from "next";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createUnclaimedBusinessAction } from "@/app/painel/admin/perfis-nao-reivindicados/actions";
import { PreRegistrationLocationFields } from "@/components/admin/pre-registration-location-fields";
import { FloatingNotice } from "@/components/floating-notice";
import { ShieldCheckIcon, StoreIcon } from "@/components/icons";
import { requireAdmin } from "@/lib/admin/dal";
import type { DatabaseWithBusinessClaims } from "@/types/business-claims";

export const metadata: Metadata = { title: "Perfis não reivindicados" };
const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink outline-none transition placeholder:text-muted/65 focus:border-brand focus:ring-4 focus:ring-brand/10";
const labelClass = "block text-sm font-extrabold text-ink";
type PageProps = { searchParams: Promise<{ sucesso?: string; erro?: string }> };

export default async function UnclaimedBusinessesAdminPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { supabase } = await requireAdmin("/painel/admin/perfis-nao-reivindicados");
  const client = supabase as unknown as SupabaseClient<DatabaseWithBusinessClaims>;
  const [statesResult, categoriesResult, businessesResult] = await Promise.all([
    supabase.from("states").select("code, name").eq("is_active", true).order("name"),
    supabase.from("categories").select("id, name").eq("is_active", true).neq("slug", "locais-publicos").order("display_order").order("name"),
    client.from("businesses").select("id, name, slug, publication_status, street, address_number, neighborhood, cities(name, state_code)").eq("pre_registered", true).is("owner_id", null).eq("listing_type", "business").order("created_at", { ascending: false }).limit(50),
  ]);
  if (statesResult.error || categoriesResult.error || businessesResult.error) throw new Error("Não foi possível carregar os perfis não reivindicados.");

  return <div>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-positive">Administração</p>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">Perfis não reivindicados</h1>
      <p className="mt-2 max-w-3xl text-base leading-7 text-muted">Cadastre somente informações factuais. O responsável poderá reivindicar o estabelecimento depois e completar a vitrine.</p>
    </div><span className="inline-flex w-fit items-center gap-2 rounded-full bg-positive-soft px-4 py-2 text-sm font-black text-positive"><ShieldCheckIcon className="size-4" /> Cadastro informativo</span></div>
    <div className="mt-4 flex flex-wrap gap-2">
      <Link href="/painel/admin" className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-black text-ink hover:border-brand/40">Voltar para moderação</Link>
      <Link href="/painel/admin/reivindicacoes" className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-black text-ink hover:border-brand/40">Reivindicações e correções</Link>
    </div>
    {params.sucesso && <FloatingNotice tone="success">{params.sucesso}</FloatingNotice>}
    {params.erro && <FloatingNotice tone="error">{params.erro}</FloatingNotice>}

    <section className="mt-7 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">Novo perfil</p>
      <h2 className="mt-2 text-2xl font-black text-ink">Cadastrar estabelecimento não reivindicado</h2>
      <p className="mt-2 text-sm leading-6 text-muted">Use nome, categoria, endereço e somente contatos comerciais claramente públicos. Não inclua logo, fotos, promoções ou redes sociais sem autorização.</p>
      <form action={createUnclaimedBusinessAction} className="mt-7 space-y-8">
        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="col-span-full mb-1 text-lg font-black text-ink">Identificação</legend>
          <label className={`${labelClass} sm:col-span-2`} htmlFor="pre-name">Nome do estabelecimento<input className={inputClass} id="pre-name" name="name" minLength={2} maxLength={120} required /></label>
          <div className="sm:col-span-2"><PreRegistrationLocationFields states={(statesResult.data ?? []).map((state) => ({ code: state.code, name: state.name }))} /></div>
          <label className={`${labelClass} sm:col-span-2`} htmlFor="pre-category">Categoria principal<select className={inputClass} id="pre-category" name="category_id" defaultValue="" required><option value="" disabled>Selecione a categoria</option>{(categoriesResult.data ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        </fieldset>
        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="col-span-full mb-1 text-lg font-black text-ink">Endereço comercial</legend>
          <label className={labelClass} htmlFor="pre-street">Rua ou avenida<input className={inputClass} id="pre-street" name="street" required maxLength={160} /></label>
          <label className={labelClass} htmlFor="pre-number">Número<input className={inputClass} id="pre-number" name="address_number" required maxLength={20} /></label>
          <label className={labelClass} htmlFor="pre-neighborhood">Bairro<input className={inputClass} id="pre-neighborhood" name="neighborhood" required maxLength={120} /></label>
          <label className={labelClass} htmlFor="pre-postal-code">CEP <span className="font-semibold text-muted">(opcional)</span><input className={inputClass} id="pre-postal-code" name="postal_code" inputMode="numeric" /></label>
          <label className={`${labelClass} sm:col-span-2`} htmlFor="pre-complement">Complemento <span className="font-semibold text-muted">(opcional)</span><input className={inputClass} id="pre-complement" name="complement" maxLength={120} /></label>
          <label className={labelClass} htmlFor="pre-latitude">Latitude <span className="font-semibold text-muted">(opcional)</span><input className={inputClass} id="pre-latitude" name="latitude" inputMode="decimal" /></label>
          <label className={labelClass} htmlFor="pre-longitude">Longitude <span className="font-semibold text-muted">(opcional)</span><input className={inputClass} id="pre-longitude" name="longitude" inputMode="decimal" /></label>
        </fieldset>
        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="col-span-full mb-1 text-lg font-black text-ink">Informações públicas opcionais</legend>
          <label className={labelClass} htmlFor="pre-phone">Telefone comercial<input className={inputClass} id="pre-phone" name="phone_e164" type="tel" placeholder="(18) 3322-1234" /></label>
          <label className={labelClass} htmlFor="pre-website">Site oficial<input className={inputClass} id="pre-website" name="website_url" placeholder="empresa.com.br" /></label>
          <label className={`${labelClass} sm:col-span-2`} htmlFor="pre-source">Fonte consultada<input className={inputClass} id="pre-source" name="data_source_url" placeholder="https://..." /><span className="mt-1.5 block text-xs font-semibold text-muted">Campo interno para rastrear a origem dos dados.</span></label>
        </fieldset>
        <label className="flex items-start gap-3 rounded-2xl border border-line bg-canvas p-4 text-sm font-bold text-ink"><input type="checkbox" name="publication_status" defaultChecked className="mt-0.5 size-5 accent-[var(--color-brand)]" /><span>Publicar agora<span className="mt-1 block text-xs font-semibold leading-5 text-muted">O perfil será identificado publicamente como não reivindicado.</span></span></label>
        <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-black text-white transition hover:bg-brand-dark sm:w-auto"><StoreIcon className="size-4" /> Criar perfil não reivindicado</button>
      </form>
    </section>

    <section className="mt-7 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8">
      <h2 className="text-xl font-black text-ink">Perfis recentes</h2>
      {(businessesResult.data ?? []).length === 0 ? <p className="mt-3 text-sm text-muted">Nenhum perfil cadastrado ainda.</p> : <div className="mt-4 divide-y divide-line">{(businessesResult.data ?? []).map((business) => { const city = Array.isArray(business.cities) ? business.cities[0] : business.cities; return <div key={business.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-ink">{business.name}</p><p className="mt-1 text-sm text-muted">{business.street}, {business.address_number} · {business.neighborhood}{city ? ` · ${city.name}/${city.state_code}` : ""}</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-canvas px-3 py-1.5 text-xs font-black text-muted">{business.publication_status === "published" ? "Publicado" : "Não publicado"}</span><Link href={`/painel/admin/perfis-nao-reivindicados/${business.id}/editar`} className="rounded-xl border border-brand/25 bg-brand/8 px-3 py-2 text-xs font-black text-brand-dark">Editar informações</Link><Link href={`/loja/${business.slug}`} target="_blank" className="rounded-xl border border-line px-3 py-2 text-xs font-black text-ink">Abrir perfil</Link></div></div>; })}</div>}
    </section>
  </div>;
}
