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
      className={`flex w-full items-center rounded-xl border border-ink/10 bg-surface p-1 shadow-[0_14px_36px_rgba(31,45,42,0.10)] transition focus-within:border-brand/60 focus-within:ring-4 focus-within:ring-brand/10 sm:rounded-2xl sm:p-1.5 sm:shadow-[0_18px_50px_rgba(31,45,42,0.12)] ${
        compact ? "max-w-3xl" : "max-w-2xl"
      }`}
      role="search"
    >
      <SearchIcon className="ml-2.5 size-4.5 shrink-0 text-muted sm:ml-3 sm:size-5" />
      <label className="sr-only" htmlFor={compact ? "catalog-search" : "home-search"}>
        Buscar produtos, serviços ou lojas
      </label>
      <input
        id={compact ? "catalog-search" : "home-search"}
        name="q"
        type="search"
        defaultValue={initialQuery}
        placeholder="O que você procura hoje?"
        className="min-w-0 flex-1 bg-transparent px-2.5 py-2.5 text-sm font-medium text-ink outline-none placeholder:text-muted/80 sm:px-3 sm:py-3 sm:text-base"
      />
      {category && <input name="categoria" type="hidden" value={category} />}
      <button
        type="submit"
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-brand px-3.5 text-sm font-black text-white transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:px-6"
      >
        Buscar
      </button>
    </form>
  );
}
