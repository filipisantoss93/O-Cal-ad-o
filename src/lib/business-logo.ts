import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database-runtime";

type ResolvedLogoRow = {
  business_id: number;
  resolved_logo_path: string | null;
  logo_origin: "unit" | "network" | "business" | "missing";
};

export async function loadResolvedBusinessLogoPaths(
  supabase: SupabaseClient<Database>,
  businessIds: number[],
): Promise<Map<number, string | null>> {
  const ids = [...new Set(
    businessIds.filter((id) => Number.isSafeInteger(id) && id > 0),
  )].slice(0, 100);

  if (!ids.length) return new Map();

  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: "get_public_business_logo_paths",
    args: { p_business_ids: number[] },
  ) => Promise<{
    data: ResolvedLogoRow[] | null;
    error: { message: string } | null;
  }>;

  const { data, error } = await rpc("get_public_business_logo_paths", {
    p_business_ids: ids,
  });

  if (error) {
    console.error("[business-logo] logo resolution failed", error.message);
    return new Map();
  }

  return new Map(
    (data ?? []).map((row) => [row.business_id, row.resolved_logo_path]),
  );
}
