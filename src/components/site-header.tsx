import Link from "next/link";
import { Logo } from "@/components/logo";
import { CitySelector } from "@/components/city-selector";
import { PublicMobileNavigation } from "@/components/public-mobile-navigation";
import { ThemeSelect } from "@/components/theme-select";

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
            href="/ofertas"
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
          <ThemeSelect />
        </div>
      </div>
    </header>
    <PublicMobileNavigation />
    </>
  );
}
