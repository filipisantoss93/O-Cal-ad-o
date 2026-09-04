-- Schema inicial do MVP O Calçadão.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cities (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  state text not null check (state ~ '^[A-Z]{2}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index cities_name_state_unique_idx
on public.cities (lower(name), state);

create table public.categories (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  icon text not null check (char_length(icon) between 1 and 12),
  display_order integer not null default 0 check (display_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.businesses (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  city_id bigint not null references public.cities (id) on delete restrict,
  category_id bigint not null references public.categories (id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text check (description is null or char_length(description) <= 1200),
  whatsapp_e164 text check (
    whatsapp_e164 is null or whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'
  ),
  address text not null check (char_length(btrim(address)) between 3 and 240),
  neighborhood text not null check (char_length(btrim(neighborhood)) between 2 and 120),
  logo_path text,
  cover_path text,
  business_hours jsonb not null default '{}'::jsonb
    check (jsonb_typeof(business_hours) = 'object'),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'suspended')),
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, slug)
);

create table public.products (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  description text check (description is null or char_length(description) <= 1200),
  price numeric(12, 2) not null check (price >= 0),
  promotional_price numeric(12, 2) check (
    promotional_price is null
    or (promotional_price >= 0 and promotional_price <= price)
  ),
  image_path text,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.promotions (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text check (description is null or char_length(description) <= 1200),
  badge text check (badge is null or char_length(badge) <= 32),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger businesses_set_updated_at
before update on public.businesses
for each row execute function private.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function private.set_updated_at();

create trigger promotions_set_updated_at
before update on public.promotions
for each row execute function private.set_updated_at();

create index businesses_owner_id_idx on public.businesses (owner_id);
create index businesses_city_id_idx on public.businesses (city_id);
create index businesses_category_id_idx on public.businesses (category_id);
create index businesses_city_status_created_idx
on public.businesses (city_id, status, created_at desc);
create index businesses_featured_published_idx
on public.businesses (city_id, is_featured, created_at desc)
where status = 'published';

create index products_business_id_idx on public.products (business_id);
create index products_business_active_created_idx
on public.products (business_id, is_active, created_at desc);
create index products_featured_active_idx
on public.products (business_id, is_featured, created_at desc)
where is_active = true;

create index promotions_business_id_idx on public.promotions (business_id);
create index promotions_active_period_idx
on public.promotions (is_active, starts_at, ends_at);

alter table public.profiles enable row level security;
alter table public.cities enable row level security;
alter table public.categories enable row level security;
alter table public.businesses enable row level security;
alter table public.products enable row level security;
alter table public.promotions enable row level security;

create policy profiles_read_own
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_insert_own
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

create policy profiles_update_own
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy cities_public_read
on public.cities for select
to anon, authenticated
using (is_active = true);

create policy categories_public_read
on public.categories for select
to anon, authenticated
using (is_active = true);

create policy businesses_public_read
on public.businesses for select
to anon, authenticated
using (status = 'published');

create policy businesses_owner_read
on public.businesses for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy businesses_owner_insert
on public.businesses for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy businesses_owner_update
on public.businesses for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy businesses_owner_delete
on public.businesses for delete
to authenticated
using ((select auth.uid()) = owner_id);

create policy products_public_read
on public.products for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.businesses
    where businesses.id = products.business_id
      and businesses.status = 'published'
  )
);

create policy products_owner_read
on public.products for select
to authenticated
using (
  exists (
    select 1
    from public.businesses
    where businesses.id = products.business_id
      and businesses.owner_id = (select auth.uid())
  )
);

create policy products_owner_insert
on public.products for insert
to authenticated
with check (
  exists (
    select 1
    from public.businesses
    where businesses.id = products.business_id
      and businesses.owner_id = (select auth.uid())
  )
);

create policy products_owner_update
on public.products for update
to authenticated
using (
  exists (
    select 1
    from public.businesses
    where businesses.id = products.business_id
      and businesses.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.businesses
    where businesses.id = products.business_id
      and businesses.owner_id = (select auth.uid())
  )
);

create policy products_owner_delete
on public.products for delete
to authenticated
using (
  exists (
    select 1
    from public.businesses
    where businesses.id = products.business_id
      and businesses.owner_id = (select auth.uid())
  )
);

create policy promotions_public_read
on public.promotions for select
to anon, authenticated
using (
  is_active = true
  and now() between starts_at and ends_at
  and exists (
    select 1
    from public.businesses
    where businesses.id = promotions.business_id
      and businesses.status = 'published'
  )
);

create policy promotions_owner_read
on public.promotions for select
to authenticated
using (
  exists (
    select 1
    from public.businesses
    where businesses.id = promotions.business_id
      and businesses.owner_id = (select auth.uid())
  )
);

create policy promotions_owner_insert
on public.promotions for insert
to authenticated
with check (
  exists (
    select 1
    from public.businesses
    where businesses.id = promotions.business_id
      and businesses.owner_id = (select auth.uid())
  )
);

create policy promotions_owner_update
on public.promotions for update
to authenticated
using (
  exists (
    select 1
    from public.businesses
    where businesses.id = promotions.business_id
      and businesses.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.businesses
    where businesses.id = promotions.business_id
      and businesses.owner_id = (select auth.uid())
  )
);

create policy promotions_owner_delete
on public.promotions for delete
to authenticated
using (
  exists (
    select 1
    from public.businesses
    where businesses.id = promotions.business_id
      and businesses.owner_id = (select auth.uid())
  )
);

revoke all on public.profiles from anon, authenticated;
revoke all on public.cities from anon, authenticated;
revoke all on public.categories from anon, authenticated;
revoke all on public.businesses from anon, authenticated;
revoke all on public.products from anon, authenticated;
revoke all on public.promotions from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.cities, public.categories to anon, authenticated;
grant select on public.businesses, public.products, public.promotions to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant insert, update, delete on public.businesses, public.products, public.promotions to authenticated;
grant usage, select on all sequences in schema public to authenticated;

insert into public.categories (slug, name, icon, display_order)
values
  ('alimentacao', 'Alimentação', '🍴', 10),
  ('moda', 'Moda', '👕', 20),
  ('beleza', 'Beleza', '✨', 30),
  ('casa', 'Casa', '🏠', 40),
  ('servicos', 'Serviços', '🔧', 50),
  ('saude', 'Saúde', '💚', 60)
on conflict (slug) do update
set
  name = excluded.name,
  icon = excluded.icon,
  display_order = excluded.display_order,
  is_active = true;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'business-media',
  'business-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy business_media_public_read
on storage.objects for select
to anon, authenticated
using (bucket_id = 'business-media');

create policy business_media_owner_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'business-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy business_media_owner_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'business-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'business-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy business_media_owner_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'business-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
