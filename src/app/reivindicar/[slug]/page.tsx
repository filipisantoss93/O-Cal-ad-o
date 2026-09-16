import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requestBusinessClaimAction } from "@/app/reivindicar/[slug]/actions";
import { FloatingNotice } from "@/components/floating-notice";
import { ShieldCheckIcon, StoreIcon } from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithBusinessClaims } from "@/types/business-claims";

export const metadata: Metadata = { title: "Reivindicar estabelecimento" };

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<{ sucesso?: string; erro?: string }> };

export default async function ClaimBusinessPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const messages = await searchParams;
  const supabase = await createClient();
  const client = supabase as unknown as SupabaseClient<DatabaseWithBusinessClaims>;
  const [{ data: business, error }, { data: authData }] = await Promise.all([
    client.from("businesses").select("id, name, slug, pre_registered, owner_id, publication_status, is_active, street, address_number, neighborhood, cities(name, state_code)").eq("slug", slug).eq("listing_type", "business").maybeSingle(),
    supabase.auth.getUser(),
  ]);
  if (error || !business || !business.is_active) notFound();
  const city = Array.isArray(business.cities) ? business.cities[0] : business.cities;
  const available = business.pre_registered && !business.owner_id;
  const nextPath = `/reivindicar/${business.slug}`;

  return <><SiteHeader /><main className="min-h-[70vh] bg-canvas px-4 py-10 sm:px-6"><div className="mx-auto max-w-2xl">
    <Link href={`/loja/${business.slug}`} className="text-sm font-black text-brand-dark hover:underline">← Voltar ao estabelecimento</Link>
    <section className="mt-5 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8">
      <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand-dark"><StoreIcon className="size-5" /></span><div><p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">Perfil não reivindicado</p><h1 className="mt-2 text-3xl font-black tracking-tight text-ink">Reivindicar {business.name}</h1><p className="mt-2 text-sm leading-6 text-muted">{business.street}, {business.address_number} · {business.neighborhood}{city ? ` · ${city.name}/${city.state_code}` : ""}</p></div></div>
      {messages.sucesso && <FloatingNotice tone="success">{messages.sucesso}</FloatingNotice>}
      {messages.erro && <FloatingNotice tone="error">{messages.erro}</FloatingNotice>}
      {!available ? <div className="mt-7 rounded-2xl border border-positive/20 bg-positive-soft p-5"><p className="font-black text-positive">Este estabelecimento já possui responsável.</p><p className="mt-2 text-sm leading-6 text-muted">Caso exista algum problema com o perfil, use a opção de correção disponível na página do estabelecimento.</p></div> : !authData.user ? <div className="mt-7 rounded-2xl border border-line bg-canvas p-5"><p className="font-black text-ink">Entre na sua conta para continuar</p><p className="mt-2 text-sm leading-6 text-muted">A reivindicação fica vinculada à sua conta e passa por análise administrativa antes da transferência.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><Link href={`/entrar?next=${encodeURIComponent(nextPath)}`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-black text-white">Entrar</Link><Link href={`/cadastro?next=${encodeURIComponent(nextPath)}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-black text-ink">Criar conta</Link></div></div> : <form action={requestBusinessClaimAction} className="mt-7 space-y-5"><input type="hidden" name="slug" value={business.slug} /><div className="rounded-2xl border border-positive/20 bg-positive-soft p-4 text-sm leading-6 text-muted"><p className="flex items-center gap-2 font-black text-positive"><ShieldCheckIcon className="size-4" /> Validação manual</p><p className="mt-1">O envio não transfere a loja automaticamente. O administrador verifica o pedido antes de liberar a vitrine para sua conta.</p></div><label className="block text-sm font-extrabold text-ink">Qual sua relação com o estabelecimento?<select name="relationship" required defaultValue="" className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"><option value="" disabled>Selecione</option><option value="owner">Proprietário</option><option value="manager">Gerente ou administrador</option><option value="employee">Funcionário autorizado</option><option value="agency">Agência ou prestador autorizado</option><option value="other">Outro vínculo</option></select></label><label className="block text-sm font-extrabold text-ink">Como podemos confirmar sua relação?<textarea name="evidence" required minLength={10} maxLength={1500} className="mt-2 min-h-36 w-full rounded-xl border border-line bg-white px-4 py-3 text-base leading-7 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" placeholder="Explique de forma objetiva. Ex.: sou proprietário e posso confirmar pelo telefone comercial, domínio da empresa ou documentação." /></label><button type="submit" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 text-sm font-black text-white transition hover:bg-brand-dark">Enviar reivindicação</button></form>}
    </section>
  </div></main><SiteFooter /></>;
}
