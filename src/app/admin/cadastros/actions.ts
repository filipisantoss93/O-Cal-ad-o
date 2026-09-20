"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/dal";
import type { DatabaseWithAdminOwnerLink } from "@/types/admin-owner-link";
import {
  formString,
  normalizePhone,
  normalizePostalCode,
  normalizeSocialProfile,
  normalizeWebsite,
  optionalText,
  positiveInteger,
  requiredText,
  validateEmail,
  ValidationError,
} from "@/lib/validation";

const basePath = "/admin/cadastros";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failurePath(type: "usuario" | "empresa", id: string, error: unknown) {
  const message = error instanceof ValidationError
    ? error.message
    : error instanceof Error
      ? error.message
      : "Não foi possível salvar o cadastro.";
  return basePath + "?tipo=" + type + "&id=" + encodeURIComponent(id) + "&erro=" + encodeURIComponent(message);
}

function readCoordinate(form: FormData, field: "latitude" | "longitude", minimum: number, maximum: number) {
  const raw = formString(form, field).replace(",", ".");
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new ValidationError(field, "Coordenada inválida.");
  }
  return value;
}

function normalizedUnit(value: string | null) {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Campos pessoais do perfil; não altera permissões, e-mail de login nem credenciais de Auth. */
export async function saveAdminUserAction(formData: FormData) {
  const { supabase } = await requireAdmin(basePath);
  const id = formString(formData, "user_id");
  if (!uuidPattern.test(id)) redirect(basePath + "?erro=identificador-invalido");

  try {
    const fullName = requiredText(formData, "full_name", "Nome completo", 2, 120);
    const phone = normalizePhone(formString(formData, "phone_e164"), "phone_e164", false);
    const { data: existing, error: lookupError } = await supabase.from("profiles")
      .select("id").eq("id", id).maybeSingle();
    if (lookupError || !existing) throw new Error("Usuário não encontrado.");

    const { data: updated, error } = await supabase.from("profiles")
      .update({ full_name: fullName, phone_e164: phone })
      .eq("id", id).select("id").maybeSingle();
    if (error || !updated) throw new Error("Não foi possível salvar os dados do usuário.");
  } catch (error) {
    redirect(failurePath("usuario", id, error));
  }

  revalidatePath(basePath);
  revalidatePath("/painel");
  revalidatePath("/painel/perfil");
  redirect(basePath + "?tipo=usuario&id=" + encodeURIComponent(id) + "&salvo=1");
}

/** Atualiza somente os campos públicos permitidos; mantém dono, slug, faturamento e moderação. */
export async function saveAdminBusinessAction(formData: FormData) {
  const { supabase } = await requireAdmin(basePath);
  const rawId = formString(formData, "business_id");
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) redirect(basePath + "?erro=identificador-invalido");

  let slug = "";
  try {
    const { data: current, error: lookupError } = await supabase.from("businesses")
      .select("id, slug, listing_type, city_id, street, address_number, neighborhood, latitude, longitude")
      .eq("id", id).eq("listing_type", "business").maybeSingle();
    if (lookupError || !current) throw new Error("Empresa não encontrada.");
    slug = current.slug;

    const name = requiredText(formData, "name", "Nome da empresa", 2, 120);
    const description = optionalText(formData, "description", "Descrição", 2000);
    const street = requiredText(formData, "street", "Rua", 2, 160);
    const addressNumber = requiredText(formData, "address_number", "Número", 1, 20);
    const complement = optionalText(formData, "complement", "Complemento", 120);
    const neighborhood = requiredText(formData, "neighborhood", "Bairro", 2, 120);
    const postalCode = normalizePostalCode(formString(formData, "postal_code"));
    const cityId = positiveInteger(formData, "city_id", "uma cidade");
    const categoryId = positiveInteger(formData, "category_id", "uma categoria");
    const whatsapp = normalizePhone(formString(formData, "whatsapp_e164"), "whatsapp_e164", false);
    const phone = normalizePhone(formString(formData, "phone_e164"), "phone_e164", false);
    const rawEmail = formString(formData, "public_email");
    const publicEmail = rawEmail ? validateEmail(rawEmail, "public_email") : null;
    const websiteUrl = normalizeWebsite(formString(formData, "website_url"));
    const instagramUrl = normalizeSocialProfile(formString(formData, "instagram_url"), "instagram");
    const facebookUrl = normalizeSocialProfile(formString(formData, "facebook_url"), "facebook");
    const latitude = readCoordinate(formData, "latitude", -90, 90);
    const longitude = readCoordinate(formData, "longitude", -180, 180);
    if ((latitude === null) !== (longitude === null)) {
      throw new ValidationError("latitude", "Informe ambas as coordenadas ou deixe as duas vazias.");
    }

    const [{ data: city, error: cityError }, { data: category, error: categoryError }] = await Promise.all([
      supabase.from("cities").select("id").eq("id", cityId).eq("is_active", true).maybeSingle(),
      supabase.from("categories").select("id").eq("id", categoryId)
        .eq("is_active", true).neq("slug", "locais-publicos").maybeSingle(),
    ]);
    if (cityError || !city) throw new ValidationError("city_id", "Selecione uma cidade válida.");
    if (categoryError || !category) throw new ValidationError("category_id", "Selecione uma categoria comercial válida.");

    // Unidades do mesmo prédio são distintas quando seus complementos diferem.
    const { data: nearby, error: duplicateError } = await supabase.from("businesses")
      .select("id, name, street, address_number, complement")
      .eq("city_id", cityId).eq("name", name).eq("street", street)
      .eq("address_number", addressNumber).neq("id", id).limit(100);
    if (duplicateError) throw new Error("Não foi possível verificar outros cadastros no endereço.");
    if ((nearby ?? []).some((entry) => normalizedUnit(entry.complement) === normalizedUnit(complement))) {
      throw new ValidationError("complement", "Já existe uma empresa com o mesmo nome, endereço e complemento.");
    }

    const addressChanged = cityId !== current.city_id ||
      street !== current.street || addressNumber !== current.address_number ||
      neighborhood !== current.neighborhood;
    // Se o endereço mudou e o formulário ainda traz o par antigo, não conserve um pino incorreto.
    const coordinatesUnchanged = latitude === current.latitude && longitude === current.longitude;
    const resolvedLatitude = addressChanged && coordinatesUnchanged ? null : latitude;
    const resolvedLongitude = addressChanged && coordinatesUnchanged ? null : longitude;

    const { data: updated, error } = await supabase.from("businesses").update({
      name, description, city_id: cityId, category_id: categoryId,
      street, address_number: addressNumber, complement, neighborhood, postal_code: postalCode,
      whatsapp_e164: whatsapp, phone_e164: phone, public_email: publicEmail,
      website_url: websiteUrl, instagram_url: instagramUrl, facebook_url: facebookUrl,
      latitude: resolvedLatitude, longitude: resolvedLongitude,
    }).eq("id", id).eq("listing_type", "business").select("id").maybeSingle();
    if (error || !updated) throw new Error("Não foi possível atualizar a empresa.");
  } catch (error) {
    redirect(failurePath("empresa", rawId, error));
  }

  revalidatePath(basePath);
  revalidatePath("/");
  revalidatePath("/buscar");
  revalidatePath("/painel");
  revalidatePath("/painel/loja");
  if (slug) revalidatePath("/loja/" + slug);
  redirect(basePath + "?tipo=empresa&id=" + id + "&salvo=1");
}


/** Somente perfis pré-cadastrados e sem proprietário. Limite validado no banco na mesma transação do vínculo. */
export async function linkAdminUnclaimedBusinessAction(formData: FormData) {
  const { supabase } = await requireAdmin(basePath);
  const rawBusinessId = formString(formData, "business_id");
  const businessId = Number(rawBusinessId);
  const userId = formString(formData, "user_id");
  if (!Number.isSafeInteger(businessId) || businessId <= 0 || !uuidPattern.test(userId)) {
    redirect(basePath + "?erro=" + encodeURIComponent("Selecione uma empresa e um usuário válidos."));
  }

  try {
    const client = supabase as unknown as SupabaseClient<DatabaseWithAdminOwnerLink>;
    const { error } = await client.rpc("admin_link_unclaimed_business", {
      p_business_id: businessId,
      p_user_id: userId,
    });
    if (error) {
      // Não exibir mensagens inesperadas do banco; erros conhecidos são explícitos.
      if (error.message.includes("Limite de lojas atingido")) {
        throw new ValidationError("user_id", "Limite de lojas atingido para esta conta. O vínculo não foi realizado.");
      }
      if (error.message.includes("já possui responsável") || error.message.includes("não está disponível") ||
          error.message.includes("vinculada por outra operação")) {
        throw new ValidationError("business_id", "A empresa não está mais disponível para vínculo. Atualize a página.");
      }
      if (error.message.includes("Usuário não encontrado")) {
        throw new ValidationError("user_id", "Usuário não encontrado ou não autorizado a possuir empresas.");
      }
      throw new Error("Não foi possível realizar o vínculo. Verifique os cadastros e tente novamente.");
    }
  } catch (error) {
    redirect(failurePath("empresa", rawBusinessId, error));
  }

  revalidatePath(basePath);
  revalidatePath("/admin/perfis-nao-reivindicados");
  revalidatePath("/admin/reivindicacoes");
  revalidatePath("/admin/dashboard");
  revalidatePath("/painel");
  revalidatePath("/painel/loja");
  revalidatePath("/buscar");
  redirect(basePath + "?tipo=empresa&id=" + businessId + "&vinculado=1");
}
