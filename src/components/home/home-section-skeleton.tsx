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
        className="-mx-4 flex gap-3 overflow-hidden px-4 sm:-mx-6 sm:gap-4 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:px-0"
        aria-hidden="true"
      >
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className={`${height} w-[72vw] max-w-[17.5rem] shrink-0 animate-pulse rounded-2xl border border-line/70 bg-canvas sm:w-[42vw] sm:max-w-[19rem] lg:w-auto lg:max-w-none`}
          />
        ))}
      </div>
    </HomeFeedSection>
  );
}
