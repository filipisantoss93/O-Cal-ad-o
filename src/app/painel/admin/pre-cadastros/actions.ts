"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/dal";
import {
  imageFromForm,
  removeMerchantImages,
  uploadMerchantImage,
} from "@/lib/merchant/media";
import {
  formString,
  normalizePhone,
  normalizePostalCode,
  normalizeSlug,
  normalizeSocialProfile,
  normalizeWebsite,
  optionalText,
  positiveInteger,
  requiredText,
  validateEmail,
  ValidationError,
} from "@/lib/validation";
import type { Database } from "@/types/database";
import type { DatabaseWithBusinessClaims } from "@/types/business-claims";

function optionalCoordinate(
  formData: FormData,
  field: "latitude" | "longitude",
  minimum: number,
  maximum: number,
) {
  const rawValue = formString(formData, field);
  if (!rawValue) return null;
  const value = Number(rawValue.replace(",", "."));
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new ValidationError(field, "Coordenada inválida.");
  }
  return value;
}

function businessTags(formData: FormData) {
  const tags = formString(formData, "tags")
    .split(/[,;\n]+/)
    .map((tag) => tag.trim().replace(/^#+/, "").replace(/\s+/g, " "))
    .filter(Boolean);
  const uniqueTags = Array.from(
    new Map(tags.map((tag) => [tag.toLocaleLowerCase("pt-BR"), tag])).values(),
  );

  if (uniqueTags.length < 3 || uniqueTags.length > 12) {
    throw new ValidationError("tags", "Informe de 3 a 12 tags para a busca.");
  }
  if (uniqueTags.some((tag) => tag.length < 2 || tag.length > 40)) {
    throw new ValidationError("tags", "Cada tag deve ter entre 2 e 40 caracteres.");
  }
  return uniqueTags;
}

function errorMessage(error: unknown) {
  if (error instanceof ValidationError) return error.message;
  if (error instanceof Error) return error.message;
  return "Não foi possível criar o pré-cadastro.";
}

export async function createPreRegisteredBusinessAction(formData: FormData) {
  const { supabase, user } = await requireAdmin("/painel/admin/pre-cadastros");
  const claimsClient = supabase as unknown as SupabaseClient<DatabaseWithBusinessClaims>;
  let createdBusinessId: number | null = null;
  let completed = false;
  const uploadedPaths: string[] = [];
  let successMessage = "Pré-cadastro criado com sucesso.";

  try {
    const claimEmail = validateEmail(formString(formData, "claim_email")).toLowerCase();
    const name = requiredText(formData, "name", "Nome da loja", 2, 120);
    const slug = normalizeSlug(formString(formData, "slug") || name);
    const cityId = positiveInteger(formData, "city_id", "uma cidade");
    const categoryId = positiveInteger(formData, "category_id", "uma categoria");

    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .eq("is_active", true)
      .neq("slug", "locais-publicos")
      .maybeSingle();
    if (categoryError || !category) {
      throw new ValidationError("category_id", "Selecione uma categoria comercial válida.");
    }

    const description = optionalText(formData, "description", "A descrição", 2000);
    const tags = businessTags(formData);
    const whatsapp = normalizePhone(
      formString(formData, "whatsapp_e164"),
      "whatsapp_e164",
    );
    const phone = normalizePhone(
      formString(formData, "phone_e164"),
      "phone_e164",
      false,
    );
    const publicEmailValue = formString(formData, "public_email");
    const publicEmail = publicEmailValue
      ? validateEmail(publicEmailValue, "public_email")
      : null;
    const websiteUrl = normalizeWebsite(formString(formData, "website_url"));
    const instagramUrl = normalizeSocialProfile(
      formString(formData, "instagram_url"),
      "instagram",
    );
    const facebookUrl = normalizeSocialProfile(
      formString(formData, "facebook_url"),
      "facebook",
    );
    const street = requiredText(formData, "street", "Rua ou avenida", 2, 160);
    const addressNumber = requiredText(formData, "address_number", "Número", 1, 20);
    const complement = optionalText(formData, "complement", "O complemento", 120);
    const neighborhood = requiredText(formData, "neighborhood", "Bairro", 2, 120);
    const postalCode = normalizePostalCode(formString(formData, "postal_code"));
    const latitude = optionalCoordinate(formData, "latitude", -90, 90);
    const longitude = optionalCoordinate(formData, "longitude", -180, 180);
    if ((latitude === null) !== (longitude === null)) {
      throw new ValidationError(
        "latitude",
        "Informe latitude e longitude juntas ou deixe as duas em branco.",
      );
    }

    const logoFile = imageFromForm(formData, "logo");
    const coverFile = imageFromForm(formData, "cover");
    let logoPath: string | null = null;
    let coverPath: string | null = null;

    if (logoFile) {
      logoPath = await uploadMerchantImage(supabase, user.id, logoFile, "logo");
      uploadedPaths.push(logoPath);
    }
    if (coverFile) {
      coverPath = await uploadMerchantImage(supabase, user.id, coverFile, "cover");
      uploadedPaths.push(coverPath);
    }

    const publishNow = formData.get("publication_status") === "on";
    const businessData = {
      owner_id: null,
      pre_registered: true,
      city_id: cityId,
      category_id: categoryId,
      listing_type: "business",
      public_place_kind: null,
      official_source_url: null,
      slug,
      name,
      description,
      tags,
      whatsapp_e164: whatsapp,
      phone_e164: phone,
      public_email: publicEmail,
      website_url: websiteUrl,
      instagram_url: instagramUrl,
      facebook_url: facebookUrl,
      street,
      address_number: addressNumber,
      complement,
      neighborhood,
      postal_code: postalCode,
      latitude,
      longitude,
      logo_path: logoPath,
      cover_path: coverPath,
      status: "approved",
      publication_status: publishNow ? "published" : "unpublished",
      moderated_at: new Date().toISOString(),
      moderated_by: user.id,
      plan: "free",
      featured_until: null,
      billing_suspended: false,
      billing_suspension_reason: null,
      is_active: true,
    };

    const { data: business, error: businessError } = await claimsClient
      .from("businesses")
      .insert(businessData)
      .select("id, slug")
      .single();

    if (businessError || !business) {
      if (businessError?.code === "23505") {
        throw new Error("Já existe uma loja com esse endereço público nesta cidade.");
      }
      throw new Error("Não foi possível salvar a loja. Revise os dados informados.");
    }
    createdBusinessId = business.id;

    const { error: claimError } = await claimsClient.from("business_claims").insert({
      business_id: business.id,
      claim_email: claimEmail,
      created_by: user.id,
    });
    if (claimError) {
      throw new Error("A loja foi preparada, mas não foi possível vincular o e-mail responsável.");
    }

    completed = true;

    const { data: claimStatus } = await claimsClient
      .from("business_claims")
      .select("claimed_at")
      .eq("business_id", business.id)
      .maybeSingle();

    successMessage = claimStatus?.claimed_at
      ? "Loja criada e vinculada imediatamente à conta confirmada desse e-mail."
      : "Loja criada. Quando esse e-mail concluir o cadastro e confirmar a conta, a vitrine será vinculada automaticamente.";

    revalidatePath("/");
    revalidatePath("/buscar");
    revalidatePath("/painel/admin");
    revalidatePath("/painel/admin/dashboard");
    revalidatePath("/painel/admin/pre-cadastros");
    revalidatePath(`/loja/${business.slug}`);
  } catch (error) {
    if (!completed && createdBusinessId) {
      await supabase.from("businesses").delete().eq("id", createdBusinessId);
    }
    if (!completed && uploadedPaths.length > 0) {
      await removeMerchantImages(
        supabase as SupabaseClient<Database>,
        user.id,
        uploadedPaths,
      );
    }
    redirect(
      `/painel/admin/pre-cadastros?erro=${encodeURIComponent(errorMessage(error))}`,
    );
  }

  redirect(
    `/painel/admin/pre-cadastros?sucesso=${encodeURIComponent(successMessage)}`,
  );
}
