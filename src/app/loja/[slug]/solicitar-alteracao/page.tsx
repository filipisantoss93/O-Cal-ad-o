import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requestBusinessListingChangeAction } from "@/app/loja/[slug]/solicitar-alteracao/actions";
import { FloatingNotice } from "@/components/floating-notice";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithBusinessClaims } from "@/types/business-claims";

export const metadata: Metadata = { title: "Corrigir ou remover perfil não reivindicado" };
type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<{ sucesso?: string; erro?: string }> };

export default async function RequestListingChangePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const messages = await searchParams;
  const supabase = await createClient();
  const client = supabase as unknown as SupabaseClient<DatabaseWithBusinessClaims>;
  const { data: business, error } = await client.from("businesses").select("id, name, slug, pre_registered, owner_id, is_active, street, address_number, neighborhood, cities(name, state_code)").eq("slug", slug).eq("listing_type", "business").maybeSingle();
  if (error || !business) notFound();
  const city = Array.isArray(business.cities) ? business.cities[0] : business.cities;
  const available = business.pre_registered && !business.owner_id;

  return <><SiteHeader /><main className="min-h-[70vh] bg-canvas px-4 py-10 sm:px-6"><div className="mx-auto max-w-2xl">
    <Link href={`/loja/${business.slug}`} className="text-sm font-black text-brand-dark hover:underline">← Voltar ao estabelecimento</Link>
    <section className="mt-5 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">Perfil informativo</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">Corrigir, atualizar ou remover</h1>
      <p className="mt-3 text-sm leading-6 text-muted">{business.name} · {business.street}, {business.address_number} · {business.neighborhood}{city ? ` · ${city.name}/${city.state_code}` : ""}</p>
      {messages.sucesso && <FloatingNotice tone="success">{messages.sucesso}</FloatingNotice>}
      {messages.erro && <FloatingNotice tone="error">{messages.erro}</FloatingNotice>}
      {!available ? <div className="mt-7 rounded-2xl border border-line bg-canvas p-5"><p className="font-black text-ink">Este perfil já foi reivindicado.</p><p className="mt-2 text-sm leading-6 text-muted">Alterações de vitrines reivindicadas devem ser feitas pelo responsável no painel da conta.</p></div> : <form action={requestBusinessListingChangeAction} className="mt-7 space-y-5">
        <input type="hidden" name="slug" value={business.slug} />
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-extrabold text-ink">Seu nome<input name="requester_name" required minLength={2} maxLength={120} className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" /></label><label className="block text-sm font-extrabold text-ink">E-mail para contato<input name="requester_email" type="email" required maxLength={254} className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" /></label></div>
        <label className="block text-sm font-extrabold text-ink">Tipo de solicitação<select name="request_type" required defaultValue="" className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"><option value="" disabled>Selecione</option><option value="correction">Corrigir informação incorreta</option><option value="update">Atualizar informação desatualizada</option><option value="removal">Solicitar remoção do perfil</option></select></label>
        <label className="block text-sm font-extrabold text-ink">Explique a solicitação<textarea name="details" required minLength={10} maxLength={2000} className="mt-2 min-h-40 w-full rounded-xl border border-line bg-white px-4 py-3 text-base leading-7 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" placeholder="Informe o dado correto ou explique por que o perfil deve ser removido." /></label>
        <p className="text-xs font-semibold leading-5 text-muted">Podemos solicitar informações adicionais para confirmar a solicitação. Consulte também nossa <Link href="/politica-perfis-nao-reivindicados" className="font-black text-brand-dark hover:underline">política para perfis não reivindicados</Link>.</p>
        <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 text-sm font-black text-white transition hover:bg-brand-dark">Enviar solicitação</button>
      </form>}
    </section>
  </div></main><SiteFooter /></>;
}
