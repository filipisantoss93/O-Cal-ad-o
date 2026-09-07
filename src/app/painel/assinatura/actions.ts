"use server";

import { redirect } from "next/navigation";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function billingUrl(params: Record<string, string>) {
  const query = new URLSearchParams(params);
  return `/painel/assinatura?${query.toString()}`;
}

type CheckoutPayload = {
  action: "pro_card" | "pro_pix" | "extra_store" | "promotion_pack";
  billing_cycle?: string;
  business_id?: number;
  product_code?: string;
};

type CheckoutResponse = {
  ok?: boolean;
  payment_url?: string;
  error?: string;
};

type CancelAddonResponse = {
  ok?: boolean;
  error?: string;
};

async function authenticatedBillingRequest(
  functionName: string,
  payload: Record<string, unknown>,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?next=%2Fpainel%2Fassinatura");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    redirect("/entrar?next=%2Fpainel%2Fassinatura");
  }

  const { url, publishableKey } = getSupabaseEnv();
  return fetch(`${url}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

async function startCheckout(payload: CheckoutPayload): Promise<never> {
  let response: Response;

  try {
    response = await authenticatedBillingRequest("efi-billing-checkout", payload);
  } catch (error) {
    console.error("Falha ao chamar checkout no Supabase", error);
    redirect(billingUrl({ erro: "checkout_efi" }));
  }

  let data: CheckoutResponse = {};
  try {
    data = (await response.json()) as CheckoutResponse;
  } catch {
    data = {};
  }

  if (!response.ok || !data.payment_url) {
    const errorCode =
      typeof data.error === "string" && data.error.length <= 80
        ? data.error
        : "checkout_efi";
    redirect(billingUrl({ erro: errorCode }));
  }

  redirect(data.payment_url);
}

export async function startProCardCheckoutAction(formData: FormData) {
  const cycle = String(formData.get("billing_cycle") ?? "");
  if (!/^(monthly|semiannual|annual)$/.test(cycle)) {
    redirect(billingUrl({ erro: "periodo_invalido" }));
  }
  return startCheckout({ action: "pro_card", billing_cycle: cycle });
}

export async function startProPixCheckoutAction(formData: FormData) {
  const cycle = String(formData.get("billing_cycle") ?? "");
  if (!/^(monthly|semiannual|annual)$/.test(cycle)) {
    redirect(billingUrl({ erro: "periodo_invalido" }));
  }
  return startCheckout({ action: "pro_pix", billing_cycle: cycle });
}

export async function startExtraStoreCheckoutAction() {
  return startCheckout({ action: "extra_store" });
}

export async function startPromotionPackCheckoutAction(formData: FormData) {
  const productCode = String(formData.get("product_code") ?? "");
  const businessId = Number(formData.get("business_id"));

  if (!/^promo_(5|10|20|50)$/.test(productCode)) {
    redirect(billingUrl({ erro: "produto_invalido" }));
  }
  if (!Number.isSafeInteger(businessId) || businessId <= 0) {
    redirect(billingUrl({ erro: "loja_invalida" }));
  }

  return startCheckout({
    action: "promotion_pack",
    business_id: businessId,
    product_code: productCode,
  });
}

export async function cancelAddonAction(formData: FormData) {
  const addonId = Number(formData.get("addon_id"));
  if (!Number.isSafeInteger(addonId) || addonId <= 0) {
    redirect(`${billingUrl({ erro: "adicional_invalido" })}#meus-adicionais`);
  }

  let response: Response;
  try {
    response = await authenticatedBillingRequest("efi-billing-addon-cancel", {
      addon_id: addonId,
    });
  } catch (error) {
    console.error("Falha ao cancelar adicional no Supabase", error);
    redirect(`${billingUrl({ erro: "cancelamento_efi" })}#meus-adicionais`);
  }

  let data: CancelAddonResponse = {};
  try {
    data = (await response.json()) as CancelAddonResponse;
  } catch {
    data = {};
  }

  if (!response.ok || !data.ok) {
    const errorCode =
      typeof data.error === "string" && data.error.length <= 80
        ? data.error
        : "cancelamento_efi";
    redirect(`${billingUrl({ erro: errorCode })}#meus-adicionais`);
  }

  redirect(`${billingUrl({ sucesso: "adicional_cancelado" })}#meus-adicionais`);
}
