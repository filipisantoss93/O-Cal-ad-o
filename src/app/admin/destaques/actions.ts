"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/dal";
import {
  imageFromForm,
  removeMerchantImages,
  uploadMerchantImage,
} from "@/lib/merchant/media";

function adminUrl(params: Record<string, string>) {
  return `/admin/destaques?${new URLSearchParams(params).toString()}`;
}

function startTimestamp(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T03:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : parsed.toISOString();
}

export async function updateHighlightPackageAction(formData: FormData) {
  const { supabase } = await requireAdmin("/admin/destaques");
  const code = String(formData.get("code") ?? "");
  const price = Number(formData.get("price"));
  const isActive = formData.get("enabled") === "true";
  const priceCents = Math.round(price * 100);
  if (
    !/^(category|city|combo|banner)_(7|15|30)$/.test(code) ||
    !Number.isSafeInteger(priceCents) ||
    priceCents < 100 ||
    priceCents > 1_000_000
  ) {
    redirect(adminUrl({ erro: "pacote_invalido" }));
  }

  const { error } = await supabase
    .from("highlight_packages")
    .update({ price_cents: priceCents, is_active: isActive })
    .eq("code", code);
  if (error) redirect(adminUrl({ erro: "configuracao" }));

  revalidatePath("/painel/destaques");
  revalidatePath("/admin/destaques");
  redirect(`${adminUrl({ sucesso: "pacote" })}#precos`);
}

export async function updateHighlightCapacityAction(formData: FormData) {
  const { supabase } = await requireAdmin("/admin/destaques");
  const code = String(formData.get("code") ?? "");
  const maxActive = Number(formData.get("max_active"));
  const isActive = formData.get("enabled") === "true";
  if (
    !/^(city|category|banner)$/.test(code) ||
    !Number.isSafeInteger(maxActive) ||
    maxActive < 1 ||
    maxActive > 100
  ) {
    redirect(adminUrl({ erro: "capacidade_invalida" }));
  }

  const { error } = await supabase
    .from("highlight_placement_rules")
    .update({ max_active: maxActive, is_active: isActive })
    .eq("code", code);
  if (error) redirect(adminUrl({ erro: "configuracao" }));

  revalidatePath("/painel/destaques");
  revalidatePath("/admin/destaques");
  redirect(`${adminUrl({ sucesso: "capacidade" })}#capacidade`);
}

export async function createComplimentaryHighlightAction(formData: FormData) {
  const { supabase } = await requireAdmin("/admin/destaques");
  const businessId = Number(formData.get("business_id"));
  const packageCode = String(formData.get("package_code") ?? "");
  const startsAt = startTimestamp(String(formData.get("starts_on") ?? ""));
  const note = String(formData.get("admin_note") ?? "").trim().slice(0, 1000);
  const isBanner = /^banner_(7|15|30)$/.test(packageCode);

  if (
    !Number.isSafeInteger(businessId) ||
    businessId <= 0 ||
    !/^(category|city|combo|banner)_(7|15|30)$/.test(packageCode) ||
    !startsAt
  ) {
    redirect(adminUrl({ erro: "cortesia_invalida" }));
  }

  let bannerOwnerId: string | null = null;
  let bannerImagePath: string | null = null;
  let bannerTitle: string | null = null;
  let bannerDescription: string | null = null;

  if (isBanner) {
    bannerTitle = String(formData.get("banner_title") ?? "").trim();
    bannerDescription = String(formData.get("banner_description") ?? "").trim();

    if (bannerTitle.length < 3 || bannerTitle.length > 90) {
      redirect(adminUrl({ erro: "banner_titulo_invalido" }));
    }
    if (bannerDescription.length < 3 || bannerDescription.length > 180) {
      redirect(adminUrl({ erro: "banner_descricao_invalida" }));
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("owner_id")
      .eq("id", businessId)
      .maybeSingle();

    if (!business?.owner_id) {
      redirect(adminUrl({ erro: "loja_inelegivel" }));
    }
    bannerOwnerId = business.owner_id;

    let image: File | null = null;
    try {
      image = imageFromForm(formData, "banner_image");
    } catch (error) {
      console.error("Imagem de banner de cortesia inválida", error);
      redirect(adminUrl({ erro: "banner_imagem_invalida" }));
    }

    if (!image) {
      redirect(adminUrl({ erro: "banner_imagem_obrigatoria" }));
    }

    try {
      bannerImagePath = await uploadMerchantImage(
        supabase,
        bannerOwnerId,
        image,
        "banner",
      );
    } catch (error) {
      console.error("Falha ao enviar banner de cortesia", error);
      redirect(adminUrl({ erro: "banner_imagem_invalida" }));
    }
  }

  const { error } = isBanner
    ? await supabase.rpc("admin_create_complimentary_banner_campaign", {
        p_business_id: businessId,
        p_package_code: packageCode,
        p_creative_image_path: bannerImagePath!,
        p_creative_title: bannerTitle!,
        p_creative_description: bannerDescription!,
        p_requested_start: startsAt,
        p_admin_note: note || undefined,
      })
    : await supabase.rpc("admin_create_highlight_campaign", {
        p_business_id: businessId,
        p_package_code: packageCode,
        p_requested_start: startsAt,
        p_admin_note: note || undefined,
      });

  if (error) {
    if (bannerOwnerId && bannerImagePath) {
      await removeMerchantImages(supabase, bannerOwnerId, [bannerImagePath]);
    }
    const mapped = error.message.includes("HIGHLIGHT_NO_AVAILABILITY")
      ? "sem_vagas"
      : error.message.includes("HIGHLIGHT_ALREADY_OPEN")
        ? "campanha_aberta"
        : error.message.includes("HIGHLIGHT_BUSINESS_INELIGIBLE")
          ? "loja_inelegivel"
          : isBanner
            ? "cortesia_banner"
            : "cortesia";
    redirect(adminUrl({ erro: mapped }));
  }

  revalidatePath("/");
  revalidatePath("/buscar");
  revalidatePath("/painel/destaques");
  revalidatePath("/admin/destaques");
  redirect(adminUrl({ sucesso: isBanner ? "cortesia_banner" : "cortesia" }));
}

export async function manageHighlightCampaignAction(formData: FormData) {
  const { supabase } = await requireAdmin("/admin/destaques");
  const campaignId = Number(formData.get("campaign_id"));
  const intent = String(formData.get("intent") ?? "");
  const bonusDays = intent === "bonus" ? Number(formData.get("bonus_days")) : 0;
  if (
    !Number.isSafeInteger(campaignId) ||
    campaignId <= 0 ||
    !/^(pause|resume|cancel|bonus)$/.test(intent) ||
    (intent === "bonus" &&
      (!Number.isSafeInteger(bonusDays) || bonusDays < 1 || bonusDays > 90))
  ) {
    redirect(adminUrl({ erro: "acao_invalida" }));
  }

  const { data, error } = await supabase.rpc("admin_manage_highlight_campaign", {
    p_campaign_id: campaignId,
    p_action: intent,
    p_bonus_days: bonusDays,
  });
  if (error || data !== true) {
    const mapped = error?.message.includes("HIGHLIGHT_NO_AVAILABILITY")
      ? "sem_vagas"
      : error?.message.includes("HIGHLIGHT_BUSINESS_INELIGIBLE")
        ? "loja_inelegivel"
        : "acao_campanha";
    redirect(adminUrl({ erro: mapped }));
  }

  revalidatePath("/");
  revalidatePath("/buscar");
  revalidatePath("/painel/destaques");
  revalidatePath("/admin/destaques");
  redirect(adminUrl({ sucesso: intent }));
}

export async function reviewBannerCampaignAction(formData: FormData) {
  const { supabase } = await requireAdmin("/admin/destaques");
  const campaignId = Number(formData.get("campaign_id"));
  const decision = String(formData.get("decision") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (
    !Number.isSafeInteger(campaignId) || campaignId <= 0 ||
    !/^(approve|reject)$/.test(decision) ||
    (decision === "reject" && reason.length < 3)
  ) {
    redirect(adminUrl({ erro: "revisao_banner_invalida" }));
  }
  const { data, error } = await supabase.rpc("admin_review_banner_campaign", {
    p_campaign_id: campaignId,
    p_decision: decision,
    p_reason: reason || undefined,
  });
  if (error || data !== true) {
    const mapped = error?.message.includes("HIGHLIGHT_NO_AVAILABILITY")
      ? "sem_vagas"
      : "revisao_banner";
    redirect(adminUrl({ erro: mapped }));
  }
  revalidatePath("/");
  revalidatePath("/painel/destaques");
  revalidatePath("/admin/destaques");
  redirect(adminUrl({ sucesso: decision === "approve" ? "banner_aprovado" : "banner_rejeitado" }));
}
