import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Criar nova senha",
};

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/esqueci-senha");

  return (
    <AuthShell
      eyebrow="Nova senha"
      title="Proteja seu acesso."
      description="Escolha uma senha que você ainda não utiliza em outros serviços."
    >
      <div className="mb-7">
        <h2 className="text-2xl font-black tracking-tight text-ink">
          Definir nova senha
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Use no mínimo 8 caracteres, com uma letra e um número.
        </p>
      </div>
      <ResetPasswordForm />
    </AuthShell>
  );
}
