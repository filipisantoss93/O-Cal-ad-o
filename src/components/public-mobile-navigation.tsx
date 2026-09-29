"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  SearchIcon,
  StarIcon,
  TagIcon,
  UserIcon,
} from "@/components/icons";

const items = [
  { href: "/", label: "Início", icon: HomeIcon },
  { href: "/buscar", label: "Explorar", icon: SearchIcon },
  { href: "/eventos", label: "Eventos", icon: StarIcon },
  { href: "/#ofertas", label: "Ofertas", icon: TagIcon },
  { href: "/entrar", label: "Entrar", icon: UserIcon },
] as const;

export function PublicMobileNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal no celular"
      className="fixed inset-x-0 bottom-0 z-[60] grid grid-cols-5 border-t border-line bg-surface/98 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(29,43,40,0.12)] backdrop-blur md:hidden"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.href === "/"
          ? pathname === "/"
          : item.href === "/#ofertas"
            ? false
            : pathname === item.href || pathname.startsWith(item.href + "/");

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              active ? "bg-canvas text-brand-dark" : "text-ink hover:bg-canvas"
            }`}
          >
            <Icon className="size-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
