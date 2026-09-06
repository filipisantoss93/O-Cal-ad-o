import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-12">
      <div className="max-w-md text-center">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-brand-dark">
          Erro 404
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] text-ink">
          Este endereço não está no Centro Comercial.
        </h1>
        <p className="mt-4 text-base leading-7 text-muted">
          A página pode ter mudado ou o comércio ainda não está disponível.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-6 text-sm font-black text-white transition hover:bg-brand-dark"
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
