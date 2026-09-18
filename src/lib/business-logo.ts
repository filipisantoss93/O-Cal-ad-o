import "server-only";

import { getSupabaseEnv } from "@/lib/supabase/env";

type ResolvedLogoRow = {
  business_id: number;
  resolved_logo_path: string | null;
  logo_origin: "unit" | "network" | "business" | "missing";
};

type ResolvedLogoResponse = {
  logos?: ResolvedLogoRow[];
};

export async function loadResolvedBusinessLogoPaths(
  businessIds: number[],
): Promise<Map<number, string | null>> {
  const ids = [...new Set(
    businessIds.filter((id) => Number.isSafeInteger(id) && id > 0),
  )].slice(0, 100);

  if (!ids.length) return new Map();

  const { url, publishableKey } = getSupabaseEnv();

  try {
    const response = await fetch(
      `${url}/functions/v1/resolve-business-logos`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: publishableKey,
        },
        body: JSON.stringify({ businessIds: ids }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error(
        "[business-logo] edge lookup failed",
        response.status,
        response.statusText,
      );
      return new Map();
    }

    const payload = (await response.json()) as ResolvedLogoResponse;
    return new Map(
      (payload.logos ?? []).map((row) => [
        row.business_id,
        row.resolved_logo_path,
      ]),
    );
  } catch (error) {
    console.error("[business-logo] edge lookup failed", error);
    return new Map();
  }
}
