"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { imageFromForm, removeMerchantImages, uploadMerchantImage } from "@/lib/merchant/media";
import { formString, requiredText, optionalText, ValidationError } from "@/lib/validation";
import { eventCategories } from "@/lib/events";

const offsets = new Set(["-02:00", "-03:00", "-04:00", "-05:00"]);
function eventTimestamp(raw: string, offset: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) throw new ValidationError(field, "Informe data e horário válidos.");
  const date = new Date(raw + ":00" + offset);
  if (!Number.isFinite(date.getTime())) throw new ValidationError(field, "Informe data e horário válidos.");
  return date.toISOString();
}
function errorPath(message: string, businessId: number) {
  return "/painel/eventos?loja=" + businessId + "&erro=" + encodeURIComponent(message);
}
function refreshEventPages(id?: number) {
  revalidatePath("/eventos");
  revalidatePath("/painel/eventos");
  if (id) revalidatePath("/eventos/" + id);
}

export async function saveEventAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?next=%2Fpainel%2Feventos");
  const businessId = Number(formString(formData, "business_id"));
  const eventId = Number(formString(formData, "event_id"));
  let uploadedPath: string | null = null;
  let errorMessage = "";
  let savedId: number | undefined;
  try {
    if (!Number.isSafeInteger(businessId) || businessId <= 0) throw new Error("Loja inválida.");
    const { data: business, error: businessError } = await supabase.from("businesses")
      .select("id, city_id, owner_id, listing_type, is_active, billing_suspended")
      .eq("id", businessId).eq("owner_id", user.id).eq("listing_type", "business").maybeSingle();
    if (businessError || !business) throw new Error("Esta vitrine não pertence à sua conta.");
    if (!business.is_active || business.billing_suspended) throw new Error("A vitrine está suspensa e não pode publicar eventos.");

    const { data: previous, error: previousError } = eventId > 0 && Number.isSafeInteger(eventId)
      ? await supabase.from("events").select("*").eq("id", eventId).eq("business_id", businessId).maybeSingle()
      : { data: null, error: null };
    if (previousError || (eventId > 0 && !previous)) throw new Error("Evento não encontrado.");

    const title = requiredText(formData, "title", "Nome do evento", 3, 160);
    const description = optionalText(formData, "description", "Descrição", 2500) ?? "";
    const category = formString(formData, "category");
    if (!Object.hasOwn(eventCategories, category)) throw new Error("Selecione uma categoria válida.");
    const venueName = requiredText(formData, "venue_name", "Local do evento", 2, 160);
    const venueAddress = requiredText(formData, "venue_address", "Endereço do evento", 5, 300);
    const utcOffset = formString(formData, "utc_offset");
    if (!offsets.has(utcOffset)) throw new Error("Selecione um fuso horário válido.");
    const startsAt = eventTimestamp(formString(formData, "starts_at"), utcOffset, "starts_at");
    const endsAt = eventTimestamp(formString(formData, "ends_at"), utcOffset, "ends_at");
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime())
      throw new Error("O término precisa ser posterior ao início.");
    if (new Date(endsAt).getTime() <= Date.now()) throw new Error("Informe um evento que ainda não terminou.");

    const freeEntry = formString(formData, "free_entry") === "true";
    const rawPrice = formString(formData, "ticket_price").replace(",", ".");
    const ticketPriceCents = freeEntry ? null : Math.round(Number(rawPrice) * 100);
    if (!freeEntry && (!/^\d+(?:[.,]\d{1,2})?$/.test(formString(formData, "ticket_price")) ||
      !Number.isSafeInteger(ticketPriceCents) || ticketPriceCents <= 0 || ticketPriceCents > 100000000))
      throw new Error("Informe o valor válido do ingresso.");
    const ticketUrl = formString(formData, "ticket_url") || null;
    if (ticketUrl && (ticketUrl.length > 500 || !/^https:\/\/[^\s]+$/i.test(ticketUrl)))
      throw new Error("Informe um link HTTPS válido para os ingressos.");

    const file = imageFromForm(formData, "image");
    if (!file && !previous?.banner_path) throw new Error("Envie o banner do evento.");
    if (file) uploadedPath = await uploadMerchantImage(supabase, user.id, file, "event");
    const payload = {
      title, description, category, venue_name: venueName, venue_address: venueAddress,
      city_id: business.city_id, starts_at: startsAt, ends_at: endsAt,
      utc_offset: utcOffset, free_entry: freeEntry, ticket_price_cents: ticketPriceCents,
      ticket_url: ticketUrl, banner_path: uploadedPath ?? previous!.banner_path,
      is_active: previous?.is_active ?? true,
    };
    const result = previous
      ? await supabase.from("events").update(payload).eq("id", previous.id).eq("business_id", businessId).select("id").single()
      : await supabase.from("events").insert({ ...payload, business_id: businessId }).select("id").single();
    if (result.error || !result.data) throw new Error("Não foi possível salvar o evento. Revise os dados.");
    savedId = result.data.id;
    if (uploadedPath && previous?.banner_path)
      await removeMerchantImages(supabase, user.id, [previous.banner_path]);
  } catch (error) {
    if (uploadedPath) await removeMerchantImages(supabase, user.id, [uploadedPath]);
    errorMessage = error instanceof Error ? error.message : "Não foi possível salvar o evento.";
  }
  if (errorMessage) redirect(errorPath(errorMessage, Number.isSafeInteger(businessId) ? businessId : 0));
  refreshEventPages(savedId);
  redirect("/painel/eventos?loja=" + businessId + "&sucesso=1");
}

export async function toggleEventAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?next=%2Fpainel%2Feventos");
  const businessId = Number(formString(formData, "business_id"));
  const id = Number(formString(formData, "event_id"));
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(businessId) || businessId <= 0) return;
  const { data: business } = await supabase.from("businesses").select("id")
    .eq("id", businessId).eq("owner_id", user.id).maybeSingle();
  if (!business) return;
  const { error } = await supabase.from("events")
    .update({ is_active: formString(formData, "next_active") === "true" })
    .eq("id", id).eq("business_id", businessId);
  if (error) redirect(errorPath("Não foi possível alterar a publicação.", businessId));
  refreshEventPages(id);
  redirect("/painel/eventos?loja=" + businessId);
}

export async function deleteEventAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?next=%2Fpainel%2Feventos");
  const businessId = Number(formString(formData, "business_id"));
  const id = Number(formString(formData, "event_id"));
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(businessId) || businessId <= 0) return;
  const { data: business } = await supabase.from("businesses").select("id")
    .eq("id", businessId).eq("owner_id", user.id).maybeSingle();
  if (!business) return;
  const { data: event } = await supabase.from("events").select("id, banner_path")
    .eq("id", id).eq("business_id", businessId).maybeSingle();
  if (!event) return;
  const { error } = await supabase.from("events").delete().eq("id", id).eq("business_id", businessId);
  if (error) redirect(errorPath("Não foi possível excluir o evento.", businessId));
  await removeMerchantImages(supabase, user.id, [event.banner_path]);
  refreshEventPages(id);
  redirect("/painel/eventos?loja=" + businessId + "&sucesso=excluido");
}
