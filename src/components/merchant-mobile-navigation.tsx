"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import {
  HomeIcon,
  LogOutIcon,
  MapPinIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StarIcon,
  StoreIcon,
  TagIcon,
  UserIcon,
} from "@/components/icons";

type MerchantMobileNavigationProps = {
  firstName: string;
  email: string;
  isAdmin: boolean;
  proActive: boolean;
};

const primaryNavigation = [
  { href: "/painel", label: "Início", icon: HomeIcon },
  { href: "/painel/loja", label: "Lojas", icon: StoreIcon },
  { href: "/painel/promocoes", label: "Promoções", icon: TagIcon },
  { href: "/painel/destaques", label: "Publicidade", icon: StarIcon },
];

export function MerchantMobileNavigation({
  firstName,
  email,
  isAdmin,
  proActive,
}: MerchantMobileNavigationProps) {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const menuId = useId();
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const closeMenu = () => setIsMoreMenuOpen(false);

  useEffect(() => {
    if (!isMoreMenuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsMoreMenuOpen(false);
      moreButtonRef.current?.focus();
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isMoreMenuOpen]);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden"
      aria-label="Navegação principal do comerciante"
    >
      {isMoreMenuOpen && (
        <div
          className="fixed inset-0 z-0 bg-transparent"
          aria-hidden="true"
          onPointerDown={closeMenu}
        />
      )}

      <div className="relative z-10 mx-auto grid max-w-xl grid-cols-5 px-1 pt-1.5">
        {primaryNavigation.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={closeMenu}
            className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-black text-muted transition active:bg-brand/8 active:text-brand-dark sm:text-[11px]"
          >
            <Icon className="size-5" />
            <span className="max-w-full truncate">{label}</span>
          </Link>
        ))}

        <button
          ref={moreButtonRef}
          type="button"
          className="flex min-h-[58px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-black text-muted transition active:bg-brand/8 active:text-brand-dark sm:text-[11px]"
          aria-expanded={isMoreMenuOpen}
          aria-controls={menuId}
          onClick={() => setIsMoreMenuOpen((open) => !open)}
        >
          <span
            className="grid h-5 place-items-center text-lg font-black leading-none"
            aria-hidden="true"
          >
            •••
          </span>
          <span>Mais</span>
        </button>

        {isMoreMenuOpen && (
          <div
            id={menuId}
            className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[70] mx-auto max-h-[calc(100dvh-6rem)] max-w-lg overflow-y-auto rounded-[1.5rem] border border-line bg-surface shadow-[0_24px_60px_rgba(15,23,42,0.2)]"
            aria-label="Mais opções"
          >
            <div className="border-b border-line px-4 py-3">
              <p className="text-sm font-black text-ink">Olá, {firstName}</p>
              <p className="mt-0.5 truncate text-xs font-semibold text-muted">
                {email}
              </p>
            </div>

            <div className="grid gap-1 p-2">
              <Link
                href="/painel/catalogo"
                onClick={closeMenu}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-extrabold text-ink transition hover:bg-canvas"
              >
                <TagIcon className="size-4 text-brand-dark" />
                Produtos e serviços
              </Link>
              <Link href="/painel/eventos" onClick={closeMenu} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-extrabold text-ink transition hover:bg-canvas"><StarIcon className="size-4 text-brand-dark" /> Meus eventos</Link>
              <Link
                href="/painel/planos-e-recursos"
                onClick={closeMenu}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-extrabold text-ink transition hover:bg-canvas"
              >
                <SparklesIcon className="size-4 text-brand-dark" />
                Planos e recursos
              </Link>
              <Link
                href="/painel/assinatura#calcadao-pro"
                onClick={closeMenu}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-black transition ${
                  proActive
                    ? "bg-positive-soft text-positive"
                    : "bg-brand text-white shadow-sm"
                }`}
              >
                <SparklesIcon className="size-4" />
                {proActive ? "Plano Pro ativo" : "Assinar Calçadão Pro"}
              </Link>
              <Link
                href="/painel/perfil"
                onClick={closeMenu}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-extrabold text-ink transition hover:bg-canvas"
              >
                <UserIcon className="size-4 text-brand-dark" />
                Minha conta
              </Link>
              <Link
                href="/"
                onClick={closeMenu}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-extrabold text-ink transition hover:bg-canvas"
              >
                <HomeIcon className="size-4 text-brand-dark" />
                Ver Centro Comercial
              </Link>

              {isAdmin && (
                <>
                  <div className="my-1 border-t border-line" />
                  <Link
                    href="/painel/admin/dashboard"
                    onClick={closeMenu}
                    className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-extrabold text-ink hover:bg-canvas"
                  >
                    <HomeIcon className="size-4" /> Dashboard admin
                  </Link>
                  <Link
                    href="/painel/admin/notificacoes"
                    onClick={closeMenu}
                    className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-extrabold text-ink hover:bg-canvas"
                  >
                    🔔 Notificações
                  </Link>
                  <Link
                    href="/painel/admin"
                    onClick={closeMenu}
                    className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-extrabold text-positive transition hover:bg-positive-soft"
                  >
                    <ShieldCheckIcon className="size-4" />
                    Moderação
                  </Link>
                  <Link
                    href="/painel/admin/locais-publicos"
                    onClick={closeMenu}
                    className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-extrabold text-ink transition hover:bg-canvas"
                  >
                    <MapPinIcon className="size-4" />
                    Locais públicos
                  </Link>
                  <Link
                    href="/painel/admin/destaques"
                    onClick={closeMenu}
                    className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-extrabold text-accent-dark transition hover:bg-accent/15"
                  >
                    <StarIcon className="size-4" />
                    Gerir publicidade
                  </Link>
                </>
              )}

              <div className="my-1 border-t border-line" />
              <form action={logoutAction} onSubmit={closeMenu}>
                <button
                  type="submit"
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-extrabold text-muted transition hover:bg-canvas hover:text-ink"
                >
                  <LogOutIcon className="size-4" />
                  Sair
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
