"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { actionError } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";
import {
  formString,
  normalizePhone,
  requiredText,
  validateEmail,
  validatePassword,
  ValidationError,
} from "@/lib/validation";

function appUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function profileError(error: unknown, fallback: string): ActionState {
  if (error instanceof ValidationError) {
    return actionError(error.message, error.field);
  }
  return actionError(fallback);
}

function credentialError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "A senha atual está incorreta.";
  }
  if (normalized.includes("same password")) {
    return "A nova senha precisa ser diferente da atual.";
  }
  if (normalized.includes("password")) {
    return "Não foi possível usar esta senha. Escolha outra.";
  }
  if (normalized.includes("rate limit")) {
    return "Muitas tentativas seguidas. Aguarde alguns minutos.";
  }
  return "Não foi possível concluir. Tente novamente.";
}

export async function updateProfileAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const fullName = requiredText(
      formData,
      "full_name",
      "Seu nome",
      2,
      120,
    );
    const phone = normalizePhone(
      formString(formData, "phone_e164"),
      "phone_e164",
      false,
    );
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return actionError("Sua sessão expirou. Entre novamente.");

    const { error } = await supabase
      .from("profiles")
      .upsert(
        { id: user.id, full_name: fullName, phone_e164: phone },
        { onConflict: "id" },
      );
    if (error) return actionError("Não foi possível salvar seu cadastro.");

    await supabase.auth.updateUser({ data: { full_name: fullName } });
    revalidatePath("/painel");
    revalidatePath("/painel/perfil");
    return { status: "success", message: "Dados pessoais atualizados." };
  } catch (error) {
    return profileError(error, "Não foi possível salvar seu cadastro.");
  }
}

export async function updateEmailAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const newEmail = validateEmail(
      formString(formData, "new_email"),
      "new_email",
    );
    const currentPassword = formString(formData, "current_password");
    if (!currentPassword) {
      return actionError("Informe sua senha atual.", "current_password");
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return actionError("Sua sessão expirou. Entre novamente.");
    if (user.email.toLowerCase() === newEmail) {
      return actionError("Este já é o e-mail da sua conta.", "new_email");
    }

    const signIn = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (signIn.error) {
      return actionError(
        credentialError(signIn.error.message),
        "current_password",
      );
    }

    const { error } = await supabase.auth.updateUser(
      { email: newEmail },
      {
        emailRedirectTo: `${appUrl()}/auth/confirm?next=/painel/perfil?email=confirmado`,
      },
    );
    if (error) return actionError(credentialError(error.message));

    return {
      status: "success",
      message:
        "Pedido enviado. Confirme a alteração pelos e-mails de segurança recebidos.",
    };
  } catch (error) {
    return profileError(error, "Não foi possível alterar o e-mail.");
  }
}

export async function updatePasswordAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const currentPassword = formString(formData, "current_password");
    if (!currentPassword) {
      return actionError("Informe sua senha atual.", "current_password");
    }
    const newPassword = validatePassword(
      formString(formData, "new_password"),
      "new_password",
    );
    const confirmation = formString(formData, "password_confirmation");
    if (newPassword !== confirmation) {
      return actionError(
        "As novas senhas não são iguais.",
        "password_confirmation",
      );
    }
    if (newPassword === currentPassword) {
      return actionError(
        "A nova senha precisa ser diferente da atual.",
        "new_password",
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return actionError("Sua sessão expirou. Entre novamente.");

    const signIn = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (signIn.error) {
      return actionError(
        credentialError(signIn.error.message),
        "current_password",
      );
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) return actionError(credentialError(error.message));

    return { status: "success", message: "Senha alterada com segurança." };
  } catch (error) {
    return profileError(error, "Não foi possível alterar a senha.");
  }
}

export async function deleteAccountAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    if (formString(formData, "confirmation") !== "EXCLUIR") {
      return actionError(
        "Digite EXCLUIR exatamente como indicado.",
        "confirmation",
      );
    }
    const currentPassword = formString(formData, "current_password");
    if (!currentPassword) {
      return actionError("Informe sua senha atual.", "current_password");
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return actionError("Sua sessão expirou. Entre novamente.");

    const signIn = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (signIn.error) {
      return actionError(
        credentialError(signIn.error.message),
        "current_password",
      );
    }

    const { data, error } = await supabase.functions.invoke("delete-account", {
      body: { confirmation: "EXCLUIR" },
    });
    if (error || !data?.success) {
      return actionError(
        "Não foi possível excluir a conta agora. Tente novamente.",
      );
    }
    await supabase.auth.signOut({ scope: "local" });
  } catch (error) {
    return profileError(error, "Não foi possível excluir a conta agora.");
  }

  redirect("/entrar?conta=excluida");
}
