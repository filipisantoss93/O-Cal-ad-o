import { SearchIcon } from "@/components/icons";

type SearchFormProps = {
  initialQuery?: string;
  category?: string;
  compact?: boolean;
};

export function SearchForm({
  initialQuery = "",
  category,
  compact = false,
}: SearchFormProps) {
  return (
    <form
      action="/buscar"
      className={`flex w-full items-center rounded-2xl border border-ink/10 bg-surface p-1.5 shadow-[0_18px_50px_rgba(31,45,42,0.12)] transition focus-within:border-brand/60 focus-within:ring-4 focus-within:ring-brand/10 ${
        compact ? "max-w-3xl" : "max-w-2xl"
      }`}
      role="search"
    >
      <SearchIcon className="ml-3 size-5 shrink-0 text-muted" />
      <label className="sr-only" htmlFor={compact ? "catalog-search" : "home-search"}>
        Buscar produtos, serviços ou lojas
      </label>
      <input
        id={compact ? "catalog-search" : "home-search"}
        name="q"
        type="search"
        defaultValue={initialQuery}
        placeholder="O que você procura hoje?"
        className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base font-medium text-ink outline-none placeholder:text-muted/80"
      />
      {category && <input name="categoria" type="hidden" value={category} />}
      <button
        type="submit"
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-brand px-4 text-sm font-black text-white transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:px-6"
      >
        Buscar
      </button>
    </form>
  );
}
