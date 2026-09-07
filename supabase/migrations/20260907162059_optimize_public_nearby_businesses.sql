create or replace function public.get_public_nearby_businesses(
  p_city_id bigint,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_business_ids bigint[] default null,
  p_limit integer default 12
)
returns table (
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
security invoker
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
      and b.status = 'approved'
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

revoke all on function public.get_public_nearby_businesses(bigint, double precision, double precision, bigint[], integer) from public;
grant execute on function public.get_public_nearby_businesses(bigint, double precision, double precision, bigint[], integer) to anon, authenticated;
