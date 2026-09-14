import type { Metadata } from "next";
import { SupportForm } from "@/components/public-message-forms";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = { title: "Contato e suporte" };

export default function ContactPage() {
  return <><SiteHeader /><main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
    <p className="text-xs font-black uppercase tracking-widest text-brand-dark">O Calçadão</p>
    <h1 className="mt-2 text-3xl font-black text-ink sm:text-4xl">Fale com o suporte</h1>
    <p className="mb-8 mt-3 text-sm leading-6 text-muted">Dúvidas sobre sua conta, vitrine ou uso da plataforma? Envie uma mensagem para a equipe.</p>
    <SupportForm />
  </main><SiteFooter /></>;
}
