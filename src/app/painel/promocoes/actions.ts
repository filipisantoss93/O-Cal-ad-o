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
  brazilDateToIso,
  formString,
  optionalText,
  parseMoney,
  requiredText,
  ValidationError,
} from "@/lib/validation";
import type { Database } from "@/types/database";

function promotionError(error: unknown): ActionState {
  if (error instanceof ValidationError) {
    return actionError(error.message, error.field);
  }
  if (error instanceof Error) return actionError(error.message);
  return actionError("Não foi possível salvar a promoção.");
}

async function ownedBusiness(
  supabase: SupabaseClient<Database>,
  userId: string,
  businessId: number,
) {
  if (!Number.isSafeInteger(businessId) || businessId <= 0) {
    return { data: null, error: new Error("Loja inválida.") };
  }
  return supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("owner_id", userId)
    .maybeSingle();
}

function revalidatePromotionViews() {
  revalidatePath("/");
  revalidatePath("/painel");
  revalidatePath("/painel/promocoes");
  revalidatePath("/painel/assinatura");
}

export async function savePromotionAction(
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

    const businessId = Number(formString(formData, "business_id"));
    const businessResult = await ownedBusiness(supabase, user.id, businessId);
    if (businessResult.error || !businessResult.data) {
      return actionError("Loja não encontrada.");
    }

    const promotionId = Number(formString(formData, "promotion_id"));
    let existing = null;
    if (Number.isSafeInteger(promotionId) && promotionId > 0) {
      const existingResult = await supabase
        .from("promotions")
        .select("id, image_path")
        .eq("id", promotionId)
        .eq("business_id", businessId)
        .maybeSingle();
      if (existingResult.error || !existingResult.data) {
        return actionError("Promoção não encontrada.");
      }
      existing = existingResult.data;
    }

    const title = requiredText(formData, "title", "Título", 2, 160);
    const description = optionalText(
      formData,
      "description",
      "A descrição",
      1200,
    );
    const offerPrice = parseMoney(
      formString(formData, "offer_price"),
      "offer_price",
    );
    const originalPrice = parseMoney(
      formString(formData, "original_price"),
      "original_price",
      false,
    );
    if (
      originalPrice !== null &&
      offerPrice !== null &&
      originalPrice < offerPrice
    ) {
      return actionError(
        "O preço original não pode ser menor que o preço da oferta.",
        "original_price",
      );
    }

    const startsAt = brazilDateToIso(
      formString(formData, "starts_on"),
      false,
    );
    const endsAt = brazilDateToIso(formString(formData, "ends_on"), true);
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      return actionError(
        "A data final precisa ser igual ou posterior à data inicial.",
        "ends_on",
      );
    }

    const imageFile = imageFromForm(formData, "image");
    let imagePath = existing?.image_path ?? null;
    if (imageFile) {
      imagePath = await uploadMerchantImage(
        supabase,
        user.id,
        imageFile,
        "promotion",
      );
      uploadedPaths.push(imagePath);
    }

    const values = {
      title,
      description,
      original_price: originalPrice,
      offer_price: offerPrice,
      starts_at: startsAt,
      ends_at: endsAt,
      image_path: imagePath,
      is_active: formData.get("is_active") === "on",
    };
    const result = existing
      ? await supabase
          .from("promotions")
          .update(values)
          .eq("id", existing.id)
          .eq("business_id", businessId)
      : await supabase
          .from("promotions")
          .insert({ ...values, business_id: businessId });

    if (result.error) {
      await removeMerchantImages(supabase, user.id, uploadedPaths);
      if (result.error.message.includes("BILLING_PROMOTION_LIMIT")) {
        return actionError(
          "Você atingiu o limite de promoções desta loja. Compre um pacote adicional de 5, 10, 20 ou 50 promoções.",
        );
      }
      if (result.error.message.includes("BILLING_BUSINESS_SUSPENDED")) {
        return actionError(
          "Esta loja está suspensa pelo plano. Regularize a assinatura para voltar a publicar promoções.",
        );
      }
      return actionError("Não foi possível salvar a promoção. Revise os dados.");
    }

    if (imageFile) {
      await removeMerchantImages(supabase, user.id, [existing?.image_path]);
    }
    revalidatePromotionViews();
    return {
      status: "success",
      message: existing ? "Promoção atualizada." : "Promoção criada.",
    };
  } catch (error) {
    if (cleanupClient && cleanupUserId && uploadedPaths.length > 0) {
      await removeMerchantImages(
        cleanupClient,
        cleanupUserId,
        uploadedPaths,
      );
    }
    return promotionError(error);
  }
}

export async function setFeaturedPromotionAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const businessId = Number(formString(formData, "business_id"));
  const promotionId = Number(formString(formData, "promotion_id"));
  const nextFeatured = formString(formData, "next_featured") === "true";
  const businessResult = await ownedBusiness(supabase, user.id, businessId);
  if (
    !businessResult.data ||
    !Number.isSafeInteger(promotionId) ||
    promotionId <= 0
  ) return;

  const promotionsTable = (supabase as unknown as {
    from: (table: string) => {
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: unknown) => unknown;
      };
    };
  }).from("promotions") as any;

  if (nextFeatured) {
    await promotionsTable
      .update({ is_featured: false })
      .eq("business_id", businessId);
  }
  await promotionsTable
    .update({ is_featured: nextFeatured })
    .eq("business_id", businessId)
    .eq("id", promotionId);

  revalidatePromotionViews();
}

export async function togglePromotionAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const businessId = Number(formString(formData, "business_id"));
  const businessResult = await ownedBusiness(supabase, user.id, businessId);
  if (!businessResult.data) return;
  const promotionId = Number(formString(formData, "promotion_id"));
  if (!Number.isSafeInteger(promotionId) || promotionId <= 0) return;

  await supabase
    .from("promotions")
    .update({ is_active: formString(formData, "next_active") === "true" })
    .eq("id", promotionId)
    .eq("business_id", businessId);
  revalidatePromotionViews();
}

export async function deletePromotionAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const businessId = Number(formString(formData, "business_id"));
  const businessResult = await ownedBusiness(supabase, user.id, businessId);
  if (!businessResult.data) return;
  const promotionId = Number(formString(formData, "promotion_id"));
  if (!Number.isSafeInteger(promotionId) || promotionId <= 0) return;

  const { data: promotion } = await supabase
    .from("promotions")
    .select("id, image_path")
    .eq("id", promotionId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!promotion) return;

  const { error } = await supabase
    .from("promotions")
    .delete()
    .eq("id", promotion.id)
    .eq("business_id", businessId);
  if (!error) {
    await removeMerchantImages(supabase, user.id, [promotion.image_path]);
  }
  revalidatePromotionViews();
}
