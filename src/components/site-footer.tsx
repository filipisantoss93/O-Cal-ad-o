import Link from "next/link";
import { Logo } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-9 px-4 py-10 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-6 text-muted">
            A avenida digital que aproxima pessoas e negócios da mesma cidade.
          </p>
        </div>

        <div>
          <p className="text-sm font-black text-ink">Descobrir</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>
              <Link className="hover:text-ink" href="/buscar">
                Buscar comércios
              </Link>
            </li>
            <li>
              <Link className="hover:text-ink" href="/#categorias">
                Categorias
              </Link>
            </li>
            <li>
              <Link className="hover:text-ink" href="/#ofertas">
                Ofertas locais
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-black text-ink">Para negócios</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>
              <Link className="hover:text-ink" href="/cadastro">
                Criar minha vitrine
              </Link>
            </li>
            <li>
              <span>Planos para o comércio local</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line px-4 py-5 text-center text-xs text-muted">
        © {new Date().getFullYear()} O Calçadão. Feito para fortalecer o comércio
        local.
      </div>
    </footer>
  );
}
