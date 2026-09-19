"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { actionError } from "@/lib/action-state";
import { requireAdmin } from "@/lib/admin/dal";
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
import type { PublicPlaceKind } from "@/types/catalog";

const publicPlaceKinds = new Set<PublicPlaceKind>([
  "government",
  "health",
  "education",
  "transport",
  "safety",
  "culture",
  "leisure",
  "social_service",
  "other",
]);

function adminActionError(error: unknown): ActionState {
  if (error instanceof ValidationError) {
    return actionError(error.message, error.field);
  }
  if (error instanceof Error) return actionError(error.message);
  return actionError("Não foi possível salvar o local público.");
}

function optionalCoordinate(
  formData: FormData,
  field: "latitude" | "longitude",
  minimum: number,
  maximum: number,
) {
  const rawValue = formString(formData, field);
  if (!rawValue) return null;
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new ValidationError(field, "Coordenadas inválidas.");
  }
  return value;
}

function publicPlaceTags(formData: FormData) {
  const tags = formString(formData, "tags")
    .split(/[,;\n]+/)
    .map((tag) => tag.trim().replace(/^#+/, "").replace(/\s+/g, " "))
    .filter(Boolean);
  const uniqueTags = Array.from(
    new Map(tags.map((tag) => [tag.toLocaleLowerCase("pt-BR"), tag])).values(),
  );

  if (uniqueTags.length < 2 || uniqueTags.length > 12) {
    throw new ValidationError("tags", "Informe de 2 a 12 termos de busca.");
  }
  if (uniqueTags.some((tag) => tag.length < 2 || tag.length > 40)) {
    throw new ValidationError("tags", "Cada termo deve ter entre 2 e 40 caracteres.");
  }
  return uniqueTags;
}

function officialSourceUrl(formData: FormData) {
  const value = formString(formData, "official_source_url");
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname.includes(".")) {
      throw new Error("invalid source");
    }
    const normalized = url.toString();
    if (normalized.length > 500) throw new Error("source too long");
    return normalized;
  } catch {
    throw new ValidationError(
      "official_source_url",
      "Informe uma página oficial segura, começando com https://.",
    );
  }
}

function publicPlaceTime(formData: FormData, field: string) {
  const value = formString(formData, field);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new ValidationError(field, "Revise os horários informados.");
  }
  return value;
}

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
    redirect("/admin?erro=acao-invalida");
  }
  if (action.requiresNote && note.length < 5) {
    redirect("/admin?erro=informe-o-motivo");
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
    .eq("listing_type", "business")
    .select("id, slug")
    .maybeSingle();

  if (error || !data) {
    redirect("/admin?erro=nao-foi-possivel-moderar");
  }

  revalidatePath("/");
  revalidatePath("/buscar");
  revalidatePath(`/loja/${data.slug}`);
  revalidatePath("/admin");
  revalidatePath("/painel");
  revalidatePath("/painel/loja");
  redirect(`/admin?sucesso=${intent}`);
}

export async function savePublicPlaceAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { supabase, user } = await requireAdmin(
      "/admin/locais-publicos",
    );
    const requestedId = formString(formData, "business_id");
    const publicPlaceId = Number(requestedId);
    let previousSlug: string | null = null;

    if (requestedId) {
      if (!Number.isSafeInteger(publicPlaceId) || publicPlaceId <= 0) {
        return actionError("Local público não encontrado.");
      }
      const { data, error } = await supabase
        .from("businesses")
        .select("id, slug")
        .eq("id", publicPlaceId)
        .eq("listing_type", "public_place")
        .maybeSingle();
      if (error || !data) return actionError("Local público não encontrado.");
      previousSlug = data.slug;
    }

    const name = requiredText(formData, "name", "Nome do local", 2, 120);
    const slug = normalizeSlug(formString(formData, "slug") || name);
    const cityId = positiveInteger(formData, "city_id", "uma cidade");
    const kind = formString(formData, "public_place_kind") as PublicPlaceKind;
    if (!publicPlaceKinds.has(kind)) {
      throw new ValidationError(
        "public_place_kind",
        "Selecione o tipo de local público.",
      );
    }

    const description = optionalText(
      formData,
      "description",
      "A descrição",
      2000,
    );
    const tags = publicPlaceTags(formData);
    const whatsapp = normalizePhone(
      formString(formData, "whatsapp_e164"),
      "whatsapp_e164",
      false,
    );
    const phone = normalizePhone(
      formString(formData, "phone_e164"),
      "phone_e164",
      false,
    );
    const emailValue = formString(formData, "public_email");
    const publicEmail = emailValue
      ? validateEmail(emailValue, "public_email")
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
    const postalCode = normalizePostalCode(formString(formData, "postal_code"));
    const latitude = optionalCoordinate(formData, "latitude", -90, 90);
    const longitude = optionalCoordinate(formData, "longitude", -180, 180);
    if ((latitude === null) !== (longitude === null)) {
      throw new ValidationError(
        "city_id",
        "Informe as duas coordenadas ou deixe ambas vazias.",
      );
    }

    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", "locais-publicos")
      .eq("is_active", true)
      .maybeSingle();
    if (categoryError || !category) {
      return actionError("A categoria Locais Públicos ainda não está disponível.");
    }

    const editableData = {
      owner_id: null,
      city_id: cityId,
      category_id: category.id,
      listing_type: "public_place",
      public_place_kind: kind,
      official_source_url: officialSourceUrl(formData),
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
      status: "approved",
      publication_status:
        formData.get("publication_status") === "on" ? "published" : "unpublished",
      moderated_at: new Date().toISOString(),
      moderated_by: user.id,
      plan: "free",
      featured_until: null,
      billing_suspended: false,
      billing_suspension_reason: null,
      is_active: formData.get("is_active") === "on",
    };

    const result = requestedId
      ? await supabase
          .from("businesses")
          .update(editableData)
          .eq("id", publicPlaceId)
          .eq("listing_type", "public_place")
          .select("id")
          .maybeSingle()
      : await supabase
          .from("businesses")
          .insert(editableData)
          .select("id")
          .single();

    if (result.error || !result.data) {
      if (result.error?.code === "23505") {
        return actionError(
          "Esse endereço público já está em uso nessa cidade.",
          "slug",
        );
      }
      return actionError("Não foi possível salvar o local público. Revise os dados.");
    }

    revalidatePath("/");
    revalidatePath("/buscar");
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/locais-publicos");
    revalidatePath(`/loja/${slug}`);
    if (previousSlug && previousSlug !== slug) {
      revalidatePath(`/loja/${previousSlug}`);
    }

    return {
      status: "success",
      message: requestedId
        ? "Local público atualizado com sucesso."
        : "Local público cadastrado com sucesso. Ele já aparece na lista abaixo.",
    };
  } catch (error) {
    return adminActionError(error);
  }
}

export async function savePublicPlaceHoursAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { supabase } = await requireAdmin(
      "/admin/locais-publicos",
    );
    const publicPlaceId = Number(formString(formData, "business_id"));
    if (!Number.isSafeInteger(publicPlaceId) || publicPlaceId <= 0) {
      return actionError("Local público não encontrado.");
    }

    const { data: publicPlace, error: publicPlaceError } = await supabase
      .from("businesses")
      .select("id, slug")
      .eq("id", publicPlaceId)
      .eq("listing_type", "public_place")
      .maybeSingle();
    if (publicPlaceError || !publicPlace) {
      return actionError("Local público não encontrado.");
    }

    const alwaysOpen = formData.get("always_open") === "on";
    const rows = [];
    for (let weekday = 0; weekday <= 6; weekday += 1) {
      const isClosed =
        !alwaysOpen &&
        formString(formData, `day_${weekday}_closed`) === "true";
      const opensAt = alwaysOpen
        ? "00:00:00"
        : isClosed
          ? null
          : publicPlaceTime(formData, `day_${weekday}_opens`);
      const closesAt = alwaysOpen
        ? "23:59:59"
        : isClosed
          ? null
          : publicPlaceTime(formData, `day_${weekday}_closes`);
      if (!isClosed && opensAt === closesAt) {
        throw new ValidationError(
          `day_${weekday}_closes`,
          "Abertura e fechamento precisam ser diferentes.",
        );
      }
      rows.push({
        business_id: publicPlace.id,
        weekday,
        opens_at: opensAt,
        closes_at: closesAt,
        is_closed: isClosed,
        display_order: 0,
      });
    }

    const { error } = await supabase.from("business_hours").upsert(rows, {
      onConflict: "business_id,weekday,display_order",
    });
    if (error) return actionError("Não foi possível salvar os horários.");

    revalidatePath("/admin/locais-publicos");
    revalidatePath(`/loja/${publicPlace.slug}`);
    return { status: "success", message: "Horários salvos com sucesso." };
  } catch (error) {
    return adminActionError(error);
  }
}
