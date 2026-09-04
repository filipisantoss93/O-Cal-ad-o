import type { Metadata } from "next";
import {
  DeleteAccountForm,
  EmailForm,
  PasswordForm,
  ProfileForm,
} from "@/components/merchant/account-forms";
import { ShieldCheckIcon, UserIcon } from "@/components/icons";
import { getMerchantWorkspace } from "@/lib/merchant/dal";

export const metadata: Metadata = {
  title: "Minha conta",
};

type ProfilePageProps = {
  searchParams: Promise<{ senha?: string; email?: string }>;
};

export default async function ProfilePage({
  searchParams,
}: ProfilePageProps) {
  const params = await searchParams;
  const { user, profile } = await getMerchantWorkspace("/painel/perfil");

  return (
    <div>
      <div className="flex items-start gap-4">
        <span className="hidden size-12 place-items-center rounded-2xl bg-positive-soft text-positive sm:grid">
          <UserIcon className="size-5" />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
            Acesso e segurança
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">
            Minha conta
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted">
            Atualize seus dados pessoais, e-mail e senha.
          </p>
        </div>
      </div>

      {(params.senha === "alterada" || params.email === "confirmado") && (
        <div
          role="status"
          className="mt-6 flex gap-3 rounded-2xl border border-positive/20 bg-positive-soft p-4 text-positive"
        >
          <ShieldCheckIcon className="mt-0.5 size-5 shrink-0" />
          <p className="text-sm font-bold leading-6">
            {params.senha === "alterada"
              ? "Sua nova senha foi salva."
              : "A confirmação do novo e-mail foi processada."}
          </p>
        </div>
      )}

      <div className="mt-8 space-y-6">
        <AccountSection
          title="Dados pessoais"
          description="Informações do responsável pela conta. O telefone pessoal não aparece na loja."
        >
          <ProfileForm
            fullName={
              profile?.full_name ||
              (typeof user.user_metadata.full_name === "string"
                ? user.user_metadata.full_name
                : "")
            }
            phone={profile?.phone_e164 ?? ""}
          />
        </AccountSection>

        <AccountSection
          title="E-mail de acesso"
          description="É por este endereço que você entra e recebe mensagens de segurança."
        >
          <EmailForm currentEmail={user.email ?? ""} />
        </AccountSection>

        <AccountSection
          title="Alterar senha"
          description="Confirme sua senha atual antes de escolher uma nova."
        >
          <PasswordForm />
        </AccountSection>

        <section className="rounded-[2rem] border border-brand/25 bg-surface p-5 shadow-sm sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
              Zona de perigo
            </p>
            <h2 className="mt-2 text-2xl font-black text-ink">Excluir conta</h2>
          </div>
          <DeleteAccountForm />
        </section>
      </div>
    </div>
  );
}

function AccountSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-black text-ink">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}
