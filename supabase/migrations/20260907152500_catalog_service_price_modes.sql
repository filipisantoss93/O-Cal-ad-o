alter table public.catalog_items
  add column if not exists price_mode text not null default 'fixed';

alter table public.catalog_items
  drop constraint if exists catalog_items_price_mode_check;

alter table public.catalog_items
  add constraint catalog_items_price_mode_check
  check (price_mode in ('fixed', 'from', 'consult'));

alter table public.catalog_items
  drop constraint if exists catalog_items_price_semantics_check;

alter table public.catalog_items
  add constraint catalog_items_price_semantics_check
  check (
    (kind = 'product' and price_mode = 'fixed' and price is not null)
    or
    (kind = 'service' and (
      (price_mode in ('fixed', 'from') and price is not null)
      or
      (price_mode = 'consult' and price is null and promotional_price is null)
    ))
  );

alter table public.catalog_items
  drop constraint if exists catalog_items_promotional_price_check;

alter table public.catalog_items
  add constraint catalog_items_promotional_price_check
  check (
    promotional_price is null
    or (price is not null and promotional_price >= 0 and promotional_price <= price)
  );

alter table public.catalog_items
  drop constraint if exists catalog_items_nonnegative_price_check;

alter table public.catalog_items
  add constraint catalog_items_nonnegative_price_check
  check (price is null or price >= 0);

comment on column public.catalog_items.price_mode is
  'fixed = preço fixo, from = a partir de, consult = valor sob consulta';
