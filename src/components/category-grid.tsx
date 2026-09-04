import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import type { Category } from "@/types/catalog";

type CategoryGridProps = {
  categories: Category[];
};

export function CategoryGrid({ categories }: CategoryGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {categories.map((category) => (
        <Link
          key={category.slug}
          href={`/buscar?categoria=${category.slug}`}
          className="group flex min-h-38 flex-col rounded-2xl border border-line bg-surface p-4 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-ink/15 hover:shadow-[0_16px_30px_rgba(29,43,40,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <span
            className={`grid size-11 place-items-center rounded-xl text-xl ${category.accent}`}
            aria-hidden="true"
          >
            {category.icon}
          </span>
          <span className="mt-4 font-extrabold text-ink">{category.name}</span>
          <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-bold text-muted transition-colors group-hover:text-brand-dark">
            Explorar
            <ChevronRightIcon className="size-3.5" />
          </span>
        </Link>
      ))}
    </div>
  );
}
