import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type MerchantBusiness = {
  id: number;
  owner_id: string;
  city_id: number;
  category_id: number;
  slug: string;
  name: string;
  description: string | null;
  whatsapp_e164: string;
  public_email: string | null;
  website_url: string | null;
  street: string;
  address_number: string;
  complement: string | null;
  neighborhood: string;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  logo_path: string | null;
  cover_path: string | null;
  status: string;
  publication_status: string;
  moderation_note: string | null;
  plan: string;
  is_active: boolean;
  billing_suspended: boolean;
  billing_suspension_reason: string | null;
  created_at: string;
  updated_at: string;
};

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
  const [profileResult, businessesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, phone_e164, role, created_at, updated_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("businesses")
      .select(
        "id, owner_id, city_id, category_id, slug, name, description, whatsapp_e164, public_email, website_url, street, address_number, complement, neighborhood, postal_code, latitude, longitude, logo_path, cover_path, status, publication_status, moderation_note, plan, is_active, billing_suspended, billing_suspension_reason, created_at, updated_at",
      )
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  if (profileResult.error || businessesResult.error) {
    throw new Error("Não foi possível carregar a área do comerciante.");
  }

  const businesses = (businessesResult.data ?? []) as MerchantBusiness[];

  return {
    supabase,
    user,
    profile: profileResult.data,
    businesses,
    business: businesses[0] ?? null,
  };
}
