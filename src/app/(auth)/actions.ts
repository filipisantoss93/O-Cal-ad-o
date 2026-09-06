"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { actionError } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";
import {
  formString,
  requiredText,
  safeNextPath,
  validateEmail,
  validatePassword,
  ValidationError,
} from "@/lib/validation";

function appUrl() {
  if (process.env.VERCEL_ENV === "production") {
    return "https://ocalcadao.com.br";
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function authErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("email not confirmed")
  ) {
    return normalized.includes("email not confirmed")
      ? "Confirme seu e-mail antes de entrar."
      : "E-mail ou senha incorretos.";
  }
  if (
    normalized.includes("rate limit") ||
    normalized.includes("over_email_send_rate_limit") ||
    normalized.includes("security purposes")
  ) {
    return "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.";
  }
  if (normalized.includes("password")) {
    return "Não foi possível usar esta senha. Escolha outra e tente novamente.";
  }
  return "Não foi possível concluir agora. Tente novamente.";
}

function validationState(error: unknown): ActionState {
  if (error instanceof ValidationError) {
    return actionError(error.message, error.field);
  }
  return actionError("Não foi possível concluir agora. Tente novamente.");
}

export async function loginAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let destination = "/painel";
  try {
    const email = validateEmail(formString(formData, "email"));
    const password = formString(formData, "password");
    if (!password) {
      return actionError("Informe sua senha.", "password");
    }
    destination = safeNextPath(formString(formData, "next"));

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return actionError(authErrorMessage(error.message));
  } catch (error) {
    return validationState(error);
  }

  redirect(destination);
}

export async function signupAction(
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
    const email = validateEmail(formString(formData, "email"));
    const password = validatePassword(formString(formData, "password"));
    const passwordConfirmation = formString(formData, "password_confirmation");
    if (password !== passwordConfirmation) {
      return actionError("As senhas não são iguais.", "password_confirmation");
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${appUrl()}/auth/confirm?next=/painel`,
      },
    });

    if (error) return actionError(authErrorMessage(error.message));
    if (!data.session) {
      return {
        status: "success",
        message:
          "Cadastro recebido. Abra o e-mail enviado pelo O Calçadão para confirmar sua conta.",
      };
    }
  } catch (error) {
    return validationState(error);
  }

  redirect("/painel?boas-vindas=1");
}

export async function requestPasswordResetAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const email = validateEmail(formString(formData, "email"));
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl()}/auth/confirm?next=/redefinir-senha`,
    });

    if (error) return actionError(authErrorMessage(error.message));

    return {
      status: "success",
      message:
        "Se esse e-mail estiver cadastrado, você receberá um link para criar uma nova senha.",
    };
  } catch (error) {
    return validationState(error);
  }
}

export async function updateRecoveredPasswordAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const password = validatePassword(formString(formData, "password"));
    const confirmation = formString(formData, "password_confirmation");
    if (password !== confirmation) {
      return actionError("As senhas não são iguais.", "password_confirmation");
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return actionError("Este link expirou. Solicite um novo.");

    const { error } = await supabase.auth.updateUser({ password });
    if (error) return actionError(authErrorMessage(error.message));
  } catch (error) {
    return validationState(error);
  }

  redirect("/painel/perfil?senha=alterada");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
