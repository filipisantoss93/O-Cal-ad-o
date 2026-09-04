"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { actionError } from "@/lib/action-state";
import {
  imageFromForm,
  removeMerchantImages,
  uploadMerchantImage,
} from "@/lib/merchant/media";
import { createClient } from "@/lib/supabase/server";
import {
  formString,
  normalizePhone,
  normalizePostalCode,
  normalizeSlug,
  normalizeWebsite,
  optionalText,
  positiveInteger,
  requiredText,
  validateEmail,
  ValidationError,
} from "@/lib/validation";
import type { Database, TablesInsert, TablesUpdate } from "@/types/database";

function saveError(error: unknown): ActionState {
  if (error instanceof ValidationError) {
    return actionError(error.message, error.field);
  }
  if (error instanceof Error) return actionError(error.message);
  return actionError("Não foi possível salvar a loja. Tente novamente.");
}

export async function saveBusinessAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let cleanupClient: SupabaseClient<Database> | null = null;
  let cleanupUserId = "";
  const uploadedPaths: string[] = [];

  try {
    const supabase = await createClient();
    cleanupClient = supabase;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return actionError("Sua sessão expirou. Entre novamente.");
    cleanupUserId = user.id;

    const requestedBusinessValue = formString(formData, "business_id");
    const requestedBusinessId = Number(requestedBusinessValue);
    const { data: existingRows, error: existingError } = await supabase
      .from("businesses")
      .select("id, owner_id, logo_path, cover_path, status")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);
    if (existingError) {
      return actionError("Não foi possível localizar sua loja.");
    }
    const existing = existingRows?.[0] ?? null;
    if (
      requestedBusinessValue &&
      (!Number.isSafeInteger(requestedBusinessId) ||
        requestedBusinessId <= 0 ||
        existing?.id !== requestedBusinessId)
    ) {
      return actionError("Loja não encontrada.");
    }

    const name = requiredText(formData, "name", "Nome da loja", 2, 120);
    const slug = normalizeSlug(formString(formData, "slug") || name);
    const cityId = positiveInteger(formData, "city_id", "a cidade");
    const categoryId = positiveInteger(
      formData,
      "category_id",
      "uma categoria",
    );
    const description = optionalText(
      formData,
      "description",
      "A descrição",
      2000,
    );
    const whatsapp = normalizePhone(
      formString(formData, "whatsapp_e164"),
      "whatsapp_e164",
    );
    const publicEmailValue = formString(formData, "public_email");
    const publicEmail = publicEmailValue
      ? validateEmail(publicEmailValue, "public_email")
      : null;
    const websiteUrl = normalizeWebsite(formString(formData, "website_url"));
    const street = requiredText(formData, "street", "Rua ou avenida", 2, 160);
    const addressNumber = requiredText(
      formData,
      "address_number",
      "Número",
      1,
      20,
    );
    const complement = optionalText(
      formData,
      "complement",
      "O complemento",
      120,
    );
    const neighborhood = requiredText(
      formData,
      "neighborhood",
      "Bairro",
      2,
      120,
    );
    const postalCode = normalizePostalCode(
      formString(formData, "postal_code"),
    );
    const logoFile = imageFromForm(formData, "logo");
    const coverFile = imageFromForm(formData, "cover");

    let logoPath = existing?.logo_path ?? null;
    let coverPath = existing?.cover_path ?? null;
    if (logoFile) {
      logoPath = await uploadMerchantImage(
        supabase,
        user.id,
        logoFile,
        "logo",
      );
      uploadedPaths.push(logoPath);
    }
    if (coverFile) {
      coverPath = await uploadMerchantImage(
        supabase,
        user.id,
        coverFile,
        "cover",
      );
      uploadedPaths.push(coverPath);
    }

    const editableData = {
      city_id: cityId,
      category_id: categoryId,
      slug,
      name,
      description,
      whatsapp_e164: whatsapp,
      public_email: publicEmail,
      website_url: websiteUrl,
      street,
      address_number: addressNumber,
      complement,
      neighborhood,
      postal_code: postalCode,
      logo_path: logoPath,
      cover_path: coverPath,
      is_active: formData.get("is_active") === "on",
    } satisfies TablesUpdate<"businesses">;
    const insertData = {
      ...editableData,
      owner_id: user.id,
    } satisfies TablesInsert<"businesses">;

    const result = existing
      ? await supabase
          .from("businesses")
          .update(editableData)
          .eq("id", existing.id)
          .eq("owner_id", user.id)
          .select("id, status")
          .single()
      : await supabase
          .from("businesses")
          .insert(insertData)
          .select("id, status")
          .single();

    if (result.error) {
      await removeMerchantImages(supabase, user.id, uploadedPaths);
      if (result.error.code === "23505") {
        return actionError(
          "Esse endereço público já está em uso. Escolha outro.",
          "slug",
        );
      }
      return actionError("Não foi possível salvar a loja. Revise os dados.");
    }

    await removeMerchantImages(supabase, user.id, [
      logoFile ? existing?.logo_path : null,
      coverFile ? existing?.cover_path : null,
    ]);

    revalidatePath("/painel");
    revalidatePath("/painel/loja");
    return {
      status: "success",
      message: existing
        ? "Dados salvos. Se algo público mudou, a loja voltou para análise."
        : "Loja cadastrada e enviada para análise.",
    };
  } catch (error) {
    if (cleanupClient && cleanupUserId && uploadedPaths.length > 0) {
      await removeMerchantImages(
        cleanupClient,
        cleanupUserId,
        uploadedPaths,
      );
    }
    return saveError(error);
  }
}
