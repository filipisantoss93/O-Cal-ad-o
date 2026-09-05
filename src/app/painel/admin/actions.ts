"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/dal";

const moderationStatus = {
  approve: "approved",
  reject: "rejected",
  suspend: "suspended",
  reopen: "pending",
} as const;

export async function moderateBusinessAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const businessId = Number(formData.get("business_id"));
  const intent = String(formData.get("intent") ?? "");
  const note = String(formData.get("moderation_note") ?? "").trim().slice(0, 1000);
  const status = moderationStatus[intent as keyof typeof moderationStatus];

  if (!Number.isSafeInteger(businessId) || businessId <= 0 || !status) {
    redirect("/painel/admin?erro=acao-invalida");
  }
  if ((status === "rejected" || status === "suspended") && note.length < 5) {
    redirect("/painel/admin?erro=informe-o-motivo");
  }

  const { data, error } = await supabase
    .from("businesses")
    .update({
      status,
      moderation_note: status === "approved" || status === "pending" ? null : note,
      moderated_at: status === "pending" ? null : new Date().toISOString(),
      moderated_by: status === "pending" ? null : user.id,
    })
    .eq("id", businessId)
    .select("id, slug")
    .maybeSingle();

  if (error || !data) {
    redirect("/painel/admin?erro=nao-foi-possivel-moderar");
  }

  revalidatePath("/");
  revalidatePath("/buscar");
  revalidatePath(`/loja/${data.slug}`);
  revalidatePath("/painel/admin");
  redirect(`/painel/admin?sucesso=${status}`);
}
