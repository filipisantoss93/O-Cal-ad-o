import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";
import { redirectAuthenticatedMerchant } from "@/lib/auth/page";
import { safeNextPath } from "@/lib/validation";

export const metadata: Metadata = { title: "Criar conta", description: "Crie sua conta de comerciante no O Calçadão." };
type SignupPageProps = { searchParams: Promise<{ next?: string }> };

export default async function SignupPage({ searchParams }: SignupPageProps) {
  await redirectAuthenticatedMerchant();
  const params = await searchParams;
  const next = safeNextPath(params.next);
  return <AuthShell eyebrow="Comece gratuitamente" title="Coloque seu negócio no Centro Comercial." description="Crie sua conta e prepare a vitrine que os consumidores da sua cidade vão encontrar." footer={<p>Já tem conta?{" "}<Link className="font-black text-brand-dark hover:underline" href={`/entrar?next=${encodeURIComponent(next)}`}>Entrar agora</Link></p>}>
    <div className="mb-7"><h2 className="text-2xl font-black tracking-tight text-ink">Criar conta de comerciante</h2><p className="mt-2 text-sm leading-6 text-muted">Depois do cadastro, você poderá completar os dados da sua loja.</p></div>
    <SignupForm next={next} />
  </AuthShell>;
}
