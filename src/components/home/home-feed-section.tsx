import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";

type HomeFeedSectionProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  linkHref?: string;
  linkLabel?: string;
  tone?: "canvas" | "surface";
  children: ReactNode;
  compact?: boolean;
};

export function HomeFeedSection({
  id,
  eyebrow,
  title,
  description,
  linkHref,
  linkLabel,
  tone = "canvas",
  children,
  compact = false,
}: HomeFeedSectionProps) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 ${tone === "surface" ? "bg-surface" : "bg-canvas"} px-4 sm:px-6 lg:px-8 ${compact ? "py-5 sm:py-7" : "py-7 sm:py-10 lg:py-12"}`}
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[10px] font-black uppercase tracking-[0.13em] text-brand-dark sm:text-[11px]">
                {eyebrow}
              </p>
            ) : null}
            <h2 className={`${eyebrow ? "mt-1" : ""} text-xl font-black tracking-[-0.035em] text-ink sm:text-2xl lg:text-3xl`}>
              {title}
            </h2>
            {description ? (
              <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-muted sm:text-sm sm:leading-6">
                {description}
              </p>
            ) : null}
          </div>

          {linkHref && linkLabel ? (
            <Link
              href={linkHref}
              className="hidden shrink-0 items-center gap-1.5 rounded-lg text-sm font-black text-ink outline-none hover:text-brand-dark focus-visible:ring-2 focus-visible:ring-brand sm:inline-flex"
            >
              {linkLabel}
              <ArrowRightIcon className="size-4" />
            </Link>
          ) : null}
        </div>

        <div className="mt-4 sm:mt-5">{children}</div>

        {linkHref && linkLabel ? (
          <Link
            href={linkHref}
            className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-ink/10 px-3.5 text-xs font-black text-ink outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-brand sm:hidden"
          >
            {linkLabel}
            <ArrowRightIcon className="size-3.5" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
