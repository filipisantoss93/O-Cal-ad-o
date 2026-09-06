import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-canvas px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          <Link
            href="/"
            className="rounded-lg text-sm font-extrabold text-muted outline-none transition hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
          >
            Voltar ao Centro Comercial
          </Link>
        </div>

        <div className="mt-8 grid overflow-hidden rounded-[2rem] border border-line bg-surface shadow-[0_28px_80px_rgba(31,45,42,0.11)] lg:grid-cols-[0.78fr_1.22fr]">
          <aside className="relative overflow-hidden bg-ink p-7 text-white sm:p-10 lg:p-12">
            <div className="absolute -right-20 -top-20 size-64 rounded-full bg-brand/25 blur-3xl" />
            <div className="absolute -bottom-28 -left-20 size-72 rounded-full bg-accent/20 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">
                {eyebrow}
              </p>
              <h1 className="mt-4 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
                {title}
              </h1>
              <p className="mt-4 max-w-md text-base leading-7 text-white/70">
                {description}
              </p>
              <div className="mt-10 space-y-3 text-sm font-bold text-white/80">
                <p className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  Publique sua loja e mantenha seus dados atualizados.
                </p>
                <p className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  Crie promoções e receba contatos direto no WhatsApp.
                </p>
              </div>
            </div>
          </aside>

          <section className="p-6 sm:p-10 lg:p-12">
            {children}
            {footer && (
              <div className="mt-7 border-t border-line pt-6 text-center text-sm text-muted">
                {footer}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
