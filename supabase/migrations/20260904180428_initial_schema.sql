-- Fundação do MVP O Calçadão.
-- Mantém o lançamento simples, mas prepara a plataforma para múltiplas cidades.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (
    full_name is null or char_length(btrim(full_name)) between 2 and 120
  ),
  phone_e164 text check (
    phone_e164 is null or phone_e164 ~ '^\\+[1-9][0-9]{7,14}$'
  ),
  role text not null default 'merchant'
    check (role in ('merchant', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cities (
  id bigint generated always as identity primary key,
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null
    check (char_length(btrim(name)) between 2 and 120),
  state_code text not null
    check (state_code ~ '^[A-Z]{2}$'),
  ibge_code integer unique
    check (ibge_code is null or ibge_code between 1000000 and 9999999),
  timezone text not null default 'America/Sao_Paulo'
    check (char_length(btrim(timezone)) between 3 and 64),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index cities_name_state_unique_idx
on public.cities (lower(name), state_code);

create table public.categories (
  id bigint generated always as identity primary key,
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null
    check (char_length(btrim(name)) between 2 and 80),
  description text
    check (description is null or char_length(description) <= 240),
  icon text not null
    check (char_length(icon) between 1 and 16),
  display_order integer not null default 0
    check (display_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  city_id bigint not null references public.cities (id) on delete restrict,
  category_id bigint not null references public.categories (id) on delete restrict,
  slug text not null
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null
    check (char_length(btrim(name)) between 2 and 120),
  description text
    check (description is null or char_length(description) <= 2000),
  whatsapp_e164 text not null
    check (whatsapp_e164 ~ '^\\+[1-9][0-9]{7,14}$'),
  public_email text
    check (public_email is null or char_length(public_email) <= 254),
  website_url text
    check (website_url is null or char_length(website_url) <= 500),
  street text not null
    check (char_length(btrim(street)) between 2 and 160),
  address_number text not null
    check (char_length(btrim(address_number)) between 1 and 20),
  complement text
    check (complement is null or char_length(complement) <= 120),
  neighborhood text not null
    check (char_length(btrim(neighborhood)) between 2 and 120),
  postal_code text
    check (postal_code is null or postal_code ~ '^[0-9]{5}-?[0-9]{3}$'),
  latitude numeric(9, 6)
    check (latitude is null or latitude between -90 and 90),
  longitude numeric(9, 6)
    check (longitude is null or longitude between -180 and 180),
  logo_path text,
  cover_path text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended')),
  moderation_note text
    check (moderation_note is null or char_length(moderation_note) <= 1000),
  moderated_at timestamptz,
  moderated_by uuid references auth.users (id) on delete set null,
  plan text not null default 'free'
    check (plan in ('free', 'featured')),
  featured_until timestamptz,
  is_active boolean not null default true,
  search_document tsvector generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(description, '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(neighborhood, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, slug)
);

create table public.business_hours (
  id bigint generated always as identity primary key,
  business_id bigint not null
    references public.businesses (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  display_order smallint not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, weekday, display_order),
  check (
    (is_closed and opens_at is null and closes_at is null)
    or
    (not is_closed and opens_at is not null and closes_at is not null and opens_at <> closes_at)
  )
);

create table public.business_photos (
  id bigint generated always as identity primary key,
  business_id bigint not null
    references public.businesses (id) on delete cascade,
  path text not null check (char_length(btrim(path)) between 3 and 500),
  alt_text text check (alt_text is null or char_length(alt_text) <= 160),
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  unique (business_id, path)
);

create table public.catalog_items (
  id bigint generated always as identity primary key,
  business_id bigint not null
    references public.businesses (id) on delete cascade,
  kind text not null default 'product'
    check (kind in ('product', 'service')),
  name text not null
    check (char_length(btrim(name)) between 2 and 160),
  description text
    check (description is null or char_length(description) <= 1200),
  price numeric(12, 2) check (price is null or price >= 0),
  promotional_price numeric(12, 2) check (
    promotional_price is null
    or (price is not null and promotional_price >= 0 and promotional_price <= price)
  ),
  image_path text,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  search_document tsvector generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(description, '')), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.promotions (
  id bigint generated always as identity primary key,
  business_id bigint not null
    references public.businesses (id) on delete cascade,
  title text not null
    check (char_length(btrim(title)) between 2 and 160),
  description text
    check (description is null or char_length(description) <= 1200),
  original_price numeric(12, 2)
    check (original_price is null or original_price >= 0),
  offer_price numeric(12, 2) not null
    check (offer_price >= 0),
  image_path text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (original_price is null or offer_price <= original_price)
);

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

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  supplied_name text;
begin
  supplied_name := nullif(
    btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')),
    ''
  );

  insert into public.profiles (id, full_name)
  values (new.id, supplied_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and role = 'admin'
    );
$$;

create or replace function private.guard_profile_role()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
    and current_user::text not in ('postgres', 'service_role', 'supabase_admin')
    and not private.is_admin()
  then
    raise exception using
      errcode = '42501',
      message = 'Somente administradores podem alterar permissões.';
  end if;

  return new;
end;
$$;

create or replace function private.guard_business_moderation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  privileged_actor boolean;
  moderated_content_changed boolean;
begin
  privileged_actor :=
    current_user::text in ('postgres', 'service_role', 'supabase_admin')
    or private.is_admin();

  if privileged_actor then
    if new.status is distinct from old.status then
      if new.status = 'pending' then
        new.moderated_at := null;
        new.moderated_by := null;
      else
        new.moderated_at := coalesce(new.moderated_at, now());
        new.moderated_by := coalesce(new.moderated_by, (select auth.uid()));
      end if;
    end if;

    return new;
  end if;

  if new.owner_id is distinct from old.owner_id
    or new.status is distinct from old.status
    or new.plan is distinct from old.plan
    or new.featured_until is distinct from old.featured_until
    or new.moderation_note is distinct from old.moderation_note
    or new.moderated_at is distinct from old.moderated_at
    or new.moderated_by is distinct from old.moderated_by
  then
    raise exception using
      errcode = '42501',
      message = 'Campos de moderação e plano são exclusivos da administração.';
  end if;

  moderated_content_changed :=
    new.city_id is distinct from old.city_id
    or new.category_id is distinct from old.category_id
    or new.slug is distinct from old.slug
    or new.name is distinct from old.name
    or new.description is distinct from old.description
    or new.whatsapp_e164 is distinct from old.whatsapp_e164
    or new.public_email is distinct from old.public_email
    or new.website_url is distinct from old.website_url
    or new.street is distinct from old.street
    or new.address_number is distinct from old.address_number
    or new.complement is distinct from old.complement
    or new.neighborhood is distinct from old.neighborhood
    or new.postal_code is distinct from old.postal_code
    or new.latitude is distinct from old.latitude
    or new.longitude is distinct from old.longitude
    or new.logo_path is distinct from old.logo_path
    or new.cover_path is distinct from old.cover_path;

  if moderated_content_changed and old.status in ('approved', 'rejected') then
    new.status := 'pending';
    new.moderation_note := null;
    new.moderated_at := null;
    new.moderated_by := null;
  end if;

  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.is_admin() from public, anon, authenticated;
revoke all on function private.guard_profile_role() from public, anon, authenticated;
revoke all on function private.guard_business_moderation() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create trigger profiles_guard_role
before update on public.profiles
for each row execute function private.guard_profile_role();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger cities_set_updated_at
before update on public.cities
for each row execute function private.set_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function private.set_updated_at();

create trigger businesses_guard_moderation
before update on public.businesses
for each row execute function private.guard_business_moderation();

create trigger businesses_set_updated_at
before update on public.businesses
for each row execute function private.set_updated_at();

create trigger business_hours_set_updated_at
before update on public.business_hours
for each row execute function private.set_updated_at();

create trigger catalog_items_set_updated_at
before update on public.catalog_items
for each row execute function private.set_updated_at();

create trigger promotions_set_updated_at
before update on public.promotions
for each row execute function private.set_updated_at();

create index businesses_owner_id_idx on public.businesses (owner_id);
create index businesses_category_id_idx on public.businesses (category_id);
create index businesses_moderated_by_idx on public.businesses (moderated_by)
where moderated_by is not null;
create index businesses_public_feed_idx
on public.businesses (
  city_id,
  ((plan = 'featured')) desc,
  created_at desc
)
where status = 'approved' and is_active = true;
create index businesses_pending_idx
on public.businesses (created_at)
where status = 'pending';
create index businesses_search_document_idx
on public.businesses using gin (search_document);

create index business_photos_business_order_idx
on public.business_photos (business_id, display_order, created_at);
create index catalog_items_business_id_idx
on public.catalog_items (business_id);
create index catalog_items_active_idx
on public.catalog_items (business_id, is_featured, created_at desc)
where is_active = true;
create index catalog_items_search_document_idx
on public.catalog_items using gin (search_document);
create index promotions_business_id_idx
on public.promotions (business_id);
create index promotions_active_period_idx
on public.promotions (starts_at, ends_at)
where is_active = true;

alter table public.profiles enable row level security;
alter table public.cities enable row level security;
alter table public.categories enable row level security;
alter table public.businesses enable row level security;
alter table public.business_hours enable row level security;
alter table public.business_photos enable row level security;
alter table public.catalog_items enable row level security;
alter table public.promotions enable row level security;

create policy profiles_read_own
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_insert_own
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id and role = 'merchant');

create policy profiles_update_own
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy profiles_admin_read
on public.profiles for select
to authenticated
using ((select private.is_admin()));

create policy profiles_admin_update
on public.profiles for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy cities_public_read
on public.cities for select
to anon, authenticated
using (is_active = true);

create policy cities_admin_manage
on public.cities for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy categories_public_read
on public.categories for select
to anon, authenticated
using (is_active = true);

create policy categories_admin_manage
on public.categories for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy businesses_public_read
on public.businesses for select
to anon, authenticated
using (
  status = 'approved'
  and is_active = true
  and exists (
    select 1 from public.cities
    where cities.id = businesses.city_id and cities.is_active = true
  )
  and exists (
    select 1 from public.categories
    where categories.id = businesses.category_id and categories.is_active = true
  )
);

create policy businesses_owner_read
on public.businesses for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy businesses_owner_insert
on public.businesses for insert
to authenticated
with check (
  (select auth.uid()) = owner_id
  and status = 'pending'
  and plan = 'free'
  and featured_until is null
  and moderation_note is null
  and moderated_at is null
  and moderated_by is null
);

create policy businesses_owner_update
on public.businesses for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy businesses_owner_delete
on public.businesses for delete
to authenticated
using ((select auth.uid()) = owner_id);

create policy businesses_admin_manage
on public.businesses for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy business_hours_public_read
on public.business_hours for select
to anon, authenticated
using (
  exists (
    select 1 from public.businesses
    where businesses.id = business_hours.business_id
      and businesses.status = 'approved'
      and businesses.is_active = true
  )
);

create policy business_hours_owner_manage
on public.business_hours for all
to authenticated
using (
  exists (
    select 1 from public.businesses
    where businesses.id = business_hours.business_id
      and businesses.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.businesses
    where businesses.id = business_hours.business_id
      and businesses.owner_id = (select auth.uid())
  )
);

create policy business_hours_admin_manage
on public.business_hours for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy business_photos_public_read
on public.business_photos for select
to anon, authenticated
using (
  exists (
    select 1 from public.businesses
    where businesses.id = business_photos.business_id
      and businesses.status = 'approved'
      and businesses.is_active = true
  )
);

create policy business_photos_owner_manage
on public.business_photos for all
to authenticated
using (
  exists (
    select 1 from public.businesses
    where businesses.id = business_photos.business_id
      and businesses.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.businesses
    where businesses.id = business_photos.business_id
      and businesses.owner_id = (select auth.uid())
  )
);

create policy business_photos_admin_manage
on public.business_photos for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy catalog_items_public_read
on public.catalog_items for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1 from public.businesses
    where businesses.id = catalog_items.business_id
      and businesses.status = 'approved'
      and businesses.is_active = true
  )
);

create policy catalog_items_owner_manage
on public.catalog_items for all
to authenticated
using (
  exists (
    select 1 from public.businesses
    where businesses.id = catalog_items.business_id
      and businesses.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.businesses
    where businesses.id = catalog_items.business_id
      and businesses.owner_id = (select auth.uid())
  )
);

create policy catalog_items_admin_manage
on public.catalog_items for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy promotions_public_read
on public.promotions for select
to anon, authenticated
using (
  is_active = true
  and now() between starts_at and ends_at
  and exists (
    select 1 from public.businesses
    where businesses.id = promotions.business_id
      and businesses.status = 'approved'
      and businesses.is_active = true
  )
);

create policy promotions_owner_manage
on public.promotions for all
to authenticated
using (
  exists (
    select 1 from public.businesses
    where businesses.id = promotions.business_id
      and businesses.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.businesses
    where businesses.id = promotions.business_id
      and businesses.owner_id = (select auth.uid())
  )
);

create policy promotions_admin_manage
on public.promotions for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

revoke all on public.profiles from anon, authenticated;
revoke all on public.cities from anon, authenticated;
revoke all on public.categories from anon, authenticated;
revoke all on public.businesses from anon, authenticated;
revoke all on public.business_hours from anon, authenticated;
revoke all on public.business_photos from anon, authenticated;
revoke all on public.catalog_items from anon, authenticated;
revoke all on public.promotions from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.cities, public.categories to anon, authenticated;
grant select on public.businesses, public.business_hours, public.business_photos,
  public.catalog_items, public.promotions to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant insert, update, delete on public.cities, public.categories to authenticated;
grant insert, update, delete on public.businesses, public.business_hours,
  public.business_photos, public.catalog_items, public.promotions to authenticated;
grant usage, select on all sequences in schema public to authenticated;

insert into public.cities (slug, name, state_code, ibge_code, timezone)
values ('assis-sp', 'Assis', 'SP', 3504008, 'America/Sao_Paulo')
on conflict (slug) do update
set
  name = excluded.name,
  state_code = excluded.state_code,
  ibge_code = excluded.ibge_code,
  timezone = excluded.timezone,
  is_active = true;

insert into public.categories (slug, name, description, icon, display_order)
values
  ('alimentacao', 'Alimentação', 'Restaurantes, mercados, padarias e bebidas.', '🍴', 10),
  ('autopecas', 'Autopeças', 'Peças, acessórios e produtos automotivos.', '🚙', 20),
  ('oficinas-servicos-automotivos', 'Oficinas e Serviços Automotivos', 'Manutenção, reparos e cuidados para veículos.', '🔧', 30),
  ('vestuario', 'Vestuário', 'Roupas, calçados e acessórios.', '👕', 40),
  ('beleza', 'Beleza', 'Salões, estética e autocuidado.', '✨', 50),
  ('saude', 'Saúde', 'Clínicas, farmácias e bem-estar.', '🩺', 60),
  ('construcao', 'Construção', 'Materiais, ferramentas e profissionais da construção.', '🧱', 70),
  ('tecnologia', 'Tecnologia', 'Informática, celulares e assistência técnica.', '💻', 80),
  ('casa-decoracao', 'Casa e Decoração', 'Móveis, decoração e utilidades para o lar.', '🏠', 90),
  ('servicos', 'Serviços', 'Profissionais e soluções para o dia a dia.', '🛠️', 100)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
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
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
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
  and owner_id = (select auth.uid())::text
)
with check (
  bucket_id = 'business-media'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy business_media_owner_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'business-media'
  and owner_id = (select auth.uid())::text
);

create policy business_media_admin_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'business-media'
  and (select private.is_admin())
);

create policy business_media_admin_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'business-media'
  and (select private.is_admin())
)
with check (
  bucket_id = 'business-media'
  and (select private.is_admin())
);

create policy business_media_admin_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'business-media'
  and (select private.is_admin())
);

commit;
