import type { ReactNode } from "react";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ShieldCheckIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import type { DatabaseWithBusinessClaims } from "@/types/business-claims";

type Props = { children: ReactNode; params: Promise<{ slug: string }> };

export default async function BusinessSlugLayout({ children, params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const client = supabase as unknown as SupabaseClient<DatabaseWithBusinessClaims>;
  const { data: business } = await client.from("businesses").select("slug, listing_type, pre_registered, owner_id, is_active").eq("slug", slug).limit(1).maybeSingle();
  const showUnclaimedNotice = business?.listing_type === "business" && business.pre_registered === true && business.owner_id === null && business.is_active === true;

  return <>{showUnclaimedNotice && <div className="border-b border-brand/20 bg-brand/8 px-4 py-3 sm:px-6"><div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2"><ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-brand-dark" /><div><p className="text-sm font-black text-ink">Perfil ainda não reivindicado</p><p className="mt-0.5 text-xs font-semibold leading-5 text-muted">Informações públicas. O responsável ainda não administra esta vitrine no O Calçadão.</p></div></div><div className="flex flex-wrap gap-2"><Link href={`/reivindicar/${slug}`} className="inline-flex min-h-10 items-center rounded-xl bg-brand px-4 text-xs font-black text-white transition hover:bg-brand-dark">Sou responsável</Link><Link href={`/loja/${slug}/solicitar-alteracao`} className="inline-flex min-h-10 items-center rounded-xl border border-line bg-white px-4 text-xs font-black text-ink">Corrigir ou remover</Link><Link href="/politica-perfis-nao-reivindicados" className="inline-flex min-h-10 items-center px-2 text-xs font-black text-brand-dark hover:underline">Como funciona</Link></div></div></div>}{children}</>;
}
