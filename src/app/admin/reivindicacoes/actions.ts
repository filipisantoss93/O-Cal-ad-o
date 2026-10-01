"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/dal";
import { formString, optionalText, positiveInteger, requiredText, ValidationError } from "@/lib/validation";
import type { DatabaseWithBusinessClaims } from "@/types/business-claims";

function messageFor(error: unknown) {
  if (error instanceof ValidationError) return error.message;
  if (error instanceof Error) return error.message;
  return "Não foi possível concluir a análise.";
}
function adminNote(formData: FormData) { return optionalText(formData, "admin_note", "A observação", 1000); }

export async function reviewBusinessClaimAction(formData: FormData) {
  const { supabase } = await requireAdmin("/admin/reivindicacoes");
  const client = supabase as unknown as SupabaseClient<DatabaseWithBusinessClaims>;
  const requestId = positiveInteger(formData, "request_id", "uma solicitação");
  const decision = formString(formData, "decision");
  const slug = formString(formData, "slug");
  if (decision !== "approve" && decision !== "reject") redirect("/admin/reivindicacoes?erro=" + encodeURIComponent("Decisão de reivindicação inválida."));
  let errorMessage = "";
  try {
    const { error } = await client.rpc("review_business_claim_request", { p_request_id: requestId, p_decision: decision, p_admin_note: adminNote(formData) });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/reivindicacoes"); revalidatePath("/admin"); revalidatePath("/painel");
    if (slug) { revalidatePath(`/loja/${slug}`); revalidatePath(`/reivindicar/${slug}`); }
  } catch (error) { errorMessage = messageFor(error); }
  if (errorMessage) redirect(`/admin/reivindicacoes?erro=${encodeURIComponent(errorMessage)}`);
  redirect(`/admin/reivindicacoes?sucesso=${encodeURIComponent(decision === "approve" ? "Reivindicação aprovada e estabelecimento transferido ao responsável." : "Reivindicação rejeitada.")}`);
}

export async function reviewBusinessListingRequestAction(formData: FormData) {
  const { supabase } = await requireAdmin("/admin/reivindicacoes");
  const client = supabase as unknown as SupabaseClient<DatabaseWithBusinessClaims>;
  const requestId = positiveInteger(formData, "request_id", "uma solicitação");
  const decision = formString(formData, "decision");
  const slug = formString(formData, "slug");
  if (!["resolve", "reject", "remove"].includes(decision)) redirect("/admin/reivindicacoes?erro=" + encodeURIComponent("Decisão de correção inválida."));
  let errorMessage = "";
  try {
    const { error } = await client.rpc("review_business_listing_request", { p_request_id: requestId, p_decision: decision, p_admin_note: adminNote(formData) });
    if (error) throw new Error(error.message);
    revalidatePath("/"); revalidatePath("/buscar"); revalidatePath("/admin/reivindicacoes"); revalidatePath("/admin/perfis-nao-reivindicados");
    if (slug) revalidatePath(`/loja/${slug}`);
  } catch (error) { errorMessage = messageFor(error); }
  if (errorMessage) redirect(`/admin/reivindicacoes?erro=${encodeURIComponent(errorMessage)}`);
  redirect(`/admin/reivindicacoes?sucesso=${encodeURIComponent(decision === "remove" ? "Perfil removido da publicação e solicitação concluída." : decision === "reject" ? "Solicitação rejeitada." : "Solicitação marcada como resolvida.")}`);
}


export async function revokeBusinessOwnershipAction(formData: FormData) {
  const { supabase } = await requireAdmin("/admin/reivindicacoes");
  const client = supabase as unknown as SupabaseClient<DatabaseWithBusinessClaims>;
  const businessId = positiveInteger(formData, "business_id", "uma empresa");
  const slug = formString(formData, "slug");
  let errorMessage = "";

  try {
    const note = requiredText(formData, "admin_note", "Motivo da revogação", 5, 1000);
    const { error } = await client.rpc("admin_revoke_business_ownership", {
      p_business_id: businessId,
      p_admin_note: note,
    });
    if (error) throw new Error(error.message);

    revalidatePath("/admin/reivindicacoes");
    revalidatePath("/admin/cadastros");
    revalidatePath("/admin/perfis-nao-reivindicados");
    revalidatePath("/admin/dashboard");
    revalidatePath("/painel");
    revalidatePath("/painel/loja");
    revalidatePath("/buscar");
    if (slug) {
      revalidatePath(`/loja/${slug}`);
      revalidatePath(`/reivindicar/${slug}`);
    }
  } catch (error) {
    errorMessage = messageFor(error);
  }

  if (errorMessage) redirect(`/admin/reivindicacoes?erro=${encodeURIComponent(errorMessage)}`);
  redirect("/admin/reivindicacoes?sucesso=" + encodeURIComponent("Reivindicação cancelada. O perfil voltou a ficar sem responsável."));
}
