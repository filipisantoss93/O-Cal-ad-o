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
  with matched as (
    select b.id, b.name
    from public.businesses b
    join public.categories c on c.id = b.category_id
    where b.city_id = p_city_id
      and b.status = 'approved'
      and b.is_active = true
      and b.billing_suspended = false
      and c.is_active = true
      and (p_category_slug is null or c.slug = p_category_slug)
      and (
        nullif(btrim(p_query), '') is null
        or b.search_document @@ pg_catalog.websearch_to_tsquery('simple', btrim(p_query))
        or pg_catalog.to_tsvector('simple', coalesce(c.name, '')) @@ pg_catalog.websearch_to_tsquery('simple', btrim(p_query))
        or exists (
          select 1
          from pg_catalog.unnest(coalesce(b.tags, array[]::text[])) as tag(value)
          where tag.value ilike '%' || btrim(p_query) || '%'
        )
        or exists (
          select 1
          from public.catalog_items ci
          where ci.business_id = b.id
            and ci.is_active = true
            and ci.search_document @@ pg_catalog.websearch_to_tsquery('simple', btrim(p_query))
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
