create extension if not exists pg_trgm with schema extensions;

create index if not exists businesses_search_normalized_trgm_idx
on public.businesses using gin (
  public.search_normalize(
    coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(neighborhood, '')
  ) extensions.gin_trgm_ops
)
where status = 'approved' and is_active = true and billing_suspended = false;

create index if not exists catalog_items_search_normalized_trgm_idx
on public.catalog_items using gin (
  public.search_normalize(coalesce(name, '') || ' ' || coalesce(description, '')) extensions.gin_trgm_ops
)
where is_active = true;

create or replace function public.search_public_business_ids(
  p_city_id bigint,
  p_query text default '',
  p_category_slug text default null,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  business_id bigint,
  total_count bigint
)
language sql
stable
security invoker
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
      and b.status = 'approved'
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

revoke all on function public.search_public_business_ids(bigint, text, text, integer, integer) from public;
grant execute on function public.search_public_business_ids(bigint, text, text, integer, integer) to anon, authenticated;
