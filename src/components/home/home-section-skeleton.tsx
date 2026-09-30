import { HomeFeedSection } from "@/components/home/home-feed-section";

type HomeSectionSkeletonProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  tone?: "canvas" | "surface";
  count?: number;
  gridClassName?: string;
  variant?: "card" | "compact";
};

export function HomeSectionSkeleton({
  eyebrow,
  title,
  description,
  tone = "surface",
  variant = "card",
  count = 4,
  gridClassName = "grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4",
}: HomeSectionSkeletonProps) {
  const height = variant === "compact" ? "h-52 sm:h-44" : "h-80";

  return (
    <HomeFeedSection
      eyebrow={eyebrow}
      title={title}
      description={description}
      tone={tone}
    >
      <div
        className={`grid ${gridClassName}`}
        aria-hidden="true"
      >
        {Array.from({ length: count }, (_, item) => (
          <div
            key={item}
            className={`${height} min-w-0 animate-pulse rounded-2xl border border-line/70 bg-canvas`}
          />
        ))}
      </div>
    </HomeFeedSection>
  );
}
