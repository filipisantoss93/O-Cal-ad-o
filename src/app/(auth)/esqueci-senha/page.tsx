import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = {
  title: "Recuperar senha",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Recuperação de acesso"
      title="Vamos recuperar sua conta."
      description="Informe o e-mail cadastrado e enviaremos um link seguro para você criar uma nova senha."
      footer={
        <Link className="font-black text-brand-dark hover:underline" href="/entrar">
          Voltar para o login
        </Link>
      }
    >
      <div className="mb-7">
        <h2 className="text-2xl font-black tracking-tight text-ink">
          Esqueci minha senha
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          O link recebido por e-mail terá uso temporário.
        </p>
      </div>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
