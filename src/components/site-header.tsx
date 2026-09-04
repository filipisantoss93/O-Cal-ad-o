import Link from "next/link";
import { Logo } from "@/components/logo";
import { StoreIcon } from "@/components/icons";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-canvas/92 backdrop-blur-xl">
      <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav
          className="hidden items-center gap-7 text-sm font-semibold text-muted md:flex"
          aria-label="Navegação principal"
        >
          <Link className="transition-colors hover:text-ink" href="/buscar">
            Explorar
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
        </nav>

        <Link
          href="/entrar"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-ink/10 bg-surface px-4 text-sm font-extrabold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:px-5"
        >
          <StoreIcon className="size-4" />
          <span className="hidden sm:inline">Sou comerciante</span>
          <span className="sm:hidden">Anunciar</span>
        </Link>
      </div>
    </header>
  );
}
