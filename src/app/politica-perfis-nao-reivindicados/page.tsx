import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Política de perfis não reivindicados", description: "Política de correção, atualização, reivindicação e remoção de perfis não reivindicados no O Calçadão." };

export default function UnclaimedProfilesPolicyPage() {
  return <><SiteHeader /><main className="min-h-[70vh] bg-canvas px-4 py-10 sm:px-6"><article className="mx-auto max-w-3xl rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8">
    <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">O Calçadão</p>
    <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">Política de perfis não reivindicados</h1>
    <p className="mt-4 text-sm leading-7 text-muted">O O Calçadão pode disponibilizar perfis informativos de estabelecimentos ainda não reivindicados por seus responsáveis, utilizando informações comerciais disponíveis publicamente, como nome, categoria, endereço e localização.</p>
    <p className="mt-4 text-sm leading-7 text-muted">Esses perfis têm finalidade informativa e de divulgação comercial gratuita, facilitando que consumidores encontrem estabelecimentos e serviços de sua região.</p>
    <div className="mt-8 space-y-6">
      <section><h2 className="text-xl font-black text-ink">Correção ou atualização</h2><p className="mt-2 text-sm leading-7 text-muted">Caso alguma informação esteja incorreta ou desatualizada, qualquer pessoa poderá solicitar correção. O O Calçadão poderá pedir informações adicionais para verificar a solicitação.</p></section>
      <section><h2 className="text-xl font-black text-ink">Reivindicação do perfil</h2><p className="mt-2 text-sm leading-7 text-muted">O proprietário ou representante autorizado poderá solicitar a reivindicação. A transferência da vitrine somente ocorre após análise administrativa.</p></section>
      <section><h2 className="text-xl font-black text-ink">Remoção do perfil</h2><p className="mt-2 text-sm leading-7 text-muted">O proprietário ou representante autorizado poderá solicitar a remoção de um perfil não reivindicado. Após a validação, o perfil poderá ser despublicado ou removido, respeitadas eventuais obrigações legais de conservação de informações.</p></section>
      <section><h2 className="text-xl font-black text-ink">Nosso compromisso</h2><p className="mt-2 text-sm leading-7 text-muted">Buscamos manter informações corretas, atualizadas e limitadas ao necessário para sua finalidade, oferecendo meios simples para correção, atualização, reivindicação ou remoção.</p></section>
    </div>
    <p className="mt-8 text-xs font-semibold text-muted">Última atualização: setembro de 2026.</p>
    <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-line bg-white px-4 text-sm font-black text-ink">Voltar ao O Calçadão</Link>
  </article></main><SiteFooter /></>;
}
