import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireMerchantUser(returnTo = "/painel") {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(`/entrar?next=${encodeURIComponent(returnTo)}`);
  }

  return { supabase, user };
}

export async function getMerchantWorkspace(returnTo = "/painel") {
  const { supabase, user } = await requireMerchantUser(returnTo);
  const [profileResult, businessResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, phone_e164, role, created_at, updated_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("businesses")
      .select(
        "id, owner_id, city_id, category_id, slug, name, description, whatsapp_e164, public_email, website_url, street, address_number, complement, neighborhood, postal_code, logo_path, cover_path, status, moderation_note, plan, is_active, created_at, updated_at",
      )
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error || businessResult.error) {
    throw new Error("Não foi possível carregar a área do comerciante.");
  }

  return {
    supabase,
    user,
    profile: profileResult.data,
    business: businessResult.data,
  };
}
