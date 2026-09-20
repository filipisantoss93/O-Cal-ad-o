"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/dal";

const ROUTE = "/admin/qualidade-seo";
const statuses = new Set(["pending", "reviewing", "resolved", "dismissed"]);

export async function reviewSeoIssueAction(formData: FormData) {
  const { supabase, user } = await requireAdmin(ROUTE);
  const id = Number(formData.get("id"));
  const expected = String(formData.get("expected_status") ?? "");
  const next = String(formData.get("next_status") ?? "");
  const note = String(formData.get("review_note") ?? "").trim().slice(0, 1000);
  const confirmed = formData.get("confirmed") === "on";
  const back = String(formData.get("return_query") ?? "");
  // A volta sempre permanece nesta rota; nao usar redirect externo vindo do formulario.
  const safeBack = back.length <= 250 && /^[a-zA-Z0-9_=&%-]*$/.test(back) ? back : "";
  const target = ROUTE + (safeBack ? "?" + safeBack : "");
  const resultUrl = (key: "sucesso" | "erro", value: string) =>
    target + (safeBack ? "&" : "?") + key + "=" + encodeURIComponent(value);

  if (!Number.isSafeInteger(id) || id <= 0 || !statuses.has(expected) || !statuses.has(next) ||
      !((expected === "pending" && ["reviewing","dismissed"].includes(next)) ||
         (expected === "reviewing" && ["pending","resolved","dismissed"].includes(next)) ||
         (["resolved","dismissed"].includes(expected) && next === "reviewing"))) {
    redirect(resultUrl("erro", "Ação inválida ou situação desatualizada."));
  }
  if (["dismissed", "resolved"].includes(next) && (note.length < 15 || !confirmed)) {
    redirect(resultUrl("erro", "Registre a fonte ou o motivo (mínimo 15 caracteres) e confirme a revisão manual."));
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("business_seo_review_queue")
    .update({
      status: next,
      review_note: note || null,
      reviewed_by: user.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", expected)
    .select("id")
    .maybeSingle();

  if (error || !data) redirect(resultUrl("erro", "Não foi possível atualizar; recarregue a fila."));
  revalidatePath(ROUTE);
  redirect(resultUrl("sucesso", "Revisão registrada."));
}
