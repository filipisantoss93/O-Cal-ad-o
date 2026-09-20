"use client";

import Link from "next/link";

export default function AdminDashboardError({ reset }: { reset: () => void }) {
  return (
    <section role="alert" className="mx-auto max-w-xl rounded-3xl border border-line bg-surface p-6 text-center shadow-sm sm:p-9">
      <span aria-hidden="true" className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff0df] text-2xl">!</span>
      <h1 className="mt-5 text-2xl font-black text-ink">Indicadores indisponíveis</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        O dashboard não pôde ser atualizado. As demais ferramentas administrativas continuam acessíveis pelo menu.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-black text-white">
          Tentar novamente
        </button>
        <Link href="/admin" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-5 text-sm font-black text-ink">
          Abrir moderação
        </Link>
      </div>
    </section>
  );
}
