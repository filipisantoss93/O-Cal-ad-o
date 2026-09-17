import { type NextRequest, NextResponse } from "next/server";
import { getPublicFeaturedCampaignCandidates } from "@/lib/highlights/public";
import { searchPublicBusinesses } from "@/lib/public-search";
import { createClient } from "@/lib/supabase/server";
import type { Business } from "@/types/catalog";

type DiscoveryRequest = {
  cityId?: unknown;
};

const visitorCookie = "ocalcadao_visitor";
const discoveryLimit = 12;
const candidatePages = 3;

function rotationScore(seed: string) {
  let score = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    score ^= seed.charCodeAt(index);
    score = Math.imul(score, 16777619);
  }
  return score >>> 0;
}

function diversifyBusinesses(businesses: Business[], seed: string) {
  const ordered = [...businesses].sort(
    (first, second) =>
      rotationScore(`${seed}:${first.id}`) - rotationScore(`${seed}:${second.id}`),
  );
  const selected: Business[] = [];
  const selectedIds = new Set<string>();
  const categories = new Set<string>();

  for (const business of ordered) {
    if (categories.has(business.categorySlug)) continue;
    categories.add(business.categorySlug);
    selectedIds.add(business.id);
    selected.push(business);
    if (selected.length === discoveryLimit) return selected;
  }

  for (const business of ordered) {
    if (selectedIds.has(business.id)) continue;
    selectedIds.add(business.id);
    selected.push(business);
    if (selected.length === discoveryLimit) break;
  }

  return selected;
}

export async function POST(request: NextRequest) {
  let body: DiscoveryRequest;
  try {
    body = (await request.json()) as DiscoveryRequest;
  } catch {
    return NextResponse.json({ error: "Cidade inválida." }, { status: 400 });
  }

  const cityId = Number(body.cityId);
  if (!Number.isSafeInteger(cityId) || cityId <= 0) {
    return NextResponse.json({ error: "Cidade inválida." }, { status: 400 });
  }

  const existingVisitor = request.cookies.get(visitorCookie)?.value;
  const visitorId =
    existingVisitor && /^[a-f0-9-]{36}$/.test(existingVisitor)
      ? existingVisitor
      : crypto.randomUUID();
  const daySeed = new Date().toISOString().slice(0, 10);
  const seed = `${visitorId}:${daySeed}:${cityId}:organic`;

  const firstPage = await searchPublicBusinesses(undefined, undefined, cityId, 1);
  if (firstPage.totalPages === 0) {
    return NextResponse.json({ businesses: [] });
  }

  const startPage = (rotationScore(seed) % firstPage.totalPages) + 1;
  const pages = Array.from(
    { length: Math.min(candidatePages, firstPage.totalPages) },
    (_, index) => ((startPage - 1 + index) % firstPage.totalPages) + 1,
  );

  const pageResults = await Promise.all(
    pages.map((page) =>
      page === 1
        ? Promise.resolve(firstPage)
        : searchPublicBusinesses(undefined, undefined, cityId, page),
    ),
  );

  const supabase = await createClient();
  const paidCandidates = await getPublicFeaturedCampaignCandidates(supabase, cityId);
  const paidBusinessIds = new Set(
    paidCandidates.map((candidate) => String(candidate.businessId)),
  );

  const seen = new Set<string>();
  const candidates = pageResults
    .flatMap((result) => result.businesses)
    .filter((business) => {
      if (business.listingType !== "business") return false;
      if (paidBusinessIds.has(business.id)) return false;
      if (seen.has(business.id)) return false;
      seen.add(business.id);
      return true;
    });

  const businesses = diversifyBusinesses(candidates, seed);
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
