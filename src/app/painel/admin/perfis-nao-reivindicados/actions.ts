"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/dal";
import { formString, normalizePhone, normalizePostalCode, normalizeSlug, normalizeWebsite, optionalText, positiveInteger, requiredText, ValidationError } from "@/lib/validation";
import type { DatabaseWithBusinessClaims } from "@/types/business-claims";

function optionalCoordinate(formData: FormData, field: "latitude" | "longitude", minimum: number, maximum: number) {
  const rawValue = formString(formData, field);
  if (!rawValue) return null;
  const value = Number(rawValue.replace(",", "."));
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new ValidationError(field, "Coordenada inválida.");
  return value;
}

function messageFor(error: unknown) {
  if (error instanceof ValidationError) return error.message;
  if (error instanceof Error) return error.message;
  return "Não foi possível salvar o perfil não reivindicado.";
}

function adminReturnPath(formData: FormData) {
  const value = formString(formData, "return_to");
  return value === "/painel/admin/reivindicacoes"
    ? "/painel/admin/reivindicacoes"
    : "/painel/admin/perfis-nao-reivindicados";
}

export async function createUnclaimedBusinessAction(formData: FormData) {
  const { supabase, user } = await requireAdmin("/painel/admin/perfis-nao-reivindicados");
  const client = supabase as unknown as SupabaseClient<DatabaseWithBusinessClaims>;
  try {
    const name = requiredText(formData, "name", "Nome do estabelecimento", 2, 120);
    const cityId = positiveInteger(formData, "city_id", "uma cidade");
    const categoryId = positiveInteger(formData, "category_id", "uma categoria");
    const street = requiredText(formData, "street", "Rua ou avenida", 2, 160);
    const addressNumber = requiredText(formData, "address_number", "Número", 1, 20);
    const neighborhood = requiredText(formData, "neighborhood", "Bairro", 2, 120);
    const complement = optionalText(formData, "complement", "O complemento", 120);
    const postalCode = normalizePostalCode(formString(formData, "postal_code"));
    const phone = normalizePhone(formString(formData, "phone_e164"), "phone_e164", false);
    const websiteUrl = normalizeWebsite(formString(formData, "website_url"));
    const dataSourceUrl = normalizeWebsite(formString(formData, "data_source_url"));
    const latitude = optionalCoordinate(formData, "latitude", -90, 90);
    const longitude = optionalCoordinate(formData, "longitude", -180, 180);
    if ((latitude === null) !== (longitude === null)) throw new ValidationError("latitude", "Informe latitude e longitude juntas ou deixe as duas em branco.");

    const [{ data: category, error: categoryError }, { data: city, error: cityError }] = await Promise.all([
      supabase.from("categories").select("id, name, slug").eq("id", categoryId).eq("is_active", true).neq("slug", "locais-publicos").maybeSingle(),
      supabase.from("cities").select("id, name, state_code").eq("id", cityId).eq("is_active", true).maybeSingle(),
    ]);
    if (categoryError || !category) throw new ValidationError("category_id", "Selecione uma categoria válida.");
    if (cityError || !city) throw new ValidationError("city_id", "Selecione uma cidade válida.");

    const baseSlug = normalizeSlug(name);
    const { data: existing } = await supabase.from("businesses").select("id").eq("slug", baseSlug).limit(1).maybeSingle();
    const slug = existing ? normalizeSlug(`${name}-${city.state_code}-${cityId}`) : baseSlug;
    const publishNow = formData.get("publication_status") !== null;
    const description = `${category.name} localizado em ${city.name}/${city.state_code}. Perfil informativo ainda não reivindicado pelo responsável.`;

    const { error } = await client.from("businesses").insert({
      owner_id: null, pre_registered: true, city_id: cityId, category_id: categoryId, listing_type: "business", public_place_kind: null,
      official_source_url: null, slug, name, description, tags: [category.name, neighborhood], whatsapp_e164: null, phone_e164: phone,
      public_email: null, website_url: websiteUrl, instagram_url: null, facebook_url: null, street, address_number: addressNumber,
      complement, neighborhood, postal_code: postalCode, latitude, longitude, logo_path: null, cover_path: null, status: "approved",
      publication_status: publishNow ? "published" : "unpublished", moderated_at: new Date().toISOString(), moderated_by: user.id,
      plan: "free", featured_until: null, billing_suspended: false, billing_suspension_reason: null, is_active: true,
      data_source_url: dataSourceUrl, data_source_checked_at: new Date().toISOString(),
    });
    if (error) {
      if (error.code === "23505") throw new Error("Já existe um estabelecimento com esse nome/endereço público.");
      throw new Error("Não foi possível salvar o estabelecimento.");
    }
    revalidatePath("/"); revalidatePath("/buscar"); revalidatePath("/painel/admin/perfis-nao-reivindicados");
  } catch (error) {
    redirect(`/painel/admin/perfis-nao-reivindicados?erro=${encodeURIComponent(messageFor(error))}`);
  }
  redirect("/painel/admin/perfis-nao-reivindicados?sucesso=Perfil%20criado%20com%20sucesso");
}

export async function updateUnclaimedBusinessAction(formData: FormData) {
  const returnTo = adminReturnPath(formData);
  const businessId = positiveInteger(formData, "business_id", "um estabelecimento");
  const editPath = `/painel/admin/perfis-nao-reivindicados/${businessId}/editar`;
  const { supabase, user } = await requireAdmin(editPath);
  const client = supabase as unknown as SupabaseClient<DatabaseWithBusinessClaims>;
  let slug = "";

  try {
    const { data: business, error: businessError } = await client
      .from("businesses")
      .select("id, slug, owner_id, pre_registered, listing_type")
      .eq("id", businessId)
      .maybeSingle();
    if (businessError || !business) throw new ValidationError("business_id", "Estabelecimento não encontrado.");
    if (!business.pre_registered || business.owner_id || business.listing_type !== "business") {
      throw new ValidationError("business_id", "Somente perfis pré-cadastrados e ainda não reivindicados podem ser corrigidos por esta tela.");
    }
    slug = business.slug;

    const name = requiredText(formData, "name", "Nome do estabelecimento", 2, 120);
    const cityId = positiveInteger(formData, "city_id", "uma cidade");
    const categoryId = positiveInteger(formData, "category_id", "uma categoria");
    const street = requiredText(formData, "street", "Rua ou avenida", 2, 160);
    const addressNumber = requiredText(formData, "address_number", "Número", 1, 20);
    const neighborhood = requiredText(formData, "neighborhood", "Bairro", 2, 120);
    const complement = optionalText(formData, "complement", "O complemento", 120);
    const postalCode = normalizePostalCode(formString(formData, "postal_code"));
    const dataSourceUrl = normalizeWebsite(formString(formData, "data_source_url"));
    const latitude = optionalCoordinate(formData, "latitude", -90, 90);
    const longitude = optionalCoordinate(formData, "longitude", -180, 180);
    if ((latitude === null) !== (longitude === null)) throw new ValidationError("latitude", "Informe latitude e longitude juntas ou deixe as duas em branco.");

    const [{ data: category, error: categoryError }, { data: city, error: cityError }] = await Promise.all([
      supabase.from("categories").select("id, name, slug").eq("id", categoryId).eq("is_active", true).neq("slug", "locais-publicos").maybeSingle(),
      supabase.from("cities").select("id, name, state_code").eq("id", cityId).eq("is_active", true).maybeSingle(),
    ]);
    if (categoryError || !category) throw new ValidationError("category_id", "Selecione uma categoria válida.");
    if (cityError || !city) throw new ValidationError("city_id", "Selecione uma cidade válida.");

    const { data: duplicate, error: duplicateError } = await client
      .from("businesses")
      .select("id")
      .eq("city_id", cityId)
      .eq("name", name)
      .eq("street", street)
      .eq("address_number", addressNumber)
      .neq("id", businessId)
      .limit(1)
      .maybeSingle();
    if (duplicateError) throw new Error("Não foi possível validar possíveis duplicidades.");
    if (duplicate) throw new ValidationError("name", "Já existe outro estabelecimento com esse nome e endereço.");

    const publishNow = formData.get("publication_status") !== null;
    const description = `${category.name} localizado em ${city.name}/${city.state_code}. Perfil informativo ainda não reivindicado pelo responsável.`;
    const { error } = await client
      .from("businesses")
      .update({
        city_id: cityId,
        category_id: categoryId,
        name,
        description,
        tags: [category.name, neighborhood],
        street,
        address_number: addressNumber,
        complement,
        neighborhood,
        postal_code: postalCode,
        latitude,
        longitude,
        publication_status: publishNow ? "published" : "unpublished",
        data_source_url: dataSourceUrl,
        data_source_checked_at: new Date().toISOString(),
        moderated_at: new Date().toISOString(),
        moderated_by: user.id,
      })
      .eq("id", businessId)
      .eq("pre_registered", true)
      .is("owner_id", null)
      .eq("listing_type", "business");
    if (error) throw new Error("Não foi possível atualizar o estabelecimento.");

    revalidatePath("/");
    revalidatePath("/buscar");
    revalidatePath("/painel/admin/perfis-nao-reivindicados");
    revalidatePath("/painel/admin/reivindicacoes");
    if (slug) revalidatePath(`/loja/${slug}`);
  } catch (error) {
    const suffix = returnTo === "/painel/admin/reivindicacoes" ? `&return_to=${encodeURIComponent(returnTo)}` : "";
    redirect(`${editPath}?erro=${encodeURIComponent(messageFor(error))}${suffix}`);
  }

  const separator = returnTo.includes("?") ? "&" : "?";
  redirect(`${returnTo}${separator}sucesso=${encodeURIComponent("Informações do perfil atualizadas com sucesso")}`);
}
