import type { Metadata } from "next";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createUnclaimedBusinessAction } from "@/app/admin/perfis-nao-reivindicados/actions";
import { PreRegistrationLocationFields } from "@/components/admin/pre-registration-location-fields";
import { FloatingNotice } from "@/components/floating-notice";
import { ShieldCheckIcon, StoreIcon } from "@/components/icons";
import { requireAdmin } from "@/lib/admin/dal";
import type { DatabaseWithBusinessClaims } from "@/types/business-claims";

export const metadata: Metadata = { title: "Perfis não reivindicados" };
const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink outline-none transition placeholder:text-muted/65 focus:border-brand focus:ring-4 focus:ring-brand/10";
const labelClass = "block text-sm font-extrabold text-ink";
const PAGE_SIZE = 50;
type PageProps = { searchParams: Promise<{ sucesso?: string; erro?: string; q?: string; cidade?: string; coordenadas?: string; pagina?: string }> };

export default async function UnclaimedBusinessesAdminPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { supabase } = await requireAdmin("/admin/perfis-nao-reivindicados");
  const client = supabase as unknown as SupabaseClient<DatabaseWithBusinessClaims>;
  const search = (params.q ?? "").replace(/[,%()]/g, " ").trim().slice(0, 100);
  const cityId = Number(params.cidade ?? "");
  const coordinateFilter = params.coordenadas === "sem" || params.coordenadas === "com" ? params.coordenadas : "todos";
  const page = Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const [statesResult, categoriesResult, cityIdsResult] = await Promise.all([
    supabase.from("states").select("code, name").eq("is_active", true).order("name"),
    supabase.from("categories").select("id, name").eq("is_active", true).neq("slug", "locais-publicos").order("display_order").order("name"),
    client.from("businesses").select("city_id").eq("pre_registered", true).is("owner_id", null).eq("listing_type", "business").limit(5000),
  ]);
  if (statesResult.error || categoriesResult.error || cityIdsResult.error) throw new Error("Não foi possível carregar os perfis não reivindicados.");

  const cityIds = Array.from(new Set((cityIdsResult.data ?? []).map((item) => item.city_id).filter((id): id is number => typeof id === "number")));
  let businessesQuery = client
    .from("businesses")
    .select("id, name, slug, publication_status, street, address_number, neighborhood, latitude, longitude, city_id, cities(name, state_code)", { count: "exact" })
    .eq("pre_registered", true)
    .is("owner_id", null)
    .eq("listing_type", "business");

  if (search) businessesQuery = businessesQuery.or(`name.ilike.%${search}%,street.ilike.%${search}%,neighborhood.ilike.%${search}%`);
  if (Number.isInteger(cityId) && cityId > 0) businessesQuery = businessesQuery.eq("city_id", cityId);
  if (coordinateFilter === "sem") businessesQuery = businessesQuery.or("latitude.is.null,longitude.is.null");
  if (coordinateFilter === "com") businessesQuery = businessesQuery.not("latitude", "is", null).not("longitude", "is", null);

  const [citiesResult, businessesResult] = await Promise.all([
    cityIds.length ? supabase.from("cities").select("id, name, state_code").in("id", cityIds).order("name") : Promise.resolve({ data: [], error: null }),
    businessesQuery.order("name", { ascending: true }).range(from, from + PAGE_SIZE - 1),
  ]);
  if (citiesResult.error || businessesResult.error) throw new Error("Não foi possível carregar os perfis não reivindicados.");

  const total = businessesResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const businesses = businessesResult.data ?? [];
  const cities = citiesResult.data ?? [];
  const hasFilters = Boolean(search || (Number.isInteger(cityId) && cityId > 0) || coordinateFilter !== "todos");

  const pageHref = (nextPage: number) => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    if (Number.isInteger(cityId) && cityId > 0) query.set("cidade", String(cityId));
    if (coordinateFilter !== "todos") query.set("coordenadas", coordinateFilter);
    if (nextPage > 1) query.set("pagina", String(nextPage));
    const value = query.toString();
    return `/admin/perfis-nao-reivindicados${value ? `?${value}` : ""}`;
  };

  return <div>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-positive">Administração</p>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">Perfis não reivindicados</h1>
      <p className="mt-2 max-w-3xl text-base leading-7 text-muted">Cadastre, encontre e corrija informações factuais de estabelecimentos ainda sem proprietário vinculado.</p>
    </div><span className="inline-flex w-fit items-center gap-2 rounded-full bg-positive-soft px-4 py-2 text-sm font-black text-positive"><ShieldCheckIcon className="size-4" /> Cadastro informativo</span></div>
    <div className="mt-4 flex flex-wrap gap-2">
      <Link href="/admin" className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-black text-ink hover:border-brand/40">Voltar para moderação</Link>
      <Link href="/admin/reivindicacoes" className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-black text-ink hover:border-brand/40">Reivindicações e correções</Link>
    </div>
    {params.sucesso && <FloatingNotice tone="success">{params.sucesso}</FloatingNotice>}
    {params.erro && <FloatingNotice tone="error">{params.erro}</FloatingNotice>}

    <section className="mt-7 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">Localizar perfil</p>
      <h2 className="mt-2 text-2xl font-black text-ink">Buscar e corrigir cadastro</h2>
      <p className="mt-2 text-sm leading-6 text-muted">Pesquise por nome, rua ou bairro. Use “Sem coordenadas” para encontrar rapidamente vitrines que precisam de correção de localização.</p>
      <form method="get" className="mt-5 grid gap-4 lg:grid-cols-[2fr_1.2fr_1fr_auto] lg:items-end">
        <label className={labelClass}>Nome ou endereço<input className={inputClass} name="q" defaultValue={search} placeholder="Ex.: Lequipe Fit, Rui Barbosa..." /></label>
        <label className={labelClass}>Cidade<select className={inputClass} name="cidade" defaultValue={Number.isInteger(cityId) && cityId > 0 ? String(cityId) : ""}><option value="">Todas as cidades</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}/{city.state_code}</option>)}</select></label>
        <label className={labelClass}>Coordenadas<select className={inputClass} name="coordenadas" defaultValue={coordinateFilter}><option value="todos">Todos</option><option value="sem">Sem coordenadas</option><option value="com">Com coordenadas</option></select></label>
        <button type="submit" className="min-h-12 rounded-xl bg-brand px-5 text-sm font-black text-white hover:bg-brand-dark">Buscar</button>
      </form>
      {hasFilters && <div className="mt-4 flex flex-wrap items-center gap-3"><p className="text-sm font-bold text-muted">{total} perfil{total === 1 ? "" : "s"} encontrado{total === 1 ? "" : "s"}.</p><Link href="/admin/perfis-nao-reivindicados" className="text-sm font-black text-brand-dark underline">Limpar filtros</Link></div>}
    </section>

    <section className="mt-7 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-black text-ink">{hasFilters ? "Resultados" : "Perfis não reivindicados"}</h2><p className="mt-1 text-sm text-muted">{total} perfil{total === 1 ? "" : "s"} disponível{total === 1 ? "" : "eis"} para administração.</p></div>{totalPages > 1 && <span className="text-sm font-bold text-muted">Página {Math.min(page, totalPages)} de {totalPages}</span>}</div>
      {businesses.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed border-line bg-canvas p-5 text-sm font-semibold text-muted">Nenhum perfil corresponde aos filtros informados.</p> : <div className="mt-4 divide-y divide-line">{businesses.map((business) => { const city = Array.isArray(business.cities) ? business.cities[0] : business.cities; const hasCoordinates = business.latitude !== null && business.longitude !== null; return <div key={business.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-ink">{business.name}</p><p className="mt-1 text-sm text-muted">{business.street}, {business.address_number} · {business.neighborhood}{city ? ` · ${city.name}/${city.state_code}` : ""}</p><div className="mt-2 flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${hasCoordinates ? "bg-positive-soft text-positive" : "bg-brand/10 text-brand-dark"}`}>{hasCoordinates ? "Coordenadas OK" : "Sem coordenadas"}</span><span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-black text-muted">{business.publication_status === "published" ? "Publicado" : "Não publicado"}</span></div></div><div className="flex flex-wrap gap-2"><Link href={`/admin/perfis-nao-reivindicados/${business.id}/editar`} className="rounded-xl border border-brand/25 bg-brand/8 px-3 py-2 text-xs font-black text-brand-dark">Editar informações</Link><Link href={`/loja/${business.slug}`} target="_blank" className="rounded-xl border border-line px-3 py-2 text-xs font-black text-ink">Abrir perfil</Link></div></div>; })}</div>}
      {totalPages > 1 && <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-5"><div>{page > 1 ? <Link href={pageHref(page - 1)} className="inline-flex min-h-10 items-center rounded-xl border border-line px-4 text-sm font-black text-ink">Anterior</Link> : <span />}</div><div>{page < totalPages ? <Link href={pageHref(page + 1)} className="inline-flex min-h-10 items-center rounded-xl border border-line px-4 text-sm font-black text-ink">Próxima</Link> : <span />}</div></div>}
    </section>

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
  </div>;
}
