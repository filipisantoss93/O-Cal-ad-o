import type { ReactNode } from "react";
import Link from "next/link";

const adminLinks = [
  { href: "/painel/admin", label: "Moderação" },
  { href: "/painel/admin/perfis-nao-reivindicados", label: "Perfis não reivindicados" },
  { href: "/painel/admin/reivindicacoes", label: "Reivindicações" },
  { href: "/painel/admin/locais-publicos", label: "Locais públicos" },
  { href: "/painel/admin/dashboard", label: "Dashboard" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav
        aria-label="Ferramentas administrativas"
        className="mb-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
      >
        {adminLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-line bg-surface px-3 text-center text-xs font-black text-ink transition hover:border-brand/40 sm:min-h-9 sm:rounded-full"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
