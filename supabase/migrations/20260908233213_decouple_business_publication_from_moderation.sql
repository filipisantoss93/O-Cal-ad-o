alter table public.businesses
  add column if not exists publication_status text not null default 'published';

alter table public.businesses
  drop constraint if exists businesses_publication_status_check;

alter table public.businesses
  add constraint businesses_publication_status_check
  check (publication_status in ('published', 'unpublished'));

comment on column public.businesses.publication_status is
  'Public visibility state, independent from moderation status.';

update public.businesses
set publication_status = case
  when status in ('rejected', 'suspended') then 'unpublished'
  else 'published'
end;

-- New stores are published immediately while entering moderation as pending.
drop policy if exists businesses_owner_insert on public.businesses;
create policy businesses_owner_insert
on public.businesses
for insert
to authenticated
with check (
  (select auth.uid()) = owner_id
  and status = 'pending'
  and publication_status = 'published'
  and plan = 'free'
  and featured_until is null
  and moderation_note is null
  and moderated_at is null
  and moderated_by is null
);

-- Public visibility no longer depends on moderation approval.
drop policy if exists businesses_public_read on public.businesses;
create policy businesses_public_read
on public.businesses
for select
to anon, authenticated
using (
  publication_status = 'published'
  and is_active = true
  and billing_suspended = false
  and exists (
    select 1 from public.cities
    where cities.id = businesses.city_id
      and cities.is_active = true
  )
  and exists (
    select 1 from public.categories
    where categories.id = businesses.category_id
      and categories.is_active = true
  )
);

drop policy if exists business_hours_public_read on public.business_hours;
create policy business_hours_public_read
on public.business_hours
for select
to anon, authenticated
using (
  exists (
    select 1 from public.businesses
    where businesses.id = business_hours.business_id
      and businesses.publication_status = 'published'
      and businesses.is_active = true
      and businesses.billing_suspended = false
  )
);

drop policy if exists business_photos_public_read on public.business_photos;
create policy business_photos_public_read
on public.business_photos
for select
to anon, authenticated
using (
  exists (
    select 1 from public.businesses
    where businesses.id = business_photos.business_id
      and businesses.publication_status = 'published'
      and businesses.is_active = true
      and businesses.billing_suspended = false
  )
);

drop policy if exists catalog_items_public_read on public.catalog_items;
create policy catalog_items_public_read
on public.catalog_items
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.businesses b
    where b.id = catalog_items.business_id
      and b.publication_status = 'published'
      and b.is_active = true
      and b.billing_suspended = false
      and exists (
        select 1 from public.cities c
        where c.id = b.city_id and c.is_active = true
      )
      and exists (
        select 1 from public.categories cat
        where cat.id = b.category_id and cat.is_active = true
      )
  )
);

drop policy if exists promotions_public_read on public.promotions;
create policy promotions_public_read
on public.promotions
for select
to anon, authenticated
using (
  is_active = true
  and billing_suspended = false
  and now() >= starts_at
  and now() <= ends_at
  and exists (
    select 1
    from public.businesses
    where businesses.id = promotions.business_id
      and businesses.publication_status = 'published'
      and businesses.is_active = true
      and businesses.billing_suspended = false
  )
);

create or replace function private.guard_business_moderation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  privileged_actor boolean;
  privileged_fields_changed boolean;
  moderated_content_changed boolean;
begin
  privileged_actor :=
    current_user::text in ('postgres', 'service_role', 'supabase_admin')
    or private.is_admin();

  privileged_fields_changed :=
    new.owner_id is distinct from old.owner_id
    or new.status is distinct from old.status
    or new.publication_status is distinct from old.publication_status
    or new.plan is distinct from old.plan
    or new.featured_until is distinct from old.featured_until
    or new.moderation_note is distinct from old.moderation_note
    or new.moderated_at is distinct from old.moderated_at
    or new.moderated_by is distinct from old.moderated_by;

  if not privileged_actor and privileged_fields_changed then
    raise exception using
      errcode = '42501',
      message = 'Campos de moderação, publicação e plano são exclusivos da administração.';
  end if;

  -- Preserve explicit moderation/publication actions made by administrators.
  if privileged_actor and privileged_fields_changed then
    if new.status is distinct from old.status then
      if new.status = 'pending' then
        new.moderation_note := null;
        new.moderated_at := null;
        new.moderated_by := null;
      else
        new.moderated_at := coalesce(new.moderated_at, now());
        new.moderated_by := coalesce(new.moderated_by, (select auth.uid()));
      end if;
    end if;

    return new;
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

    -- A merchant correction to an adjustment request is immediately republished
    -- and returns to the moderation queue. Suspensions remain protected.
    if old.status = 'rejected' then
      new.publication_status := 'published';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_business_moderation()
from public, anon, authenticated;

create or replace function public.search_public_business_ids(
  p_city_id bigint,
  p_query text default ''::text,
  p_category_slug text default null::text,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table(business_id bigint, total_count bigint)
language sql
stable
set search_path = ''
as $$
  with params as (
    select
      nullif(btrim(p_query), '') as query_text,
      public.search_normalize(nullif(btrim(p_query), '')) as normalized_query
  ),
  matched as (
    select b.id, b.name
    from public.businesses b
    join public.categories c on c.id = b.category_id
    cross join params
    where b.city_id = p_city_id
      and b.publication_status = 'published'
      and b.is_active = true
      and b.billing_suspended = false
      and c.is_active = true
      and (p_category_slug is null or c.slug = p_category_slug)
      and (
        params.query_text is null
        or public.search_normalize(
          coalesce(b.name, '') || ' ' || coalesce(b.description, '') || ' ' || coalesce(b.neighborhood, '')
        ) ilike '%' || params.normalized_query || '%'
        or public.search_normalize(coalesce(c.name, '')) ilike '%' || params.normalized_query || '%'
        or exists (
          select 1
          from pg_catalog.unnest(coalesce(b.tags, array[]::text[])) as tag(value)
          where public.search_normalize(tag.value) ilike '%' || params.normalized_query || '%'
        )
        or exists (
          select 1
          from public.catalog_items ci
          where ci.business_id = b.id
            and ci.is_active = true
            and public.search_normalize(
              coalesce(ci.name, '') || ' ' || coalesce(ci.description, '')
            ) ilike '%' || params.normalized_query || '%'
        )
      )
  )
  select matched.id as business_id, count(*) over() as total_count
  from matched
  order by matched.name asc, matched.id asc
  limit greatest(1, least(coalesce(p_limit, 12), 48))
  offset greatest(0, coalesce(p_offset, 0));
$$;

create or replace function public.get_public_nearby_businesses(
  p_city_id bigint,
  p_latitude double precision default null::double precision,
  p_longitude double precision default null::double precision,
  p_business_ids bigint[] default null::bigint[],
  p_limit integer default 12
)
returns table(
  id bigint,
  slug text,
  name text,
  neighborhood text,
  category_name text,
  distance_km double precision,
  highlight_campaign_id bigint
)
language sql
stable
set search_path = ''
as $$
  with candidates as (
    select
      b.id,
      b.slug,
      b.name,
      b.neighborhood,
      c.name as category_name,
      case
        when p_latitude is null
          or p_longitude is null
          or b.latitude is null
          or b.longitude is null
        then null::double precision
        else 6371.0 * 2.0 * asin(
          least(
            1.0,
            sqrt(
              power(sin(radians((b.latitude::double precision - p_latitude) / 2.0)), 2)
              + cos(radians(p_latitude))
                * cos(radians(b.latitude::double precision))
                * power(sin(radians((b.longitude::double precision - p_longitude) / 2.0)), 2)
            )
          )
        )
      end as distance_km,
      hc.id as highlight_campaign_id
    from public.businesses b
    join public.categories c
      on c.id = b.category_id
     and c.is_active = true
    left join lateral (
      select campaign.id
      from public.highlight_campaigns campaign
      where campaign.business_id = b.id
        and campaign.city_id = p_city_id
        and campaign.placement in ('city', 'combo')
        and campaign.status = 'active'
        and campaign.starts_at <= pg_catalog.now()
        and campaign.ends_at > pg_catalog.now()
        and b.logo_path is not null
        and b.cover_path is not null
      order by campaign.id desc
      limit 1
    ) hc on true
    where b.city_id = p_city_id
      and b.publication_status = 'published'
      and b.is_active = true
      and b.billing_suspended = false
      and (p_business_ids is null or b.id = any(p_business_ids))
  )
  select
    candidates.id,
    candidates.slug,
    candidates.name,
    candidates.neighborhood,
    candidates.category_name,
    candidates.distance_km,
    candidates.highlight_campaign_id
  from candidates
  order by
    (candidates.highlight_campaign_id is not null) desc,
    candidates.distance_km asc nulls last,
    candidates.name asc,
    candidates.id asc
  limit greatest(1, least(coalesce(p_limit, 12), 48));
$$;

-- Keep the public search/feed indexes aligned with the new visibility rule.
drop index if exists public.businesses_public_feed_idx;
create index businesses_public_feed_idx
on public.businesses (city_id, ((plan = 'featured')) desc, created_at desc)
where publication_status = 'published'
  and is_active = true
  and billing_suspended = false;

drop index if exists public.businesses_search_normalized_idx;
create index businesses_search_normalized_idx
on public.businesses using gin (
  to_tsvector(
    'simple'::regconfig,
    public.search_normalize(
      coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(neighborhood, '')
    )
  )
)
where publication_status = 'published'
  and is_active = true
  and billing_suspended = false;

drop index if exists public.businesses_search_normalized_trgm_idx;
create index businesses_search_normalized_trgm_idx
on public.businesses using gin (
  public.search_normalize(
    coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(neighborhood, '')
  ) extensions.gin_trgm_ops
)
where publication_status = 'published'
  and is_active = true
  and billing_suspended = false;
