export type DistanceRatingCandidate = {
  slug: string;
  name: string;
  rating?: number | null;
  reviewCount?: number | null;
};

function effectiveRating(candidate: DistanceRatingCandidate) {
  const reviewCount = Number(candidate.reviewCount ?? 0);
  const rating = Number(candidate.rating ?? 0);

  if (!Number.isFinite(reviewCount) || reviewCount <= 0) return 0;
  return Number.isFinite(rating) ? rating : 0;
}

export function compareByDistanceRatingName<T extends DistanceRatingCandidate>(
  first: T,
  second: T,
  distances: ReadonlyMap<string, number | null | undefined>,
) {
  const firstDistance = distances.get(first.slug);
  const secondDistance = distances.get(second.slug);
  const firstHasDistance = typeof firstDistance === "number" && Number.isFinite(firstDistance);
  const secondHasDistance = typeof secondDistance === "number" && Number.isFinite(secondDistance);

  if (firstHasDistance && secondHasDistance && firstDistance !== secondDistance) {
    return firstDistance - secondDistance;
  }

  if (firstHasDistance !== secondHasDistance) {
    return firstHasDistance ? -1 : 1;
  }

  const ratingDifference = effectiveRating(second) - effectiveRating(first);
  if (ratingDifference !== 0) return ratingDifference;

  return first.name.localeCompare(second.name, "pt-BR", { sensitivity: "base" });
}
