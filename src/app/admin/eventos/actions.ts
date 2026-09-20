"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/dal";
import { formString } from "@/lib/validation";

function fail(message: string): never {
  redirect("/admin/eventos?erro=" + encodeURIComponent(message));
}

/** Registro manual: exige conferência fora da plataforma antes de ativar. */
export async function activateEventHighlightAction(formData: FormData) {
  const { supabase } = await requireAdmin("/admin/eventos");
  const id = Number(formString(formData, "highlight_id"));
  const reference = formString(formData, "payment_reference");
  const rawPrice = formString(formData, "amount_paid_brl").replace(",", ".");
  const duration = Number(formString(formData, "duration_days"));
  if (!Number.isSafeInteger(id) || id <= 0) fail("Solicitação inválida.");
  if (formString(formData, "payment_confirmed") !== "on")
    fail("Confira a confirmação financeira antes de ativar o destaque.");
  if (reference.length < 4 || reference.length > 160)
    fail("Informe a referência real do pagamento confirmado.");
  if (!/^[0-9]{1,6}(?:\.[0-9]{1,2})?$/.test(rawPrice))
    fail("Informe o valor pago em reais.");
  const amountPaidCents = Math.round(Number(rawPrice) * 100);
  if (!Number.isSafeInteger(amountPaidCents) || amountPaidCents <= 0)
    fail("O pagamento precisa ter valor positivo.");
  if (![7, 15, 30].includes(duration)) fail("Escolha um período válido.");

  const { data: request } = await supabase.from("event_highlights")
    .select("id,event_id,status,product_code").eq("id", id).eq("status", "pending").maybeSingle();
  if (request?.product_code) fail("Este pedido usa checkout Efí e só pode ser ativado pela notificação de pagamento.");
  if (!request) fail("A solicitação já foi processada ou não existe.");
  const { data: event } = await supabase.from("events")
    .select("id,business_id,city_id,is_active,starts_at,ends_at")
    .eq("id", request.event_id).maybeSingle();
  if (!event || !event.is_active) fail("O evento não está disponível.");
  const { data: business } = await supabase.from("businesses")
    .select("id,city_id,publication_status,is_active,billing_suspended")
    .eq("id", event.business_id).maybeSingle();
  if (!business || business.city_id !== event.city_id || !business.is_active
    || business.billing_suspended || business.publication_status !== "published")
    fail("A vitrine organizadora precisa estar publicada e ativa na cidade do evento.");

  const startsMs = Date.now();
  const eventEndMs = Date.parse(event.ends_at ?? event.starts_at);
  const endsMs = Math.min(startsMs + duration * 86400000, eventEndMs);
  if (!Number.isFinite(endsMs) || endsMs <= startsMs)
    fail("O evento já terminou e não pode receber destaque.");

  const { data: saved, error } = await supabase.from("event_highlights")
    .update({
      status: "active",
      payment_reference: reference,
      amount_paid_cents: amountPaidCents,
      paid_at: new Date(startsMs).toISOString(),
      starts_at: new Date(startsMs).toISOString(),
      ends_at: new Date(endsMs).toISOString(),
      updated_at: new Date(startsMs).toISOString(),
    }).eq("id", id).eq("status", "pending").select("id").maybeSingle();
  if (error || !saved) fail("Não foi possível ativar o destaque.");
  revalidatePath("/eventos");
  revalidatePath("/painel/eventos");
  revalidatePath("/admin/eventos");
  redirect("/admin/eventos?sucesso=1");
}

export async function cancelEventHighlightRequestAction(formData: FormData) {
  const { supabase } = await requireAdmin("/admin/eventos");
  const id = Number(formString(formData, "highlight_id"));
  if (!Number.isSafeInteger(id) || id <= 0) fail("Solicitação inválida.");
  const { data: request } = await supabase.from("event_highlights")
    .select("id,product_code").eq("id", id).eq("status", "pending").maybeSingle();
  if (!request) fail("Solicitação pendente não encontrada.");
  if (request.product_code) fail("Pedidos Efí não podem ser cancelados manualmente enquanto a cobrança estiver em aberto.");
  const { error } = await supabase.from("event_highlights")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id).eq("status", "pending");
  if (error) fail("Não foi possível cancelar a solicitação.");
  revalidatePath("/painel/eventos");
  revalidatePath("/admin/eventos");
  redirect("/admin/eventos?sucesso=cancelado");
}
