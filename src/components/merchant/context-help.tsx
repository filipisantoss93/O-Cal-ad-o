import Link from "next/link";
import type { ReactNode } from "react";

type ContextHelpProps = {
  title: string;
  children: ReactNode;
  linkHref?: string;
  linkLabel?: string;
};

export function ContextHelp({
  title,
  children,
  linkHref = "/painel/planos-e-recursos",
  linkLabel = "Ver planos e recursos",
}: ContextHelpProps) {
  return (
    <details className="mb-6 rounded-2xl border border-brand/20 bg-brand/5 p-4 shadow-sm open:bg-surface sm:p-5">
      <summary className="cursor-pointer list-none text-sm font-black text-brand-dark marker:content-none">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true">ⓘ</span>
          O que é isso?
        </span>
      </summary>
      <div className="mt-4 border-t border-brand/10 pt-4">
        <h2 className="text-lg font-black tracking-tight text-ink">{title}</h2>
        <div className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-muted">
          {children}
        </div>
        {linkHref && (
          <Link
            href={linkHref}
            className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-brand/20 bg-white px-4 text-sm font-black text-brand-dark transition hover:bg-brand/5"
          >
            {linkLabel}
          </Link>
        )}
      </div>
    </details>
  );
}
