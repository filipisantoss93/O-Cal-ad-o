import { HomeFeedSection } from "@/components/home/home-feed-section";

type HomeSectionSkeletonProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  tone?: "canvas" | "surface";
  variant?: "card" | "compact";
};

export function HomeSectionSkeleton({
  eyebrow,
  title,
  description,
  tone = "surface",
  variant = "card",
}: HomeSectionSkeletonProps) {
  const height = variant === "compact" ? "h-28" : "h-64";

  return (
    <HomeFeedSection
      eyebrow={eyebrow}
      title={title}
      description={description}
      tone={tone}
    >
      <div
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
        aria-hidden="true"
      >
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className={`${height} min-w-0 animate-pulse rounded-2xl border border-line/70 bg-canvas`}
          />
        ))}
      </div>
    </HomeFeedSection>
  );
}
