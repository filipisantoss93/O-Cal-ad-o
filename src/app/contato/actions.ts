"use server";

import { actionError, type ActionState } from "@/lib/action-state";
import { createPublicClient } from "@/lib/supabase/server";
import { formString, requiredText, validateEmail, ValidationError } from "@/lib/validation";

export async function sendSupportMessage(_state: ActionState, formData: FormData): Promise<ActionState> {
  if (formString(formData, "company_website")) return { status: "success", message: "Mensagem recebida." };
  try {
    const name = requiredText(formData, "name", "Nome", 2, 120);
    const email = validateEmail(formString(formData, "email"));
    const subject = requiredText(formData, "subject", "Assunto", 3, 160);
    const message = requiredText(formData, "message", "Mensagem", 10, 4000);
    const { error } = await createPublicClient().from("support_messages").insert({ name, email, subject, message });
    if (error) return actionError(error.code === "23514" ? "Aguarde alguns minutos antes de enviar outra mensagem." : "Não foi possível enviar sua mensagem. Tente novamente.");
    return { status: "success", message: "Mensagem enviada. A equipe responderá pelo e-mail informado." };
  } catch (error) {
    return actionError(error instanceof ValidationError ? error.message : "Não foi possível enviar sua mensagem.");
  }
}
