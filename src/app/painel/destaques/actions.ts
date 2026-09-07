"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  imageFromForm,
  removeMerchantImages,
  uploadMerchantImage,
} from "@/lib/merchant/media";
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
  const isBanner = /^banner_(7|15|30)$/.test(productCode);
  if (!/^(category|city|combo|banner)_(7|15|30)$/.test(productCode)) {
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

  let bannerImagePath: string | null = null;
  let bannerTitle: string | null = null;
  let bannerDescription: string | null = null;
  if (isBanner) {
    bannerTitle = String(formData.get("banner_title") ?? "").trim();
    bannerDescription = String(formData.get("banner_description") ?? "").trim();
    if (bannerTitle.length < 3 || bannerTitle.length > 90) {
      redirect(highlightsUrl({ loja: String(businessId), erro: "banner_titulo_invalido" }));
    }
    if (bannerDescription.length < 3 || bannerDescription.length > 180) {
      redirect(highlightsUrl({ loja: String(businessId), erro: "banner_descricao_invalida" }));
    }
    let image: File | null = null;
    try {
      image = imageFromForm(formData, "banner_image");
    } catch (error) {
      console.error("Imagem de banner inválida", error);
      redirect(highlightsUrl({ loja: String(businessId), erro: "banner_imagem_invalida" }));
    }
    if (!image) {
      redirect(highlightsUrl({ loja: String(businessId), erro: "banner_imagem_obrigatoria" }));
    }
    try {
      bannerImagePath = await uploadMerchantImage(
        supabase,
        user.id,
        image,
        "banner",
      );
    } catch (error) {
      console.error("Falha ao preparar imagem do banner", error);
      redirect(highlightsUrl({ loja: String(businessId), erro: "banner_imagem_invalida" }));
    }
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
        action: isBanner ? "banner_campaign" : "highlight_campaign",
        business_id: businessId,
        product_code: productCode,
        starts_on: startsOn || undefined,
        creative_image_path: bannerImagePath ?? undefined,
        creative_title: bannerTitle ?? undefined,
        creative_description: bannerDescription ?? undefined,
      }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Falha ao iniciar destaque na Efí", error);
    if (bannerImagePath) {
      await removeMerchantImages(supabase, user.id, [bannerImagePath]);
    }
    redirect(highlightsUrl({ loja: String(businessId), erro: "checkout_efi" }));
  }

  const data = (await response.json().catch(() => ({}))) as CheckoutResponse;
  if (!response.ok || !data.payment_url) {
    if (bannerImagePath) {
      await removeMerchantImages(supabase, user.id, [bannerImagePath]);
    }
    const errorCode =
      typeof data.error === "string" && data.error.length <= 80
        ? data.error
        : "checkout_efi";
    redirect(highlightsUrl({ loja: String(businessId), erro: errorCode }));
  }

  redirect(data.payment_url);
}

export async function replaceBannerCreativeAction(formData: FormData) {
  const campaignId = Number(formData.get("campaign_id"));
  const businessId = Number(formData.get("business_id"));
  const title = String(formData.get("banner_title") ?? "").trim();
  const description = String(formData.get("banner_description") ?? "").trim();
  const returnUrl = highlightsUrl({ loja: String(businessId) });
  if (
    !Number.isSafeInteger(campaignId) || campaignId <= 0 ||
    !Number.isSafeInteger(businessId) || businessId <= 0 ||
    title.length < 3 || title.length > 90 ||
    description.length < 3 || description.length > 180
  ) {
    redirect(`${returnUrl}&erro=banner_criativo_invalido`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?next=%2Fpainel%2Fdestaques");
  const { data: campaign } = await supabase
    .from("highlight_campaigns")
    .select("id, business_id, creative_image_path")
    .eq("id", campaignId)
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .eq("placement", "banner")
    .in("status", ["pending", "paused"])
    .maybeSingle();
  if (!campaign) redirect(`${returnUrl}&erro=banner_criativo_invalido`);

  let image: File | null = null;
  try {
    image = imageFromForm(formData, "banner_image");
  } catch (error) {
    console.error("Imagem substituta inválida", error);
    redirect(`${returnUrl}&erro=banner_imagem_invalida`);
  }
  if (!image) redirect(`${returnUrl}&erro=banner_imagem_obrigatoria`);

  let newPath: string;
  try {
    newPath = await uploadMerchantImage(supabase, user.id, image, "banner");
  } catch (error) {
    console.error("Falha ao substituir banner", error);
    redirect(`${returnUrl}&erro=banner_imagem_invalida`);
  }
  const { data, error } = await supabase.rpc("replace_banner_creative", {
    p_campaign_id: campaign.id,
    p_image_path: newPath,
    p_title: title,
    p_description: description,
  });
  if (error || data !== true) {
    await removeMerchantImages(supabase, user.id, [newPath]);
    redirect(`${returnUrl}&erro=banner_criativo_invalido`);
  }
  await removeMerchantImages(supabase, user.id, [campaign.creative_image_path]);
  revalidatePath("/painel/destaques");
  revalidatePath("/painel/admin/destaques");
  redirect(`${returnUrl}&sucesso=banner_reenviado`);
}
