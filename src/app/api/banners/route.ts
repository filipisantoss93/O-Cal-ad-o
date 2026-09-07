import { type NextRequest, NextResponse } from "next/server";
import { getPublicRegionalBanners } from "@/lib/highlights/public";
import { createClient } from "@/lib/supabase/server";

type BannerRequest = { cityId?: unknown };
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
  let body: BannerRequest;
  try {
    body = (await request.json()) as BannerRequest;
  } catch {
    return NextResponse.json({ error: "Cidade inválida." }, { status: 400 });
  }

  const cityId = Number(body.cityId);
  if (!Number.isSafeInteger(cityId) || cityId <= 0) {
    return NextResponse.json({ error: "Cidade inválida." }, { status: 400 });
  }

  const supabase = await createClient();
  const banners = await getPublicRegionalBanners(supabase, cityId);
  const existingVisitor = request.cookies.get(visitorCookie)?.value;
  const visitorId =
    existingVisitor && /^[a-f0-9-]{36}$/.test(existingVisitor)
      ? existingVisitor
      : crypto.randomUUID();
  const daySeed = new Date().toISOString().slice(0, 10);
  const rotated = banners
    .map((banner) => ({
      banner,
      score: rotationScore(`${visitorId}:${daySeed}:banner:${banner.campaignId}`),
    }))
    .sort((first, second) => first.score - second.score)
    .slice(0, 5)
    .map(({ banner }) => banner);

  const response = NextResponse.json(
    { banners: rotated },
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
