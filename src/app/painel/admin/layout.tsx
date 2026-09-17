import type { ReactNode } from "react";
import Link from "next/link";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <><nav aria-label="Ferramentas administrativas" className="mb-5 flex gap-2 overflow-x-auto pb-1"><Link href="/painel/admin" className="shrink-0 rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-black text-ink">Moderação</Link><Link href="/painel/admin/dashboard" className="shrink-0 rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-black text-ink">Dashboard</Link><Link href="/painel/admin/locais-publicos" className="shrink-0 rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-black text-ink">Locais públicos</Link><Link href="/painel/admin/perfis-nao-reivindicados" className="shrink-0 rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-black text-ink">Perfis não reivindicados</Link><Link href="/painel/admin/reivindicacoes" className="shrink-0 rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-black text-ink">Reivindicações</Link></nav>{children}</>;
}
