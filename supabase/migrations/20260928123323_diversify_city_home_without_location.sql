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
security invoker
set search_path = ''
as $$
  with candidates as (
    select
      b.id,
      b.slug,
      b.name,
      b.neighborhood,
      b.category_id,
      c.name as category_name,
      (
        case when b.logo_path is not null then 3 else 0 end
        + case when b.cover_path is not null then 2 else 0 end
        + case when nullif(pg_catalog.btrim(b.description), '') is not null then 2 else 0 end
        + case when b.whatsapp_e164 is not null or b.phone_e164 is not null or b.website_url is not null then 2 else 0 end
        + case when nullif(pg_catalog.btrim(b.street), '') is not null and nullif(pg_catalog.btrim(b.neighborhood), '') is not null then 1 else 0 end
      ) as quality_score,
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
  ), ranked as (
    select
      candidates.*,
      row_number() over (
        partition by candidates.category_id
        order by
          (candidates.highlight_campaign_id is not null) desc,
          candidates.quality_score desc,
          candidates.name asc,
          candidates.id asc
      ) as category_rank
    from candidates
  )
  select
    ranked.id,
    ranked.slug,
    ranked.name,
    ranked.neighborhood,
    ranked.category_name,
    ranked.distance_km,
    ranked.highlight_campaign_id
  from ranked
  order by
    case when p_latitude is not null and p_longitude is not null then ranked.distance_km end asc nulls last,
    case when p_latitude is null or p_longitude is null then ranked.category_rank end asc nulls last,
    case when p_latitude is null or p_longitude is null then (ranked.highlight_campaign_id is not null)::integer end desc nulls last,
    case when p_latitude is null or p_longitude is null then ranked.quality_score end desc nulls last,
    ranked.name asc,
    ranked.id asc
  limit greatest(1, least(coalesce(p_limit, 12), 48));
$$;

revoke all on function public.get_public_nearby_businesses(bigint, double precision, double precision, bigint[], integer) from public;
grant execute on function public.get_public_nearby_businesses(bigint, double precision, double precision, bigint[], integer) to anon, authenticated;

comment on function public.get_public_nearby_businesses(
  bigint,
  double precision,
  double precision,
  bigint[],
  integer
) is 'Orders strictly by distance with coordinates; without coordinates, favors a diverse, complete and relevant city selection.';
