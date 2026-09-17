"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  formString,
  normalizePhone,
  requiredText,
  ValidationError,
} from "@/lib/validation";
import type { DatabaseWithBusinessClaims } from "@/types/business-claims";

const relationships = new Set(["owner", "manager", "employee", "agency", "other"]);

function messageFor(error: unknown) {
  if (error instanceof ValidationError) return error.message;
  if (error instanceof Error) return error.message;
  return "Não foi possível enviar a reivindicação.";
}

export async function requestBusinessClaimAction(formData: FormData) {
  const slug = formString(formData, "slug");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/entrar?next=${encodeURIComponent(`/reivindicar/${slug}`)}`);
  }

  const client = supabase as unknown as SupabaseClient<DatabaseWithBusinessClaims>;
  let success = false;
  let errorMessage = "";

  try {
    const relationship = formString(formData, "relationship");
    if (!relationships.has(relationship)) {
      throw new ValidationError(
        "relationship",
        "Informe sua relação com o estabelecimento.",
      );
    }

    const whatsapp = normalizePhone(
      formString(formData, "whatsapp_e164"),
      "whatsapp_e164",
    );
    const evidence = requiredText(
      formData,
      "evidence",
      "A comprovação",
      10,
      1500,
    );

    const { data: business, error: businessError } = await client
      .from("businesses")
      .select("id, name, pre_registered, owner_id")
      .eq("slug", slug)
      .eq("listing_type", "business")
      .eq("is_active", true)
      .maybeSingle();

    if (businessError || !business) {
      throw new Error("Estabelecimento não encontrado.");
    }
    if (!business.pre_registered || business.owner_id) {
      throw new Error("Este estabelecimento já foi reivindicado.");
    }

    const email = user.email?.trim().toLowerCase();
    if (!email || !user.email_confirmed_at) {
      throw new Error("Sua conta precisa ter um e-mail confirmado.");
    }

    const metadataName =
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name.trim()
        : "";
    const requesterName =
      metadataName.length >= 2
        ? metadataName.slice(0, 120)
        : email.split("@")[0].slice(0, 120);

    const { error } = await client.from("business_claim_requests").insert({
      business_id: business.id,
      requester_id: user.id,
      requester_name: requesterName,
      requester_email: email,
      relationship,
      whatsapp_e164: whatsapp,
      evidence,
    });

    if (error) {
      if (error.code === "23505") {
        throw new Error(
          "Você já possui uma reivindicação pendente para este estabelecimento.",
        );
      }
      throw new Error("Não foi possível registrar a reivindicação.");
    }

    revalidatePath(`/reivindicar/${slug}`);
    revalidatePath("/painel/admin/reivindicacoes");
    success = true;
  } catch (error) {
    errorMessage = messageFor(error);
  }

  if (success) {
    redirect(
      `/reivindicar/${slug}?sucesso=${encodeURIComponent(
        "Reivindicação enviada. O administrador fará a validação antes de transferir a vitrine.",
      )}`,
    );
  }

  redirect(`/reivindicar/${slug}?erro=${encodeURIComponent(errorMessage)}`);
}
