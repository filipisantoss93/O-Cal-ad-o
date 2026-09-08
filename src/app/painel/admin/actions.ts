"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/dal";

const moderationActions = {
  approve: {
    status: "approved",
    publicationStatus: "published",
    requiresNote: false,
  },
  request_changes: {
    status: "rejected",
    publicationStatus: "published",
    requiresNote: true,
  },
  request_changes_unpublish: {
    status: "rejected",
    publicationStatus: "unpublished",
    requiresNote: true,
  },
  suspend: {
    status: "suspended",
    publicationStatus: "unpublished",
    requiresNote: true,
  },
  reopen: {
    status: "pending",
    publicationStatus: "published",
    requiresNote: false,
  },
} as const;

export async function moderateBusinessAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const businessId = Number(formData.get("business_id"));
  const intent = String(formData.get("intent") ?? "");
  const note = String(formData.get("moderation_note") ?? "").trim().slice(0, 1000);
  const action = moderationActions[intent as keyof typeof moderationActions];

  if (!Number.isSafeInteger(businessId) || businessId <= 0 || !action) {
    redirect("/painel/admin?erro=acao-invalida");
  }
  if (action.requiresNote && note.length < 5) {
    redirect("/painel/admin?erro=informe-o-motivo");
  }

  const { data, error } = await supabase
    .from("businesses")
    .update({
      status: action.status,
      publication_status: action.publicationStatus,
      moderation_note:
        action.status === "approved" || action.status === "pending" ? null : note,
      moderated_at: action.status === "pending" ? null : new Date().toISOString(),
      moderated_by: action.status === "pending" ? null : user.id,
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
  revalidatePath("/painel");
  revalidatePath("/painel/loja");
  redirect(`/painel/admin?sucesso=${intent}`);
}
