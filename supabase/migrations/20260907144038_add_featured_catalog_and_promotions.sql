alter table public.promotions
  add column if not exists is_featured boolean not null default false;

create unique index if not exists catalog_items_one_featured_per_business_uidx
  on public.catalog_items (business_id)
  where is_featured = true;

create unique index if not exists promotions_one_featured_per_business_uidx
  on public.promotions (business_id)
  where is_featured = true;
