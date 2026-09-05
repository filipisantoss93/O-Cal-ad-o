type SupabasePublicEnv = {
  url: string;
  publishableKey: string;
};

// These values are intentionally public: the publishable key is protected by
// Supabase RLS and is shipped to the browser even when provided through a
// NEXT_PUBLIC_ variable. Environment variables still take precedence so the
// project can rotate either value without a code change.
const defaultSupabaseUrl = "https://mieekhdagjlzdbeklrxp.supabase.co";
const defaultSupabasePublishableKey =
  "sb_publishable_rECGkHsIRJpT8hBNNuuwrw_mSgZZCNQ";

function resolveSupabaseEnv(): SupabasePublicEnv {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || defaultSupabaseUrl,
    publishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      defaultSupabasePublishableKey,
  };
}

export function hasSupabaseEnv() {
  const { url, publishableKey } = resolveSupabaseEnv();
  return Boolean(url && publishableKey);
}

export function getSupabaseEnv(): SupabasePublicEnv {
  const { url, publishableKey } = resolveSupabaseEnv();

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return { url, publishableKey };
}
