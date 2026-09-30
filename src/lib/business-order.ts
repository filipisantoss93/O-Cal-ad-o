export type DistanceRatingCandidate = {
  slug: string;
  name: string;
  rating?: number | null;
  reviewCount?: number | null;
};

export type CityFallbackCandidate = DistanceRatingCandidate & {
  categoryName: string;
  isFeatured?: boolean;
  logoUrl?: string | null;
};

const ratingPrior = 4;
const ratingPriorWeight = 5;

export function effectiveRating(candidate: DistanceRatingCandidate) {
  const reviewCount = Number(candidate.reviewCount ?? 0);
  const rating = Number(candidate.rating ?? 0);

  if (!Number.isFinite(reviewCount) || reviewCount <= 0) return 0;
  if (!Number.isFinite(rating) || rating <= 0) return 0;

  return (
    (reviewCount / (reviewCount + ratingPriorWeight)) * rating +
    (ratingPriorWeight / (reviewCount + ratingPriorWeight)) * ratingPrior
  );
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

/**
 * Sem coordenadas não existe uma distância honesta para ordenar. Nesse caso,
 * monta uma seleção útil: primeiro um bom representante de cada categoria e,
 * depois, completa as vagas pela relevância geral. Isso impede que os primeiros
 * nomes em ordem alfabética dominem a home.
 */
export function selectCityFallbackBusinesses<T extends CityFallbackCandidate>(
  candidates: readonly T[],
  limit: number,
) {
  const safeLimit = Math.max(0, Math.floor(limit));
  if (safeLimit === 0) return [];

  // A API já entrega os candidatos alternando categorias e considerando a
  // qualidade do cadastro. Preserve essa relevância como desempate para que
  // vários estabelecimentos sem avaliações/logotipo não voltem a ser
  // ordenados globalmente pelo nome no navegador.
  const sourcePosition = new Map(
    candidates.map((candidate, index) => [candidate.slug, index]),
  );

  const ranked = [...candidates].sort((first, second) => {
    const featuredDifference = Number(Boolean(second.isFeatured)) - Number(Boolean(first.isFeatured));
    if (featuredDifference !== 0) return featuredDifference;

    const ratingDifference = effectiveRating(second) - effectiveRating(first);
    if (ratingDifference !== 0) return ratingDifference;

    const logoDifference = Number(Boolean(second.logoUrl)) - Number(Boolean(first.logoUrl));
    if (logoDifference !== 0) return logoDifference;

    const reviewDifference = Number(second.reviewCount ?? 0) - Number(first.reviewCount ?? 0);
    if (reviewDifference !== 0) return reviewDifference;

    const sourceDifference =
      (sourcePosition.get(first.slug) ?? Number.MAX_SAFE_INTEGER) -
      (sourcePosition.get(second.slug) ?? Number.MAX_SAFE_INTEGER);
    if (sourceDifference !== 0) return sourceDifference;

    return first.name.localeCompare(second.name, "pt-BR", { sensitivity: "base" });
  });

  const selected: T[] = [];
  const selectedIds = new Set<string>();
  const usedCategories = new Set<string>();

  for (const candidate of ranked) {
    const category = candidate.categoryName.trim().toLocaleLowerCase("pt-BR");
    if (!category || usedCategories.has(category)) continue;
    selected.push(candidate);
    selectedIds.add(candidate.slug);
    usedCategories.add(category);
    if (selected.length === safeLimit) return selected;
  }

  for (const candidate of ranked) {
    if (selectedIds.has(candidate.slug)) continue;
    selected.push(candidate);
    if (selected.length === safeLimit) break;
  }

  return selected;
}
