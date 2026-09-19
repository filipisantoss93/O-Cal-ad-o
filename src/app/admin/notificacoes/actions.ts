"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/dal";

export async function markAdminNotificationRead(formData: FormData) {
  const { supabase, user } = await requireAdmin("/admin/notificacoes");
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) redirect("/admin/notificacoes?erro=invalid");
  const { error } = await supabase.from("admin_notifications")
    .update({ read_at: new Date().toISOString() }).eq("id", id).eq("recipient_id", user.id);
  if (error) redirect("/admin/notificacoes?erro=update");
  revalidatePath("/admin/notificacoes");
}

export async function resolveAdminMessage(formData: FormData) {
  const { supabase } = await requireAdmin("/admin/notificacoes");
  const id = Number(formData.get("id"));
  const kind = String(formData.get("kind"));
  if (!Number.isSafeInteger(id) || id <= 0 || !["support", "report"].includes(kind)) redirect("/admin/notificacoes?erro=invalid");
  const table = kind === "support" ? "support_messages" : "business_reports";
  const { error } = await supabase.from(table).update({ status: "resolved" }).eq("id", id);
  if (error) redirect("/admin/notificacoes?erro=update");
  revalidatePath("/admin/notificacoes");
}

type PushPayload = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function subscribeAdminPush(subscription: PushPayload) {
  const { supabase, user } = await requireAdmin("/admin/notificacoes");
  if (!subscription?.endpoint?.startsWith("https://") || subscription.endpoint.length > 2048 ||
      !subscription.keys?.p256dh || !subscription.keys.auth) {
    return { ok: false, message: "Assinatura de notificações inválida." };
  }
  const { error } = await supabase.from("admin_push_subscriptions").upsert({
    endpoint: subscription.endpoint,
    user_id: user.id,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  }, { onConflict: "endpoint" });
  return { ok: !error, message: error ? "Não foi possível ativar as notificações." : "Notificações ativadas neste dispositivo." };
}

export async function unsubscribeAdminPush(endpoint: string) {
  const { supabase, user } = await requireAdmin("/admin/notificacoes");
  if (!endpoint?.startsWith("https://")) return { ok: false };
  const { error } = await supabase.from("admin_push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  return { ok: !error };
}
