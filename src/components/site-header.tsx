import Link from "next/link";
import { Logo } from "@/components/logo";
import { StoreIcon } from "@/components/icons";
import { CitySelector } from "@/components/city-selector";

export function SiteHeader() {
  return (
    <>
    <header className="sticky top-0 z-50 w-full max-w-full overflow-x-hidden border-b border-line/80 bg-canvas/92 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-2.5 px-4 sm:min-h-18 sm:gap-4 sm:px-6 lg:px-8">
        <Logo />

        <nav
          className="hidden items-center gap-7 text-sm font-semibold text-muted md:flex"
          aria-label="Navegação principal"
        >
          <Link className="transition-colors hover:text-ink" href="/eletropostos">Eletropostos</Link>
          <Link className="transition-colors hover:text-ink" href="/descobrir">
            Descobrir
          </Link>
          <Link
            className="transition-colors hover:text-ink"
            href="/#categorias"
          >
            Categorias
          </Link>
          <Link
            className="transition-colors hover:text-ink"
            href="/#ofertas"
          >
            Ofertas
          </Link>
          <Link className="transition-colors hover:text-ink" href="/eventos">Eventos</Link>
          <Link className="transition-colors hover:text-ink" href="/planos">
            Planos
          </Link>
        </nav>

        <div className="flex items-center gap-0.5 sm:gap-2">
          <CitySelector />
          <Link
            href="/entrar"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-ink/10 bg-surface px-3 text-[13px] font-extrabold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:min-h-11 sm:gap-2 sm:px-5 sm:text-sm"
          >
            <StoreIcon className="size-4" />
            <span className="hidden sm:inline">Sou comerciante</span>
            <span className="sm:hidden">Anunciar</span>
          </Link>
        </div>
      </div>
    </header>
    <nav aria-label="Navegação móvel" className="fixed inset-x-0 bottom-0 z-[60] grid grid-cols-5 border-t border-line bg-surface/98 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(29,43,40,0.08)] backdrop-blur md:hidden">
      {[
        { href: "/", label: "Início" },
        { href: "/buscar", label: "Explorar" },
        { href: "/eventos", label: "Eventos" },
        { href: "/#ofertas", label: "Ofertas" },
        { href: "/entrar", label: "Entrar" },
      ].map((item) => (
        <Link key={item.href} href={item.href} className="flex min-h-12 min-w-0 items-center justify-center rounded-lg px-1 text-[11px] font-extrabold text-ink transition hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          {item.label}
        </Link>
      ))}
    </nav>
    </>
  );
}
