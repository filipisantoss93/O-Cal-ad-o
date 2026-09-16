"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formString, requiredText, validateEmail, ValidationError } from "@/lib/validation";
import type { DatabaseWithBusinessClaims } from "@/types/business-claims";

const requestTypes = new Set(["correction", "update", "removal"]);
function messageFor(error: unknown) {
  if (error instanceof ValidationError) return error.message;
  if (error instanceof Error) return error.message;
  return "Não foi possível enviar a solicitação.";
}

export async function requestBusinessListingChangeAction(formData: FormData) {
  const slug = formString(formData, "slug");
  const supabase = await createClient();
  const client = supabase as unknown as SupabaseClient<DatabaseWithBusinessClaims>;
  let success = false;
  let errorMessage = "";
  try {
    const requesterName = requiredText(formData, "requester_name", "Seu nome", 2, 120);
    const requesterEmail = validateEmail(formString(formData, "requester_email"), "requester_email");
    const requestType = formString(formData, "request_type");
    if (!requestTypes.has(requestType)) throw new ValidationError("request_type", "Selecione o tipo de solicitação.");
    const details = requiredText(formData, "details", "Os detalhes", 10, 2000);
    const { data: business, error: businessError } = await client.from("businesses").select("id, pre_registered, owner_id").eq("slug", slug).eq("listing_type", "business").eq("is_active", true).maybeSingle();
    if (businessError || !business) throw new Error("Estabelecimento não encontrado.");
    if (!business.pre_registered || business.owner_id) throw new Error("Este perfil já foi reivindicado.");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await client.from("business_listing_requests").insert({ business_id: business.id, requester_id: user?.id ?? null, requester_name: requesterName, requester_email: requesterEmail, request_type: requestType, details });
    if (error) throw new Error("Não foi possível registrar a solicitação.");
    revalidatePath(`/loja/${slug}`);
    revalidatePath("/painel/admin/reivindicacoes");
    success = true;
  } catch (error) { errorMessage = messageFor(error); }
  if (success) redirect(`/loja/${slug}/solicitar-alteracao?sucesso=${encodeURIComponent("Solicitação recebida. O O Calçadão fará a análise e atualizará o perfil quando necessário.")}`);
  redirect(`/loja/${slug}/solicitar-alteracao?erro=${encodeURIComponent(errorMessage)}`);
}
