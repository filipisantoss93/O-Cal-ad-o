import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/(auth)/actions";
import {
  HomeIcon,
  LogOutIcon,
  MapPinIcon,
  ShieldCheckIcon,
  StarIcon,
  StoreIcon,
} from "@/components/icons";
import { AdminNotificationBadge } from "@/components/admin-notification-badge";
import { Logo } from "@/components/logo";
import { requireAdmin } from "@/lib/admin/dal";

export const metadata: Metadata = {
  manifest: "/admin/manifest.webmanifest",
  applicationName: "O Calçadão Admin",
  appleWebApp: { capable: true, title: "Calçadão Admin", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/admin/app-icon?size=192", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/admin/app-icon?size=180", sizes: "180x180", type: "image/png" }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false,
  themeColor: "#071017", colorScheme: "light",
};

const adminLinks = [
  { href: "/admin/dashboard", label: "Dashboard", icon: HomeIcon },
  { href: "/admin", label: "Moderação", icon: ShieldCheckIcon },
  { href: "/admin/perfis-nao-reivindicados", label: "Perfis não reivindicados", icon: StoreIcon },
  { href: "/admin/qualidade-seo", label: "Qualidade SEO", icon: ShieldCheckIcon },
  { href: "/admin/cadastros", label: "Usuários e empresas", icon: StoreIcon },
  { href: "/admin/reivindicacoes", label: "Reivindicações", icon: ShieldCheckIcon },
  { href: "/admin/locais-publicos", label: "Locais públicos", icon: MapPinIcon },
  { href: "/admin/destaques", label: "Publicidade", icon: StarIcon },
  { href: "/admin/eventos", label: "Destaques de eventos", icon: StarIcon },
  { href: "/admin/instalar", label: "Instalar app", icon: HomeIcon },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = await requireAdmin("/admin");
  const name =
    (typeof user.user_metadata.full_name === "string" && user.user_metadata.full_name.trim()) ||
    user.email ||
    "Administrador";

  return (
    <div className="min-h-screen bg-canvas">
      <a className="skip-link" href="#conteudo-admin">Ir para o conteúdo</a>

      <header className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Logo />
            <div className="hidden min-w-0 border-l border-line pl-3 sm:block">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">Painel Admin</p>
              <p className="truncate text-xs font-semibold text-muted">{name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AdminNotificationBadge userId={user.id} />
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-canvas px-3 text-sm font-extrabold text-ink transition hover:border-ink/20 hover:bg-white"
              >
                <LogOutIcon className="size-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <nav aria-label="Ferramentas administrativas" className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1500px] gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
          {adminLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-line bg-canvas px-3 text-xs font-black text-ink transition hover:border-brand/40 hover:bg-brand/5 sm:px-4 sm:text-sm"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
          <Link
            href="/admin/notificacoes"
            className="inline-flex min-h-10 shrink-0 items-center rounded-xl border border-line bg-canvas px-3 text-xs font-black text-ink transition hover:border-brand/40 hover:bg-brand/5 sm:px-4 sm:text-sm"
          >
            Notificações
          </Link>
          <Link
            href="/"
            className="ml-auto inline-flex min-h-10 shrink-0 items-center rounded-xl px-3 text-xs font-black text-brand-dark hover:underline sm:text-sm"
          >
            Ver plataforma
          </Link>
        </div>
      </nav>

      <main id="conteudo-admin" className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        {children}
      </main>
    </div>
  );
}
