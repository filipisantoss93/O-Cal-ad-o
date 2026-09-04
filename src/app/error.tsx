"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-12">
      <div className="max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff0df] text-2xl">
          !
        </span>
        <h1 className="mt-5 text-2xl font-black text-ink">
          Algo não saiu como esperado
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Não conseguimos carregar esta página. Tente novamente em instantes.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-black text-white transition hover:bg-ink-soft"
        >
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
