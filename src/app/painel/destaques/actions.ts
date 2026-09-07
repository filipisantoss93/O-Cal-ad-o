"use server";

import { redirect } from "next/navigation";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type CheckoutResponse = {
  payment_url?: string;
  error?: string;
};

function highlightsUrl(params: Record<string, string>) {
  const query = new URLSearchParams(params);
  return `/painel/destaques?${query.toString()}`;
}

export async function startHighlightCheckoutAction(formData: FormData) {
  const businessId = Number(formData.get("business_id"));
  const productCode = String(formData.get("product_code") ?? "");
  const startsOn = String(formData.get("starts_on") ?? "");

  if (!Number.isSafeInteger(businessId) || businessId <= 0) {
    redirect(highlightsUrl({ erro: "loja_invalida" }));
  }
  if (!/^(category|city|combo)_(7|15|30)$/.test(productCode)) {
    redirect(highlightsUrl({ loja: String(businessId), erro: "pacote_destaque_invalido" }));
  }
  const parsedStart = startsOn
    ? new Date(`${startsOn}T03:00:00.000Z`)
    : null;
  if (
    startsOn &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) ||
      !parsedStart ||
      Number.isNaN(parsedStart.getTime()) ||
      parsedStart.toISOString().slice(0, 10) !== startsOn)
  ) {
    redirect(highlightsUrl({ loja: String(businessId), erro: "data_inicio_invalida" }));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?next=%2Fpainel%2Fdestaques");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    redirect("/entrar?next=%2Fpainel%2Fdestaques");
  }

  const { url, publishableKey } = getSupabaseEnv();
  let response: Response;
  try {
    response = await fetch(`${url}/functions/v1/efi-billing-checkout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "highlight_campaign",
        business_id: businessId,
        product_code: productCode,
        starts_on: startsOn || undefined,
      }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Falha ao iniciar destaque na Efí", error);
    redirect(highlightsUrl({ loja: String(businessId), erro: "checkout_efi" }));
  }

  const data = (await response.json().catch(() => ({}))) as CheckoutResponse;
  if (!response.ok || !data.payment_url) {
    const errorCode =
      typeof data.error === "string" && data.error.length <= 80
        ? data.error
        : "checkout_efi";
    redirect(highlightsUrl({ loja: String(businessId), erro: errorCode }));
  }

  redirect(data.payment_url);
}
