import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import {
  HomeIcon,
  LogOutIcon,
  SparklesIcon,
  StoreIcon,
  TagIcon,
  UserIcon,
  ShieldCheckIcon,
  StarIcon,
} from "@/components/icons";
import { Logo } from "@/components/logo";

type MerchantShellProps = {
  name: string;
  email: string;
  isAdmin: boolean;
  children: ReactNode;
};

const navigation = [
  { href: "/painel", label: "Visão geral", icon: HomeIcon },
  { href: "/painel/loja", label: "Minhas lojas", icon: StoreIcon },
  { href: "/painel/promocoes", label: "Promoções", icon: TagIcon },
  { href: "/painel/destaques", label: "Destaques", icon: StarIcon },
  { href: "/painel/assinatura", label: "Assinatura", icon: SparklesIcon },
  { href: "/painel/perfil", label: "Minha conta", icon: UserIcon },
];

export function MerchantShell({
  name,
  email,
  isAdmin,
  children,
}: MerchantShellProps) {
  const firstName = name.trim().split(/\s+/)[0] || "Comerciante";

  return (
    <div className="min-h-screen bg-canvas">
      <a className="skip-link" href="#conteudo-painel">
        Ir para o conteúdo
      </a>
      <header className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Logo />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-black text-ink">Olá, {firstName}</p>
              <p className="max-w-52 truncate text-xs font-semibold text-muted">
                {email}
              </p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-canvas px-3 text-sm font-extrabold text-ink transition hover:border-ink/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                title="Sair da conta"
              >
                <LogOutIcon className="size-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <nav
        className="border-b border-line bg-surface"
        aria-label="Área do comerciante"
      >
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-line bg-canvas px-4 text-sm font-extrabold text-muted transition hover:border-brand/30 hover:bg-brand/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
          {isAdmin && (
            <>
              <Link
                href="/painel/admin"
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-positive/20 bg-positive-soft px-4 text-sm font-extrabold text-positive transition hover:border-positive/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-positive"
              >
                <ShieldCheckIcon className="size-4" />
                Moderação
              </Link>
              <Link
                href="/painel/admin/destaques"
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-accent-dark/20 bg-accent/20 px-4 text-sm font-extrabold text-ink transition hover:border-accent-dark/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-dark"
              >
                <StarIcon className="size-4" />
                Gerir destaques
              </Link>
            </>
          )}
          <Link
            href="/"
            className="ml-auto inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm font-extrabold text-brand-dark hover:underline"
          >
            Ver Centro Comercial
          </Link>
        </div>
      </nav>

      <main id="conteudo-painel" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {children}
      </main>
    </div>
  );
}
