import type { Business } from "@/types/catalog";

type GoogleRatingPayload = {
  ratings?: Array<{
    businessId: number;
    rating: number;
    reviewCount: number;
  }>;
};

export async function loadGoogleRatings<T extends Pick<Business, "id" | "rating" | "reviewCount">>(
  businesses: T[],
  signal?: AbortSignal,
): Promise<Array<T & { ratingSource?: "google" | null }>> {
  const businessIds = businesses
    .map((business) => Number(business.id))
    .filter((id) => Number.isSafeInteger(id) && id > 0)
    .slice(0, 24);

  if (businessIds.length === 0) return businesses;

  try {
    const response = await fetch("/api/google-ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessIds }),
      cache: "no-store",
      signal,
    });
    if (!response.ok) return businesses;

    const payload = (await response.json()) as GoogleRatingPayload;
    const ratingsByBusiness = new Map(
      (payload.ratings ?? []).map((item) => [item.businessId, item]),
    );

    return businesses.map((business) => {
      const googleRating = ratingsByBusiness.get(Number(business.id));
      return googleRating
        ? {
            ...business,
            rating: googleRating.rating,
            reviewCount: googleRating.reviewCount,
            ratingSource: "google" as const,
          }
        : business;
    });
  } catch (error) {
    if (!signal?.aborted) console.error("[google-ratings] client lookup failed", error);
    return businesses;
  }
}
