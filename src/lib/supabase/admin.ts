import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "@/lib/supabase/env";

export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!secretKey) {
    throw new Error(
      "Supabase administrativo não configurado. Defina SUPABASE_SECRET_KEY no ambiente do servidor.",
    );
  }

  return createClient<Database>(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
