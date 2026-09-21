import type { Metadata } from "next";
import Link from "next/link";
import { ChargingExplorer } from "@/components/charging-explorer";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Eletropostos: perto de você e no caminho da viagem",
  description: "Encontre pontos de recarga para carros elétricos perto de você e consulte opções ao longo do trajeto, com potência, conectores, acesso e horários informados.",
};

export default function ChargingPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-[75vh] bg-canvas px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
        <div className="mx-auto max-w-5xl">
          <Link href="/" className="text-xs font-black text-brand-dark underline">← Início</Link>
          <div className="mb-6 mt-4">
            <span className="rounded-full bg-[#e4f6e9] px-3 py-1 text-xs font-black text-[#17633b]">⚡ Mobilidade elétrica</span>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-ink sm:text-4xl">Encontre seu próximo eletroposto</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Descubra carregadores perto de você ou planeje paradas em viagens por diferentes cidades.
              Dados de operadores e fontes abertas sujeitos a alterações.
            </p>
          </div>
          <ChargingExplorer />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
