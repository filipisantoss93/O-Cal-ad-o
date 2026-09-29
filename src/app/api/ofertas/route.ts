import { type NextRequest, NextResponse } from "next/server";
import { listCityPromotions } from "@/lib/public-promotions";

type OffersRequest = {
  cityId?: unknown;
};

export async function POST(request: NextRequest) {
  let body: OffersRequest;
  try {
    body = (await request.json()) as OffersRequest;
  } catch {
    return NextResponse.json({ error: "Cidade inválida." }, { status: 400 });
  }

  const cityId = Number(body.cityId);
  if (!Number.isSafeInteger(cityId) || cityId <= 0) {
    return NextResponse.json({ error: "Cidade inválida." }, { status: 400 });
  }

  try {
    const result = await listCityPromotions(cityId, 1, 10);
    return NextResponse.json(
      { promotions: result.promotions },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error(
      "[api/ofertas] query failed",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "Não foi possível consultar as ofertas." },
      { status: 500 },
    );
  }
}
