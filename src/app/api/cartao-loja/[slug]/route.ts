import { ImageResponse } from "next/og";
import { BusinessShareCard } from "@/components/business-share-card";
import { getBusinessShareCardData } from "@/lib/share-card-data";

const size = { width: 1080, height: 1080 };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,100}$/.test(slug)) {
    return new Response("Vitrine não encontrada.", { status: 404 });
  }

  const business = await getBusinessShareCardData(slug);
  if (!business) {
    return new Response("Vitrine não encontrada.", { status: 404 });
  }

  return new ImageResponse(BusinessShareCard(business), {
    ...size,
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
    },
  });
}
