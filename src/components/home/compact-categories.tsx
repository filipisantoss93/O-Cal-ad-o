import Link from "next/link";
import { ChevronRightIcon, StoreIcon } from "@/components/icons";
import type { Category } from "@/types/catalog";

type CompactCategoriesProps = {
  categories: Category[];
  selectedSlug?: string;
  query?: string;
  showAllOption?: boolean;
  showViewAll?: boolean;
};

function categoryHref(slug: string | undefined, query: string | undefined) {
  if (slug === "eletropostos") return "/eletropostos";
  const params = new URLSearchParams();
  if (slug) params.set("categoria", slug);
  if (query?.trim()) params.set("q", query.trim());
  const serialized = params.toString();
  return serialized ? `/buscar?${serialized}` : "/buscar";
}

export function CompactCategories({
  categories,
  selectedSlug,
  query,
  showAllOption = false,
  showViewAll = true,
}: CompactCategoriesProps) {
  const cardClass =
    "group flex min-w-[9.25rem] snap-start flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-ink/15 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:min-w-0 sm:px-2.5";

  return (
    <nav aria-label="Categorias principais" className="min-w-0">
      <div className="-mx-4 flex snap-x snap-mandatory gap-2.5 overscroll-x-none overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-8">
        {showAllOption ? (
          <Link
            href={categoryHref(undefined, query)}
            aria-current={!selectedSlug ? "page" : undefined}
            className={`${cardClass} ${
              !selectedSlug
                ? "border-brand/45 bg-brand/5 ring-2 ring-brand/10"
                : "border-line bg-surface"
            }`}
          >
            <span
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-white"
              aria-hidden="true"
            >
              <StoreIcon className="size-4" />
            </span>
            <span className="flex min-h-[2.3em] w-full items-center justify-center whitespace-normal break-words text-xs font-extrabold leading-[1.15] text-ink">
              Todas
            </span>
          </Link>
        ) : null}

        {categories.map((category) => {
          const selected = selectedSlug === category.slug;
          return (
            <Link
              key={category.slug}
              href={categoryHref(category.slug, query)}
              aria-current={selected ? "page" : undefined}
              className={`${cardClass} ${
                selected
                  ? "border-brand/45 bg-brand/5 ring-2 ring-brand/10"
                  : "border-line bg-surface"
              }`}
            >
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-xl text-lg ${category.accent}`}
                aria-hidden="true"
              >
                {category.icon}
              </span>
              <span className="flex min-h-[2.3em] w-full items-center justify-center whitespace-normal break-words text-xs font-extrabold leading-[1.15] text-ink">
                {category.name}
              </span>
            </Link>
          );
        })}

        {showViewAll ? (
          <Link
            href={categoryHref(undefined, query)}
            className="group flex min-w-[9.25rem] snap-start flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink/20 bg-canvas px-3 py-3 text-center text-xs font-black text-ink transition hover:border-brand/50 hover:bg-brand/5 hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:min-w-0 sm:px-2.5"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-ink text-white">
              <ChevronRightIcon className="size-4" />
            </span>
            <span className="flex min-h-[2.3em] items-center justify-center leading-[1.15]">
              Ver todas
            </span>
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
