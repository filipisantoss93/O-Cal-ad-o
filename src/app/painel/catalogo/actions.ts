"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeCatalogPriceMode } from "@/lib/catalog-pricing";
import {
  imageFromForm,
  removeMerchantImages,
  uploadMerchantImage,
} from "@/lib/merchant/media";
import { createClient } from "@/lib/supabase/server";
import {
  formString,
  optionalText,
  parseMoney,
  requiredText,
} from "@/lib/validation";
import type { CatalogPriceMode } from "@/types/catalog";
import type { Database } from "@/types/database";

type CatalogItemWrite = Database["public"]["Tables"]["catalog_items"]["Update"] & {
  price_mode: CatalogPriceMode;
};

function catalogUrl(businessId: number, params: Record<string, string> = {}) {
  const query = new URLSearchParams({ loja: String(businessId), ...params });
  return `/painel/catalogo?${query.toString()}`;
}

async function ownedBusiness(businessId: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, business: null };
  const { data: business } = await supabase
    .from("businesses")
    .select("id, slug")
    .eq("id", businessId)
    .eq("owner_id", user.id)
    .maybeSingle();
  return { supabase, user, business };
}

function revalidateCatalog(slug?: string) {
  revalidatePath("/");
  revalidatePath("/painel/catalogo");
  revalidatePath("/buscar");
  if (slug) revalidatePath(`/loja/${slug}`);
}

export async function saveCatalogItemAction(formData: FormData) {
  const businessId = Number(formString(formData, "business_id"));
  if (!Number.isSafeInteger(businessId) || businessId <= 0) {
    redirect("/painel/catalogo?erro=loja_invalida");
  }

  const { supabase, user, business } = await ownedBusiness(businessId);
  if (!user) redirect("/entrar?next=%2Fpainel%2Fcatalogo");
  if (!business) redirect("/painel/catalogo?erro=loja_invalida");

  const itemId = Number(formString(formData, "item_id"));
  let existing: { id: number; image_path: string | null } | null = null;
  if (Number.isSafeInteger(itemId) && itemId > 0) {
    const { data } = await supabase
      .from("catalog_items")
      .select("id, image_path")
      .eq("id", itemId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!data) redirect(catalogUrl(businessId, { erro: "item_invalido" }));
    existing = data;
  }

  let newImagePath: string | null = null;
  try {
    const kind = formString(formData, "kind");
    if (kind !== "product" && kind !== "service") {
      throw new Error("Tipo de item inválido.");
    }
    const name = requiredText(formData, "name", "Nome", 2, 160);
    const description = optionalText(
      formData,
      "description",
      "A descrição",
      1200,
    );
    const priceMode = normalizeCatalogPriceMode(
      kind,
      formString(formData, "price_mode"),
    );
    const price = priceMode === "consult"
      ? null
      : parseMoney(formString(formData, "price"), "price");
    const promotionalPrice = priceMode === "fixed"
      ? parseMoney(
          formString(formData, "promotional_price"),
          "promotional_price",
          false,
        )
      : null;
    if (
      promotionalPrice !== null &&
      price !== null &&
      promotionalPrice > price
    ) {
      throw new Error("O preço promocional não pode ser maior que o preço normal.");
    }

    const image = imageFromForm(formData, "image");
    let imagePath = existing?.image_path ?? null;
    if (image) {
      newImagePath = await uploadMerchantImage(
        supabase,
        user.id,
        image,
        "catalog",
      );
      imagePath = newImagePath;
    }

    const isFeatured = formData.get("is_featured") === "on";
    const isActive = isFeatured || formData.get("is_active") === "on";
    if (isFeatured) {
      const { error: resetError } = await supabase
        .from("catalog_items")
        .update({ is_featured: false })
        .eq("business_id", businessId);
      if (resetError) throw resetError;
    }

    const values: CatalogItemWrite = {
      kind,
      name,
      description,
      price_mode: priceMode,
      price,
      promotional_price: promotionalPrice,
      image_path: imagePath,
      is_active: isActive,
      is_featured: isFeatured,
    };
    const result = existing
      ? await supabase
          .from("catalog_items")
          .update(
            values as Database["public"]["Tables"]["catalog_items"]["Update"],
          )
          .eq("id", existing.id)
          .eq("business_id", businessId)
      : await supabase
          .from("catalog_items")
          .insert(
            { ...values, business_id: businessId } as Database["public"]["Tables"]["catalog_items"]["Insert"],
          );

    if (result.error) throw result.error;
    if (newImagePath) {
      await removeMerchantImages(supabase, user.id, [existing?.image_path]);
    }
  } catch (error) {
    if (newImagePath) {
      await removeMerchantImages(supabase, user.id, [newImagePath]);
    }
    console.error("Falha ao salvar item do catálogo", error);
    redirect(catalogUrl(businessId, { erro: "salvar_item" }));
  }

  revalidateCatalog(business.slug);
  redirect(catalogUrl(businessId, { sucesso: "item_salvo" }));
}

export async function setFeaturedCatalogItemAction(formData: FormData) {
  const businessId = Number(formString(formData, "business_id"));
  const itemId = Number(formString(formData, "item_id"));
  const nextFeatured = formString(formData, "next_featured") === "true";
  if (
    !Number.isSafeInteger(businessId) || businessId <= 0 ||
    !Number.isSafeInteger(itemId) || itemId <= 0
  ) return;

  const { supabase, user, business } = await ownedBusiness(businessId);
  if (!user || !business) return;
  const { data: item } = await supabase
    .from("catalog_items")
    .select("id, is_active")
    .eq("id", itemId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!item) return;

  if (nextFeatured) {
    await supabase
      .from("catalog_items")
      .update({ is_featured: false })
      .eq("business_id", businessId);
  }
  await supabase
    .from("catalog_items")
    .update({
      is_featured: nextFeatured,
      ...(nextFeatured ? { is_active: true } : {}),
    })
    .eq("id", itemId)
    .eq("business_id", businessId);

  revalidateCatalog(business.slug);
}

export async function toggleCatalogItemAction(formData: FormData) {
  const businessId = Number(formString(formData, "business_id"));
  const itemId = Number(formString(formData, "item_id"));
  const nextActive = formString(formData, "next_active") === "true";
  if (
    !Number.isSafeInteger(businessId) || businessId <= 0 ||
    !Number.isSafeInteger(itemId) || itemId <= 0
  ) return;

  const { supabase, user, business } = await ownedBusiness(businessId);
  if (!user || !business) return;
  await supabase
    .from("catalog_items")
    .update({
      is_active: nextActive,
      ...(nextActive ? {} : { is_featured: false }),
    })
    .eq("id", itemId)
    .eq("business_id", businessId);
  revalidateCatalog(business.slug);
}

export async function deleteCatalogItemAction(formData: FormData) {
  const businessId = Number(formString(formData, "business_id"));
  const itemId = Number(formString(formData, "item_id"));
  if (
    !Number.isSafeInteger(businessId) || businessId <= 0 ||
    !Number.isSafeInteger(itemId) || itemId <= 0
  ) return;

  const { supabase, user, business } = await ownedBusiness(businessId);
  if (!user || !business) return;
  const { data: item } = await supabase
    .from("catalog_items")
    .select("id, image_path")
    .eq("id", itemId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!item) return;

  const { error } = await supabase
    .from("catalog_items")
    .delete()
    .eq("id", item.id)
    .eq("business_id", businessId);
  if (!error) {
    await removeMerchantImages(supabase, user.id, [item.image_path]);
  }
  revalidateCatalog(business.slug);
}
