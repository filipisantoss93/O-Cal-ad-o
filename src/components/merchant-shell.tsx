import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import {
  HomeIcon,
  LogOutIcon,
  MapPinIcon,
  SparklesIcon,
  StoreIcon,
  TagIcon,
  UserIcon,
  ShieldCheckIcon,
  StarIcon,
} from "@/components/icons";
import { Logo } from "@/components/logo";
import { AdminNotificationBadge } from "@/components/admin-notification-badge";
import { MerchantMobileNavigation } from "@/components/merchant-mobile-navigation";

type MerchantShellProps = {
  name: string;
  email: string;
  isAdmin: boolean;
  adminUserId: string;
  proActive: boolean;
  monthlyPriceCents: number | null;
  children: ReactNode;
};

const desktopNavigation = [
  { href: "/painel", label: "Visão geral", icon: HomeIcon },
  { href: "/painel/loja", label: "Minhas lojas", icon: StoreIcon },
  { href: "/painel/catalogo", label: "Produtos e serviços", icon: TagIcon },
  { href: "/painel/promocoes", label: "Promoções", icon: TagIcon },
  { href: "/painel/eventos", label: "Meus eventos", icon: StarIcon },
  { href: "/painel/destaques", label: "Publicidade", icon: StarIcon },
  { href: "/painel/planos-e-recursos", label: "Planos e recursos", icon: SparklesIcon },
  { href: "/painel/perfil", label: "Minha conta", icon: UserIcon },
];

function money(cents: number | null) {
  if (cents === null) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function MerchantShell({
  name,
  email,
  isAdmin,
  adminUserId,
  proActive,
  monthlyPriceCents,
  children,
}: MerchantShellProps) {
  const firstName = name.trim().split(/\s+/)[0] || "Comerciante";
  const monthlyPrice = money(monthlyPriceCents);

  return (
    <div className="min-h-screen bg-canvas">
      <a className="skip-link" href="#conteudo-painel">
        Ir para o conteúdo
      </a>

      <header className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:min-h-18 lg:px-8">
          <Logo />

          <div className="flex items-center gap-3">
            {isAdmin && <AdminNotificationBadge userId={adminUserId} />}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-black text-ink">Olá, {firstName}</p>
              <p className="max-w-52 truncate text-xs font-semibold text-muted">
                {email}
              </p>
            </div>

            <Link
              href="/painel/perfil"
              className="grid size-10 place-items-center rounded-xl border border-line bg-canvas text-ink transition hover:border-brand/30 hover:bg-brand/5 lg:hidden"
              aria-label={`Abrir conta de ${firstName}`}
            >
              <UserIcon className="size-4" />
            </Link>

            <form action={logoutAction} className="hidden lg:block">
              <button
                type="submit"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-canvas px-3 text-sm font-extrabold text-ink transition hover:border-ink/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                title="Sair da conta"
              >
                <LogOutIcon className="size-4" />
                <span>Sair</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <nav
        className="hidden border-b border-line bg-surface lg:block"
        aria-label="Área do comerciante"
      >
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-8 py-3">
          {desktopNavigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-line bg-canvas px-4 text-sm font-extrabold text-muted transition hover:border-brand/30 hover:bg-brand/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}

          <Link
            href="/painel/assinatura#calcadao-pro"
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              proActive
                ? "border border-positive/25 bg-positive-soft text-positive hover:border-positive/40 focus-visible:ring-positive"
                : "border border-brand bg-brand text-white shadow-[0_8px_18px_rgba(185,61,37,0.22)] hover:bg-brand-dark focus-visible:ring-brand"
            }`}
          >
            <SparklesIcon className="size-4" />
            {proActive ? "Plano Pro ativo" : "Assinar Pro"}
            {!proActive && (
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide">
                Pro
              </span>
            )}
          </Link>

          {isAdmin && (
            <>
              <Link href="/painel/admin/dashboard" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-line bg-canvas px-4 text-sm font-extrabold text-ink hover:border-brand/30 hover:bg-brand/5"><HomeIcon className="size-4" /> Dashboard</Link>
              <Link href="/painel/admin/notificacoes" className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-line bg-canvas px-4 text-sm font-extrabold text-ink">Notificações</Link>
              <Link
                href="/painel/admin"
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-positive/20 bg-positive-soft px-4 text-sm font-extrabold text-positive transition hover:border-positive/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-positive"
              >
                <ShieldCheckIcon className="size-4" />
                Moderação
              </Link>
              <Link
                href="/painel/admin/locais-publicos"
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-line bg-canvas px-4 text-sm font-extrabold text-ink transition hover:border-brand/30 hover:bg-brand/5"
              >
                <MapPinIcon className="size-4" />
                Locais públicos
              </Link>
              <Link
                href="/painel/admin/destaques"
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-accent-dark/20 bg-accent/20 px-4 text-sm font-extrabold text-ink transition hover:border-accent-dark/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-dark"
              >
                <StarIcon className="size-4" />
                Gerir publicidade
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

      {!proActive && (
        <section className="border-b border-brand/20 bg-brand/8">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-4">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-sm lg:size-10">
                <SparklesIcon className="size-4 lg:size-5" />
              </span>
              <div>
                <p className="text-sm font-black text-ink">
                  Cresça com o Calçadão Pro
                </p>
                <p className="mt-0.5 text-xs font-semibold leading-5 text-muted sm:text-sm sm:leading-6">
                  3 lojas + 10 promoções por loja
                  {monthlyPrice ? ` por ${monthlyPrice}/mês` : " com o plano Pro"}.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2 pl-12 sm:pl-0">
              <Link
                href="/painel/planos-e-recursos"
                className="inline-flex min-h-9 items-center justify-center rounded-xl border border-brand/20 bg-white px-3 text-xs font-black text-brand-dark transition hover:bg-brand/5 sm:min-h-10 sm:px-4 sm:text-sm"
              >
                Comparar
              </Link>
              <Link
                href="/painel/assinatura#calcadao-pro"
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-brand px-3 text-xs font-black text-white shadow-sm transition hover:bg-brand-dark sm:min-h-10 sm:px-4 sm:text-sm"
              >
                <SparklesIcon className="size-4" />
                Assinar Pro
              </Link>
            </div>
          </div>
        </section>
      )}

      <main
        id="conteudo-painel"
        className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 sm:py-8 sm:pb-28 lg:px-8 lg:py-10 lg:pb-10"
      >
        {children}
      </main>

      <MerchantMobileNavigation
        firstName={firstName}
        email={email}
        isAdmin={isAdmin}
        proActive={proActive}
      />
    </div>
  );
}
