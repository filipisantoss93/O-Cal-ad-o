import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/dal";
import { saveAdminBusinessAction, saveAdminUserAction } from "./actions";
import { PreRegistrationLocationFields } from "@/components/admin/pre-registration-location-fields";
import { FloatingNotice } from "@/components/floating-notice";

export const metadata: Metadata = { title: "Cadastros | Administração", robots: { index: false, follow: false } };

type Search = { q?: string; tipo?: string; id?: string; salvo?: string; erro?: string };
type Props = { searchParams: Promise<Search> };

const field = "mt-1.5 min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/10";
const label = "block min-w-0 text-sm font-bold text-ink";
const box = "rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-6";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function editUrl(type: "usuario" | "empresa", id: string | number) {
  return "/admin/cadastros?tipo=" + type + "&id=" + encodeURIComponent(String(id));
}

export default async function AdminRegistrationsPage({ searchParams }: Props) {
  const params = await searchParams;
  const { supabase } = await requireAdmin("/admin/cadastros");
  const q = (params.q ?? "").trim().slice(0, 80);
  const type = params.tipo === "usuario" || params.tipo === "empresa" ? params.tipo : null;
  const id = (params.id ?? "").trim();
  const editUserId = type === "usuario" && uuid.test(id) ? id : null;
  const editBusinessId = type === "empresa" && /^[1-9][0-9]*$/.test(id) && Number.isSafeInteger(Number(id)) ? Number(id) : null;

  // Não se consulta auth.users pelo navegador, nem se envia uma chave privilegiada ao cliente.
  const profileQuery = supabase.from("profiles")
    .select("id, full_name, phone_e164, role, created_at")
    .order("created_at", { ascending: false }).limit(q ? 25 : 10);
  const businessQuery = supabase.from("businesses")
    .select("id, name, owner_id, slug, cities(name, state_code)")
    .eq("listing_type", "business").order("created_at", { ascending: false }).limit(q ? 25 : 12);

  if (q) {
    if (uuid.test(q)) profileQuery.eq("id", q);
    else if (/^[+0-9() -]{8,22}$/.test(q)) {
      const digits = q.replace(/\D/g, "");
      profileQuery.eq("phone_e164", "+" + (digits.length <= 11 ? "55" + digits : digits));
    } else profileQuery.ilike("full_name", "%" + q.replace(/[%_]/g, "") + "%");

    if (/^[1-9][0-9]*$/.test(q) && Number.isSafeInteger(Number(q))) businessQuery.eq("id", Number(q));
    else businessQuery.ilike("name", "%" + q.replace(/[%_]/g, "") + "%");
  }

  const [usersResult, businessesResult, selectedUserResult, selectedBusinessResult, categoriesResult, statesResult] = await Promise.all([
    profileQuery,
    businessQuery,
    editUserId ? supabase.from("profiles").select("id, full_name, phone_e164, role").eq("id", editUserId).maybeSingle() : Promise.resolve({ data: null, error: null }),
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
  const selectedUser = selectedUserResult.data;
  const business = selectedBusinessResult.data;
  const currentCity = business && (Array.isArray(business.cities) ? business.cities[0] : business.cities);

  const relatedBusinessesResult = selectedUser
    ? await supabase.from("businesses").select("id, name, slug").eq("owner_id", selectedUser.id)
      .eq("listing_type", "business").order("name").limit(30)
    : { data: [], error: null };
  if (relatedBusinessesResult.error) throw new Error("Não foi possível consultar as empresas vinculadas.");

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-black uppercase tracking-widest text-brand-dark">Administração</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">Usuários e empresas</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Encontre um cadastro e corrija seus dados sem abrir o SQL Editor. O vínculo com o proprietário,
          as permissões, a senha, os pagamentos e o endereço público da vitrine não são alterados nesta página.
        </p>
      </header>

      {params.salvo === "1" && <FloatingNotice tone="success">Alterações salvas com sucesso.</FloatingNotice>}
      {params.erro && <FloatingNotice tone="error">{params.erro}</FloatingNotice>}

      <form method="get" action="/admin/cadastros" className={box}>
        <label className={label} htmlFor="cadastros-q">Pesquisar usuários ou empresas</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input className={field + " mt-0 flex-1"} id="cadastros-q" name="q" type="search"
            defaultValue={q} maxLength={80} placeholder="Nome, ID ou telefone do usuário" />
          <button className="min-h-11 rounded-xl bg-brand px-6 text-sm font-black text-white" type="submit">Pesquisar</button>
          {q && <Link href="/admin/cadastros" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 text-sm font-bold text-ink">Limpar</Link>}
        </div>
        <p className="mt-2 text-xs text-muted">Empresas: pesquise pelo nome ou ID numérico. Usuários: nome, UUID ou telefone cadastrado.</p>
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
                <input type="hidden" name="user_id" value={selectedUser.id} />
                <p className="break-all text-xs text-muted">Identificador: {selectedUser.id} · Perfil: {selectedUser.role}</p>
                <p className="text-xs text-muted">O e-mail de acesso e a senha pertencem ao Supabase Auth e não são modificados por este formulário.</p>
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
          ))}
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={box}>
          <h2 className="text-lg font-black text-ink">Usuários</h2>
          <p className="mt-1 text-xs text-muted">{q ? "Resultados da pesquisa (até 25)" : "Cadastros recentes (até 10)"}</p>
          <div className="mt-4 space-y-2">
            {users.length === 0 ? <p className="text-sm text-muted">Nenhum usuário encontrado.</p> : users.map((user) => (
              <Link key={user.id} href={editUrl("usuario", user.id)}
                className="block rounded-xl border border-line bg-canvas p-3 transition hover:border-brand/50">
                <p className="text-sm font-black text-ink">{user.full_name || "Sem nome informado"}</p>
                <p className="mt-1 break-all text-xs text-muted">{user.phone_e164 || "Sem telefone"} · {user.role} · {user.id}</p>
              </Link>
            ))}
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
