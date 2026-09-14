"use server";

import { actionError, type ActionState } from "@/lib/action-state";
import { createPublicClient } from "@/lib/supabase/server";
import { formString, requiredText, validateEmail, ValidationError } from "@/lib/validation";

const reasons = new Set(["inaccurate", "fraud", "inappropriate", "other"]);

export async function sendBusinessReport(_state: ActionState, formData: FormData): Promise<ActionState> {
  if (formString(formData, "company_website")) return { status: "success", message: "Denúncia recebida." };
  try {
    const businessId = Number(formString(formData, "business_id"));
    const reason = formString(formData, "reason");
    if (!Number.isSafeInteger(businessId) || businessId < 1 || !reasons.has(reason)) return actionError("Selecione uma loja e um motivo válidos.");
    const name = requiredText(formData, "name", "Nome", 2, 120);
    const email = validateEmail(formString(formData, "email"));
    const details = requiredText(formData, "details", "Descrição", 10, 4000);
    const { error } = await createPublicClient().from("business_reports").insert({ business_id: businessId, name, email, reason, details });
    if (error) return actionError(error.code === "23514" ? "Aguarde antes de enviar outra denúncia desta loja." : "Não foi possível enviar. Verifique a loja e tente novamente.");
    return { status: "success", message: "Denúncia recebida. Nossa moderação fará a análise." };
  } catch (error) {
    return actionError(error instanceof ValidationError ? error.message : "Não foi possível enviar a denúncia.");
  }
}
