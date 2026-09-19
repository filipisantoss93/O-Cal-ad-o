import { createPublicClient } from "@/lib/supabase/server";

type GoogleRatingsRequest = {
  businessIds?: unknown;
};

type GooglePlaceDetails = {
  rating?: unknown;
  userRatingCount?: unknown;
};

type RatingResult = {
  businessId: number;
  rating: number;
  reviewCount: number;
};

const maxBusinessesPerRequest = 24;
const googlePlacesEndpoint = "https://places.googleapis.com/v1/places";

function parseBusinessIds(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > maxBusinessesPerRequest) {
    return null;
  }
  const ids = value.map(Number);
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) return null;
  return [...new Set(ids)];
}

async function fetchGoogleRating(
  businessId: number,
  placeId: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<RatingResult | null> {
  try {
    const response = await fetch(`${googlePlacesEndpoint}/${encodeURIComponent(placeId)}`, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "rating,userRatingCount",
      },
      cache: "no-store",
      signal,
    });

    if (!response.ok) {
      console.error(`[google-ratings] place details failed for business ${businessId}: ${response.status}`);
      return null;
    }

    const payload = (await response.json()) as GooglePlaceDetails;
    const rating = Number(payload.rating);
    const reviewCount = Number(payload.userRatingCount);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) return null;
    if (!Number.isSafeInteger(reviewCount) || reviewCount <= 0) return null;

    return { businessId, rating, reviewCount };
  } catch (error) {
    if (!signal.aborted) {
      console.error(`[google-ratings] place details request failed for business ${businessId}`, error);
    }
    return null;
  }
}

export async function POST(request: Request) {
  let body: GoogleRatingsRequest;
  try {
    body = (await request.json()) as GoogleRatingsRequest;
  } catch {
    return Response.json({ error: "Lista de estabelecimentos inválida." }, { status: 400 });
  }

  const businessIds = parseBusinessIds(body.businessIds);
  if (!businessIds) {
    return Response.json({ error: "Lista de estabelecimentos inválida." }, { status: 400 });
  }

  // Google Place Details ratings use the Enterprise SKU. Keep public requests disabled
  // until billing limits and application-level rate controls are explicitly configured.
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (process.env.GOOGLE_RATINGS_ENABLED !== "true" || !apiKey) {
    return Response.json(
      { enabled: false, ratings: [] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, google_place_id")
    .in("id", businessIds)
    .eq("publication_status", "published")
    .eq("is_active", true)
    .eq("billing_suspended", false);

  if (error) {
    console.error("[google-ratings] business lookup failed", error.message);
    return Response.json({ error: "Não foi possível carregar as avaliações." }, { status: 500 });
  }

  const linked = (data ?? []).filter(
    (business): business is typeof business & { google_place_id: string } =>
      typeof business.google_place_id === "string" && business.google_place_id.length > 0,
  );

  const ratings: RatingResult[] = [];
  const concurrency = 4;
  for (let index = 0; index < linked.length; index += concurrency) {
    const batch = linked.slice(index, index + concurrency);
    const results = await Promise.all(
      batch.map((business) =>
        fetchGoogleRating(
          business.id,
          business.google_place_id,
          apiKey,
          request.signal,
        ),
      ),
    );
    ratings.push(...results.filter((result): result is RatingResult => result !== null));
  }

  return Response.json(
    { enabled: true, ratings },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
