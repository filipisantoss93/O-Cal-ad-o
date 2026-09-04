import type { Metadata } from "next";
import Link from "next/link";
import { ActionMessage, LoginForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";
import { redirectAuthenticatedMerchant } from "@/lib/auth/page";
import { safeNextPath } from "@/lib/validation";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse a área do comerciante do O Calçadão.",
};

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    erro?: string;
    conta?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  await redirectAuthenticatedMerchant();
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const notice =
    params.conta === "excluida"
      ? {
          status: "success" as const,
          message: "Sua conta e os dados vinculados foram excluídos.",
        }
      : params.erro
        ? {
            status: "error" as const,
            message:
              "O link é inválido ou expirou. Solicite um novo e tente novamente.",
          }
        : null;

  return (
    <AuthShell
      eyebrow="Área do comerciante"
      title="Bem-vindo de volta."
      description="Entre para administrar sua vitrine, promoções e dados da conta."
      footer={
        <p>
          Ainda não anuncia?{" "}
          <Link className="font-black text-brand-dark hover:underline" href="/cadastro">
            Crie sua conta grátis
          </Link>
        </p>
      }
    >
      <div className="mb-7">
        <h2 className="text-2xl font-black tracking-tight text-ink">
          Acessar conta
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Use o e-mail cadastrado para continuar.
        </p>
      </div>
      {notice && <ActionMessage state={notice} />}
      <LoginForm next={next} />
    </AuthShell>
  );
}
