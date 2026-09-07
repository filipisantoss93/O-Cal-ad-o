import { type NextRequest, NextResponse } from "next/server";
import {
  getPublicFeaturedBusinesses,
  getPublicFeaturedCampaignCandidates,
} from "@/lib/highlights/public";
import { createClient } from "@/lib/supabase/server";

type HighlightsRequest = {
  cityId?: unknown;
  categorySlug?: unknown;
};

const visitorCookie = "ocalcadao_visitor";

function rotationScore(seed: string) {
  let score = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    score ^= seed.charCodeAt(index);
    score = Math.imul(score, 16777619);
  }
  return score >>> 0;
}

export async function POST(request: NextRequest) {
  let body: HighlightsRequest;
  try {
    body = (await request.json()) as HighlightsRequest;
  } catch {
    return NextResponse.json({ error: "Cidade inválida." }, { status: 400 });
  }

  const cityId = Number(body.cityId);
  const categorySlug = body.categorySlug === undefined
    ? undefined
    : String(body.categorySlug).trim();
  if (!Number.isSafeInteger(cityId) || cityId <= 0) {
    return NextResponse.json({ error: "Cidade inválida." }, { status: 400 });
  }
  if (
    categorySlug !== undefined &&
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(categorySlug)
  ) {
    return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
  }

  const supabase = await createClient();
  let categoryId: number | undefined;
  if (categorySlug) {
    const { data: category, error } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .eq("is_active", true)
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        { error: "Não foi possível consultar a categoria." },
        { status: 500 },
      );
    }
    if (!category) {
      return NextResponse.json({ businesses: [] });
    }
    categoryId = category.id;
  }

  const existingVisitor = request.cookies.get(visitorCookie)?.value;
  const visitorId =
    existingVisitor && /^[a-f0-9-]{36}$/.test(existingVisitor)
      ? existingVisitor
      : crypto.randomUUID();
  const daySeed = new Date().toISOString().slice(0, 10);

  const candidates = await getPublicFeaturedCampaignCandidates(
    supabase,
    cityId,
    categoryId,
  );
  const orderedCandidates = candidates
    .map((candidate) => ({
      ...candidate,
      score: rotationScore(`${visitorId}:${daySeed}:${candidate.campaignId}`),
    }))
    .sort((first, second) => first.score - second.score);

  const selectedCampaignIds: number[] = [];
  const selectedBusinesses = new Set<number>();
  for (const candidate of orderedCandidates) {
    if (selectedBusinesses.has(candidate.businessId)) continue;
    selectedBusinesses.add(candidate.businessId);
    selectedCampaignIds.push(candidate.campaignId);
    if (selectedCampaignIds.length === 4) break;
  }

  const businesses = await getPublicFeaturedBusinesses(
    supabase,
    selectedCampaignIds,
  );

  const response = NextResponse.json(
    { businesses },
    { headers: { "Cache-Control": "private, no-store" } },
  );
  if (!existingVisitor) {
    response.cookies.set(visitorCookie, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}
