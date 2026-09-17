import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import type { Category } from "@/types/catalog";

type CompactCategoriesProps = {
  categories: Category[];
};

export function CompactCategories({ categories }: CompactCategoriesProps) {
  return (
    <nav aria-label="Categorias principais" className="min-w-0">
      <div className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-8">
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/buscar?categoria=${category.slug}`}
            className="group flex min-w-[7.5rem] snap-start items-center gap-2.5 rounded-2xl border border-line bg-surface px-3 py-2.5 shadow-sm transition hover:-translate-y-0.5 hover:border-ink/15 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:min-w-0 sm:flex-col sm:justify-center sm:gap-2 sm:px-2.5 sm:py-3 sm:text-center"
          >
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-xl text-base sm:size-10 sm:text-lg ${category.accent}`}
              aria-hidden="true"
            >
              {category.icon}
            </span>
            <span className="min-w-0 truncate text-xs font-extrabold text-ink sm:w-full">
              {category.name}
            </span>
          </Link>
        ))}

        <Link
          href="/buscar"
          className="group flex min-w-[7.5rem] snap-start items-center justify-center gap-2 rounded-2xl border border-dashed border-ink/20 bg-canvas px-3 py-2.5 text-xs font-black text-ink transition hover:border-brand/50 hover:bg-brand/5 hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:min-w-0 sm:flex-col sm:py-3"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-ink text-white sm:size-10">
            <ChevronRightIcon className="size-4" />
          </span>
          <span>Ver todas</span>
        </Link>
      </div>
    </nav>
  );
}
