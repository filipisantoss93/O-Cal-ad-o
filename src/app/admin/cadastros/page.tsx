import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/dal";
import {
  linkAdminUnclaimedBusinessAction,
  revokeAdminBusinessOwnerAction,
  saveAdminBusinessAction,
  saveAdminUserAction,
  setAdminUserAccessAction,
  updateAdminUserEmailAction,
} from "./actions";
import type { DatabaseWithAdminOwnerLink } from "@/types/admin-owner-link";
import type { DatabaseWithAdminUserManagement } from "@/types/admin-user-management";
import type { DatabaseWithBusinessClaims } from "@/types/business-claims";
import { PreRegistrationLocationFields } from "@/components/admin/pre-registration-location-fields";
import { FloatingNotice } from "@/components/floating-notice";

export const metadata: Metadata = { title: "Cadastros | Administração", robots: { index: false, follow: false } };

type Search = {
  q?: string;
  tipo?: string;
  id?: string;
  salvo?: string;
  vinculado?: string;
  desvinculado?: string;
  conta?: string;
  owner_q?: string;
  erro?: string;
};
type Props = { searchParams: Promise<Search> };

const field = "mt-1.5 min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/10";
const label = "block min-w-0 text-sm font-bold text-ink";
const box = "rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-6";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function editUrl(type: "usuario" | "empresa", id: string | number) {
  return "/admin/cadastros?tipo=" + type + "&id=" + encodeURIComponent(String(id));
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
function dateTime(value: string | null | undefined) {
  return value ? dateFormatter.format(new Date(value)) : "Nunca";
}

export default async function AdminRegistrationsPage({ searchParams }: Props) {
  const params = await searchParams;
  const { supabase } = await requireAdmin("/admin/cadastros");
  const q = (params.q ?? "").trim().slice(0, 80);
  const ownerQ = (params.owner_q ?? "").trim().slice(0, 80);
  const type = params.tipo === "usuario" || params.tipo === "empresa" ? params.tipo : null;
  const id = (params.id ?? "").trim();
  const editUserId = type === "usuario" && uuid.test(id) ? id : null;
  const editBusinessId = type === "empresa" && /^[1-9][0-9]*$/.test(id) && Number.isSafeInteger(Number(id)) ? Number(id) : null;

  // auth.users é consultado apenas por RPC administrativa protegida; nenhuma chave privilegiada vai ao navegador.
  const adminUserClient = supabase as unknown as SupabaseClient<DatabaseWithAdminUserManagement>;
  const businessQuery = supabase.from("businesses")
    .select("id, name, owner_id, slug, cities(name, state_code)")
    .eq("listing_type", "business").order("created_at", { ascending: false }).limit(q ? 25 : 12);

  if (q) {
    if (/^[1-9][0-9]*$/.test(q) && Number.isSafeInteger(Number(q))) businessQuery.eq("id", Number(q));
    else businessQuery.ilike("name", "%" + q.replace(/[%_]/g, "") + "%");
  }

  const [usersResult, businessesResult, selectedUserResult, selectedBusinessResult, categoriesResult, statesResult] = await Promise.all([
    adminUserClient.rpc("admin_search_users", { p_query: q, p_limit: q ? 25 : 10 }),
    businessQuery,
    editUserId
      ? adminUserClient.rpc("admin_search_users", { p_query: editUserId, p_limit: 1 })
      : Promise.resolve({ data: [], error: null }),
    editBusinessId ? supabase.from("businesses")
      .select("id, owner_id, slug, name, description, city_id, category_id, street, address_number, complement, neighborhood, postal_code, whatsapp_e164, phone_e164, public_email, website_url, instagram_url, facebook_url, latitude, longitude, status, publication_status, plan, pre_registered, cities(name, state_code)")
      .eq("id", editBusinessId).eq("listing_type", "business").maybeSingle() : Promise.resolve({ data: null, error: null }),
    editBusinessId ? supabase.from("categories").select("id, name, slug").eq("is_active", true).neq("slug", "locais-publicos").order("name") : Promise.resolve({ data: [], error: null }),
    editBusinessId ? supabase.from("states").select("code, name").eq("is_active", true).order("name") : Promise.resolve({ data: [], error: null }),
  ]);
  if (usersResult.error || businessesResult.error || selectedUserResult.error ||
      selectedBusinessResult.error || categoriesResult.error || statesResult.error) {
    throw new Error("Não foi possível carregar os cadastros. Tente novamente.");
  }
  const users = usersResult.data ?? [];
  const businesses = businessesResult.data ?? [];
  const selectedUser = (selectedUserResult.data ?? [])[0] ?? null;
  const business = selectedBusinessResult.data;
  const canLinkBusiness = Boolean(business && business.pre_registered && !business.owner_id);
  // Pesquisa de usuários somente quando uma empresa não reivindicada está aberta.
  // A RPC protegida também encontra pelo e-mail de login, sem expor auth.users no cliente.
  const { data: ownerCandidates, error: ownerSearchError } = canLinkBusiness && ownerQ.length >= 2
    ? await (supabase as unknown as SupabaseClient<DatabaseWithAdminOwnerLink>)
        .rpc("admin_search_business_owner_candidates", { p_query: ownerQ, p_limit: 10 })
    : { data: [], error: null };
  if (ownerSearchError) throw new Error("Não foi possível pesquisar os usuários. Tente novamente.");

  const pendingClaimsResult = canLinkBusiness
    ? await (supabase as unknown as SupabaseClient<DatabaseWithBusinessClaims>)
        .from("business_claim_requests")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business!.id).eq("status", "pending")
    : { count: 0, error: null };
  if (pendingClaimsResult.error) throw new Error("Não foi possível consultar as reivindicações pendentes.");

  const currentCity = business && (Array.isArray(business.cities) ? business.cities[0] : business.cities);

  const relatedBusinessesResult = selectedUser
    ? await supabase.from("businesses").select("id, name, slug").eq("owner_id", selectedUser.user_id)
      .eq("listing_type", "business").order("name").limit(30)
    : { data: [], error: null };
  if (relatedBusinessesResult.error) throw new Error("Não foi possível consultar as empresas vinculadas.");

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-black uppercase tracking-widest text-brand-dark">Administração</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">Usuários e empresas</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Encontre contas e empresas, edite dados cadastrais, gerencie acesso e vínculo de propriedade.
          Senhas nunca são exibidas; ações críticas ficam protegidas e exigem acesso administrativo.
        </p>
      </header>

      {params.salvo === "1" && <FloatingNotice tone="success">Alterações salvas com sucesso.</FloatingNotice>}
      {params.vinculado === "1" && <FloatingNotice tone="success">Empresa vinculada ao usuário. O limite de lojas da conta foi respeitado.</FloatingNotice>}
      {params.desvinculado === "1" && <FloatingNotice tone="success">Responsável removido. A empresa voltou a ficar disponível para reivindicação.</FloatingNotice>}
      {params.conta === "email" && <FloatingNotice tone="success">E-mail de acesso atualizado.</FloatingNotice>}
      {params.conta === "suspensa" && <FloatingNotice tone="success">Conta suspensa. Novos acessos foram bloqueados.</FloatingNotice>}
      {params.conta === "reativada" && <FloatingNotice tone="success">Conta reativada.</FloatingNotice>}
      {params.erro && <FloatingNotice tone="error">{params.erro}</FloatingNotice>}

      <form method="get" action="/admin/cadastros" className={box}>
        <label className={label} htmlFor="cadastros-q">Pesquisar usuários ou empresas</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input className={field + " mt-0 flex-1"} id="cadastros-q" name="q" type="search"
            defaultValue={q} maxLength={80} placeholder="Nome, e-mail, telefone ou ID" />
          <button className="min-h-11 rounded-xl bg-brand px-6 text-sm font-black text-white" type="submit">Pesquisar</button>
          {q && <Link href="/admin/cadastros" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 text-sm font-bold text-ink">Limpar</Link>}
        </div>
        <p className="mt-2 text-xs text-muted">Empresas: nome ou ID numérico. Usuários: nome, e-mail, UUID ou telefone.</p>
      </form>

      {(type && id) && (
        <section className={box}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-black text-ink">
              {type === "usuario" ? "Editar usuário" : "Editar empresa"}
            </h2>
            <Link href="/admin/cadastros" className="rounded-xl border border-line px-3 py-2 text-sm font-bold text-ink">Fechar edição</Link>
          </div>

          {type === "usuario" && (!selectedUser ? (
            <p className="text-sm text-muted">Usuário não encontrado.</p>
          ) : (
            <div className="space-y-5">
              <form action={saveAdminUserAction} className="space-y-4">
                <input type="hidden" name="user_id" value={selectedUser.user_id} />
                <p className="break-all text-xs text-muted">Identificador: {selectedUser.user_id} · Perfil: {selectedUser.role}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={label}>Nome completo
                    <input className={field} name="full_name" defaultValue={selectedUser.full_name ?? ""} minLength={2} maxLength={120} required />
                  </label>
                  <label className={label}>Telefone com DDD
                    <input className={field} name="phone_e164" type="tel" defaultValue={selectedUser.phone_e164 ?? ""} placeholder="(18) 99999-9999" />
                  </label>
                </div>
                <button type="submit" className="min-h-11 rounded-xl bg-brand px-5 text-sm font-black text-white">Salvar dados do usuário</button>
              </form>

              <section className="rounded-2xl border border-line bg-canvas p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-ink">Conta de acesso</h3>
                    <p className="mt-1 text-xs leading-5 text-muted">E-mail, situação da conta, assinatura e atividade recente.</p>
                  </div>
                  <span className={"rounded-full px-3 py-1 text-xs font-black " +
                    (selectedUser.banned_until && new Date(selectedUser.banned_until) > new Date()
                      ? "bg-brand/10 text-brand-dark"
                      : "bg-positive-soft text-positive")}>
                    {selectedUser.banned_until && new Date(selectedUser.banned_until) > new Date() ? "Suspensa" : "Ativa"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div><p className="text-xs font-bold text-muted">Último acesso</p><p className="mt-1 font-bold text-ink">{dateTime(selectedUser.last_sign_in_at)}</p></div>
                  <div><p className="text-xs font-bold text-muted">E-mail confirmado</p><p className="mt-1 font-bold text-ink">{selectedUser.email_confirmed_at ? "Sim" : "Não"}</p></div>
                  <div><p className="text-xs font-bold text-muted">Plano</p><p className="mt-1 font-bold text-ink">{selectedUser.subscription_plan === "pro" ? "Pro" : "Free"} · {selectedUser.subscription_status}</p></div>
                  <div><p className="text-xs font-bold text-muted">Lojas</p><p className="mt-1 font-bold text-ink">{selectedUser.used_businesses} de {selectedUser.allowed_businesses}</p></div>
                </div>

                {selectedUser.subscription_period_end && (
                  <p className="mt-3 text-xs text-muted">Período atual da assinatura até {dateTime(selectedUser.subscription_period_end)}.</p>
                )}

                {selectedUser.role === "admin" ? (
                  <p className="mt-4 rounded-xl border border-line bg-surface p-3 text-sm font-semibold text-muted">
                    Conta administrativa protegida. E-mail e acesso não podem ser alterados por este controle.
                  </p>
                ) : (
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <form action={updateAdminUserEmailAction} className="rounded-xl border border-line bg-surface p-4">
                      <input type="hidden" name="user_id" value={selectedUser.user_id} />
                      <label className={label}>E-mail de acesso
                        <input className={field} name="email" type="email" required maxLength={254} defaultValue={selectedUser.email ?? ""} />
                      </label>
                      <p className="mt-2 text-xs leading-5 text-muted">A alteração é aplicada diretamente à conta de login.</p>
                      <button type="submit" className="mt-3 min-h-11 rounded-xl bg-ink px-4 text-sm font-black text-white">Atualizar e-mail</button>
                    </form>

                    <form action={setAdminUserAccessAction} className="rounded-xl border border-line bg-surface p-4">
                      <input type="hidden" name="user_id" value={selectedUser.user_id} />
                      <input type="hidden" name="account_action"
                        value={selectedUser.banned_until && new Date(selectedUser.banned_until) > new Date() ? "reactivate" : "suspend"} />
                      <h4 className="text-sm font-black text-ink">Acesso à plataforma</h4>
                      <p className="mt-2 text-xs leading-5 text-muted">
                        {selectedUser.banned_until && new Date(selectedUser.banned_until) > new Date()
                          ? "Reativar permite que o usuário volte a autenticar normalmente."
                          : "Suspender bloqueia novas autenticações sem apagar a conta, lojas ou histórico."}
                      </p>
                      <button type="submit"
                        className={"mt-3 min-h-11 rounded-xl px-4 text-sm font-black " +
                          (selectedUser.banned_until && new Date(selectedUser.banned_until) > new Date()
                            ? "bg-positive text-white"
                            : "border border-brand/30 bg-brand/10 text-brand-dark")}>
                        {selectedUser.banned_until && new Date(selectedUser.banned_until) > new Date() ? "Reativar conta" : "Suspender conta"}
                      </button>
                    </form>
                  </div>
                )}
              </section>

              <div className="border-t border-line pt-4">
                <h3 className="text-sm font-black text-ink">Empresas vinculadas</h3>
                {(relatedBusinessesResult.data ?? []).length === 0 ? (
                  <p className="mt-2 text-sm text-muted">Nenhuma empresa vinculada a este usuário.</p>
                ) : (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(relatedBusinessesResult.data ?? []).map((item) => (
                      <Link key={item.id} href={editUrl("empresa", item.id)}
                        className="rounded-xl border border-line bg-canvas px-3 py-3 text-sm font-bold text-ink hover:border-brand/50">
                        {item.name} <span className="text-xs font-normal text-muted">#{item.id}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {type === "empresa" && (!business ? (
            <p className="text-sm text-muted">Empresa não encontrada.</p>
          ) : (
            <div className="space-y-6">
              {canLinkBusiness && (
                <section className="rounded-2xl border border-brand/30 bg-canvas p-4 sm:p-5">
                  <h3 className="text-lg font-black text-ink">Vincular empresa a um usuário</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    Esta empresa ainda não foi reivindicada. Pesquise pelo nome, e-mail de login,
                    telefone ou ID do usuário. São exibidos no máximo 10 resultados; nenhuma lista completa é carregada.
                  </p>
                  {(pendingClaimsResult.count ?? 0) > 0 && (
                    <p role="status" className="mt-3 rounded-xl border border-line bg-surface p-3 text-sm font-semibold text-ink">
                      Atenção: existem {pendingClaimsResult.count} reivindicações pendentes.
                      Ao confirmar o vínculo, as solicitações do usuário escolhido serão aprovadas
                      e as demais, rejeitadas.
                    </p>
                  )}
                  <form action="/admin/cadastros" method="get" className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input type="hidden" name="tipo" value="empresa" />
                    <input type="hidden" name="id" value={business.id} />
                    <label className="min-w-0 flex-1 text-sm font-bold text-ink">
                      Pesquisar usuário
                      <input className={field} name="owner_q" type="search" defaultValue={ownerQ}
                        minLength={2} maxLength={80} required placeholder="Nome, e-mail, telefone ou UUID" />
                    </label>
                    <button className="min-h-11 self-end rounded-xl bg-ink px-5 text-sm font-black text-white" type="submit">Buscar usuário</button>
                  </form>
                  {ownerQ.length >= 2 && (
                    <div className="mt-4 space-y-2">
                      {(ownerCandidates ?? []).length === 0 ? (
                        <p className="text-sm text-muted">Nenhum usuário encontrado. Refine a pesquisa.</p>
                      ) : (ownerCandidates ?? []).map((candidate) => {
                        const full = candidate.used_businesses >= candidate.allowed_businesses;
                        return (
                          <div key={candidate.user_id} className="rounded-xl border border-line bg-surface p-3">
                            <p className="text-sm font-black text-ink">{candidate.full_name || "Sem nome informado"}</p>
                            <p className="mt-1 break-all text-xs text-muted">{candidate.email || "Sem e-mail"} · {candidate.phone_e164 || "Sem telefone"}</p>
                            <p className="mt-1 break-all text-xs text-muted">ID: {candidate.user_id}</p>
                            <p className={"mt-2 text-sm font-bold " + (full ? "text-brand-dark" : "text-ink")}>
                              {candidate.used_businesses} de {candidate.allowed_businesses} lojas utilizadas
                              {full ? " · Limite atingido" : " · Vaga disponível"}
                            </p>
                            <form action={linkAdminUnclaimedBusinessAction} className="mt-3">
                              <input type="hidden" name="business_id" value={business.id} />
                              <input type="hidden" name="user_id" value={candidate.user_id} />
                              <button type="submit" disabled={full}
                                className="min-h-11 rounded-xl bg-brand px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
                                {full ? "Sem vagas disponíveis" : "Vincular esta empresa a este usuário"}
                              </button>
                            </form>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}
              {business.owner_id && (
                <section className="rounded-2xl border border-brand/25 bg-canvas p-4 sm:p-5">
                  <h3 className="text-lg font-black text-ink">Responsável atual</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    Se a reivindicação foi aprovada para a pessoa errada, remova o vínculo. O perfil volta a ser não reivindicado
                    e poderá ser atribuído ao responsável correto.
                  </p>
                  <div className="mt-3">
                    <Link href={editUrl("usuario", business.owner_id)} className="text-sm font-black text-brand-dark underline">
                      Abrir cadastro do responsável
                    </Link>
                  </div>
                  <form action={revokeAdminBusinessOwnerAction} className="mt-4 rounded-xl border border-line bg-surface p-4">
                    <input type="hidden" name="business_id" value={business.id} />
                    <label className={label}>Motivo da revogação
                      <textarea name="admin_note" minLength={5} maxLength={1000} required
                        className={field + " min-h-24"}
                        placeholder="Ex.: solicitante não comprovou ser responsável pelo estabelecimento." />
                    </label>
                    <p className="mt-2 text-xs leading-5 text-muted">
                      A ação remove o acesso à empresa, preserva o histórico e suspende promoções vinculadas até um novo responsável ser definido.
                    </p>
                    <button type="submit" className="mt-3 min-h-11 rounded-xl border border-brand/30 bg-brand/10 px-4 text-sm font-black text-brand-dark">
                      Remover responsável e cancelar reivindicação
                    </button>
                  </form>
                </section>
              )}
              <form action={saveAdminBusinessAction} className="space-y-6">
              <input type="hidden" name="business_id" value={business.id} />
              <div className="flex flex-wrap gap-2 text-xs font-bold text-muted">
                <span>ID #{business.id}</span><span>· {business.status}</span>
                <span>· {business.publication_status}</span><span>· Plano {business.plan}</span>
                <Link href={"/loja/" + business.slug} target="_blank" rel="noreferrer" className="text-brand-dark underline">Visualizar vitrine</Link>
                {business.owner_id && <Link href={editUrl("usuario", business.owner_id)} className="text-brand-dark underline">Editar proprietário</Link>}
              </div>
              <p className="text-xs text-muted">Alterar o nome não muda a URL existente. Endereço modificado sem novas coordenadas invalida o pino antigo para nova geocodificação.</p>

              <fieldset className="grid gap-4 sm:grid-cols-2">
                <legend className="mb-3 text-lg font-black text-ink">Informações comerciais</legend>
                <label className={label}>Nome da empresa
                  <input className={field} name="name" required minLength={2} maxLength={120} defaultValue={business.name} />
                </label>
                <label className={label}>Categoria
                  <select className={field} name="category_id" required defaultValue={business.category_id}>
                    {(categoriesResult.data ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <label className={label + " sm:col-span-2"}>Descrição
                  <textarea className={field + " min-h-28"} name="description" maxLength={2000} defaultValue={business.description ?? ""} />
                </label>
                <label className={label}>WhatsApp comercial
                  <input className={field} type="tel" name="whatsapp_e164" defaultValue={business.whatsapp_e164 ?? ""} />
                </label>
                <label className={label}>Telefone comercial
                  <input className={field} type="tel" name="phone_e164" defaultValue={business.phone_e164 ?? ""} />
                </label>
                <label className={label}>E-mail público
                  <input className={field} type="email" name="public_email" maxLength={254} defaultValue={business.public_email ?? ""} />
                </label>
                <label className={label}>Site
                  <input className={field} type="text" name="website_url" maxLength={500} defaultValue={business.website_url ?? ""} placeholder="https://..." />
                </label>
                <label className={label}>Instagram
                  <input className={field} name="instagram_url" maxLength={500} defaultValue={business.instagram_url ?? ""} />
                </label>
                <label className={label}>Facebook
                  <input className={field} name="facebook_url" maxLength={500} defaultValue={business.facebook_url ?? ""} />
                </label>
              </fieldset>

              <fieldset className="grid gap-4 sm:grid-cols-2">
                <legend className="mb-3 text-lg font-black text-ink">Localização</legend>
                <div className="sm:col-span-2">
                  <p className="mb-3 text-xs text-muted">Cidade atual: {currentCity?.name ?? "—"}/{currentCity?.state_code ?? "—"}</p>
                  <PreRegistrationLocationFields
                    states={(statesResult.data ?? []).map((state) => ({ code: state.code, name: state.name }))}
                    initialStateCode={currentCity?.state_code ?? ""}
                    initialCityId={business.city_id}
                  />
                </div>
                <label className={label}>Rua ou avenida
                  <input id="pre-street" className={field} name="street" required maxLength={160} defaultValue={business.street} />
                </label>
                <label className={label}>Número
                  <input id="pre-number" className={field} name="address_number" required maxLength={20} defaultValue={business.address_number} />
                </label>
                <label className={label}>Bairro
                  <input id="pre-neighborhood" className={field} name="neighborhood" required maxLength={120} defaultValue={business.neighborhood} />
                </label>
                <label className={label}>CEP (opcional)
                  <input id="pre-postal-code" className={field} name="postal_code" inputMode="numeric" defaultValue={business.postal_code ?? ""} />
                </label>
                <label className={label + " sm:col-span-2"}>Complemento (sala, andar ou unidade)
                  <input className={field} name="complement" maxLength={120} defaultValue={business.complement ?? ""} />
                </label>
                <label className={label}>Latitude (opcional)
                  <input id="pre-latitude" className={field} name="latitude" inputMode="decimal" defaultValue={business.latitude ?? ""} />
                </label>
                <label className={label}>Longitude (opcional)
                  <input id="pre-longitude" className={field} name="longitude" inputMode="decimal" defaultValue={business.longitude ?? ""} />
                </label>
              </fieldset>

              <div className="flex flex-wrap gap-2 border-t border-line pt-5">
                <button type="submit" className="min-h-11 rounded-xl bg-brand px-6 text-sm font-black text-white">Salvar dados da empresa</button>
                <Link href="/admin" className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-bold text-ink">Abrir moderação</Link>
              </div>
              </form>
            </div>
          ))}
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={box}>
          <h2 className="text-lg font-black text-ink">Usuários</h2>
          <p className="mt-1 text-xs text-muted">{q ? "Resultados da pesquisa (até 25)" : "Cadastros recentes (até 10)"}</p>
          <div className="mt-4 space-y-2">
            {users.length === 0 ? <p className="text-sm text-muted">Nenhum usuário encontrado.</p> : users.map((user) => {
              const suspended = Boolean(user.banned_until && new Date(user.banned_until) > new Date());
              return (
                <Link key={user.user_id} href={editUrl("usuario", user.user_id)}
                  className="block rounded-xl border border-line bg-canvas p-3 transition hover:border-brand/50">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-black text-ink">{user.full_name || "Sem nome informado"}</p>
                    <span className={"shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black " +
                      (suspended ? "bg-brand/10 text-brand-dark" : "bg-positive-soft text-positive")}>
                      {suspended ? "Suspensa" : "Ativa"}
                    </span>
                  </div>
                  <p className="mt-1 break-all text-xs text-muted">{user.email || "Sem e-mail"} · {user.phone_e164 || "Sem telefone"}</p>
                  <p className="mt-1 break-all text-xs text-muted">{user.subscription_plan === "pro" ? "Pro" : "Free"} · {user.used_businesses}/{user.allowed_businesses} lojas · {user.user_id}</p>
                </Link>
              );
            })}
          </div>
        </section>
        <section className={box}>
          <h2 className="text-lg font-black text-ink">Empresas</h2>
          <p className="mt-1 text-xs text-muted">{q ? "Resultados da pesquisa (até 25)" : "Cadastros recentes (até 12)"}</p>
          <div className="mt-4 space-y-2">
            {businesses.length === 0 ? <p className="text-sm text-muted">Nenhuma empresa encontrada.</p> : businesses.map((item) => {
              const city = Array.isArray(item.cities) ? item.cities[0] : item.cities;
              return (
                <Link key={item.id} href={editUrl("empresa", item.id)}
                  className="block rounded-xl border border-line bg-canvas p-3 transition hover:border-brand/50">
                  <p className="text-sm font-black text-ink">{item.name} <span className="font-normal text-muted">#{item.id}</span></p>
                  <p className="mt-1 text-xs text-muted">{city?.name ?? "Cidade não informada"}/{city?.state_code ?? "—"} · {item.owner_id ? "Com proprietário" : "Não reivindicada"}</p>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
