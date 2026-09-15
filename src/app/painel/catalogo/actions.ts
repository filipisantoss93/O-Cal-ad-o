"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeCatalogPriceMode } from "@/lib/catalog-pricing";
import { validateContactSelection } from "@/lib/contact-action";
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
import type { CatalogPriceMode, ContactAction } from "@/types/catalog";
import type { Database } from "@/types/database";

type CatalogItemWrite = Database["public"]["Tables"]["catalog_items"]["Update"] & {
  price_mode: CatalogPriceMode;
  contact_action: ContactAction;
  contact_url: string | null;
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
    .select("id, slug, whatsapp_e164, phone_e164")
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

  if (!existing) {
    const now = new Date().toISOString();
    const { data: ownedBusinesses, error: businessesError } = await supabase
      .from("businesses").select("id").eq("owner_id", user.id);
    if (businessesError) redirect(catalogUrl(businessId, { erro: "salvar_item" }));
    const [{ count, error: countError }, { data: activePro, error: planError }, { data: planRules, error: rulesError }] = await Promise.all([
      supabase.from("catalog_items").select("id", { count: "exact", head: true })
        .in("business_id", ownedBusinesses?.map((item) => item.id) ?? [businessId]),
      supabase.from("subscriptions").select("id").eq("user_id", user.id)
        .eq("plan_code", "pro").eq("status", "active")
        .lte("current_period_start", now).gt("current_period_end", now).limit(1),
      supabase.from("billing_plan_rules").select("code, included_catalog_items").eq("is_active", true),
    ]);
    if (countError || planError || rulesError) redirect(catalogUrl(businessId, { erro: "salvar_item" }));
    const plan = activePro?.length ? "pro" : "free";
    const limit = planRules?.find((rule) => rule.code === plan)?.included_catalog_items ?? (plan === "pro" ? 20 : 4);
    if ((count ?? 0) >= limit) {
      redirect(catalogUrl(businessId, { erro: "limite_catalogo" }));
    }
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
    const { contactAction, contactUrl } = validateContactSelection(
      formString(formData, "contact_action"),
      formString(formData, "contact_url"),
      {
        whatsapp: business.whatsapp_e164,
        phone: business.phone_e164,
      },
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
      contact_action: contactAction,
      contact_url: contactUrl,
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
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("BILLING_CATALOG_LIMIT")) {
      redirect(catalogUrl(businessId, { erro: "limite_catalogo" }));
    }
    if (message.includes("WhatsApp da loja")) {
      redirect(catalogUrl(businessId, { erro: "whatsapp_ausente" }));
    }
    if (message.includes("telefone fixo")) {
      redirect(catalogUrl(businessId, { erro: "telefone_ausente" }));
    }
    if (message.includes("link") || message.includes("http")) {
      redirect(catalogUrl(businessId, { erro: "link_invalido" }));
    }
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
