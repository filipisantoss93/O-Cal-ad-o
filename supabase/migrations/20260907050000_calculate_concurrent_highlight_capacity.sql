create or replace function private.highlight_slot_available(
  p_exclude_campaign_id bigint,
  p_business_id bigint,
  p_placement text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_business public.businesses%rowtype;
  v_city_capacity integer;
  v_category_capacity integer;
  v_city_peak integer;
  v_category_peak integer;
begin
  if p_placement not in ('city', 'category', 'combo')
    or p_ends_at <= p_starts_at
  then
    return false;
  end if;

  select * into v_business
  from public.businesses
  where id = p_business_id;

  if v_business.id is null then
    return false;
  end if;

  if p_placement in ('city', 'combo') then
    select max_active into v_city_capacity
    from public.highlight_placement_rules
    where code = 'city' and is_active = true;

    if v_city_capacity is null then
      return false;
    end if;

    with events as (
      select greatest(c.starts_at, p_starts_at) as event_at, 1 as delta
      from public.highlight_campaigns c
      where (p_exclude_campaign_id is null or c.id <> p_exclude_campaign_id)
        and c.city_id = v_business.city_id
        and c.placement in ('city', 'combo')
        and (
          c.status in ('scheduled', 'active')
          or (c.status = 'pending' and c.reservation_expires_at > now())
        )
        and tstzrange(c.starts_at, c.ends_at, '[)')
          && tstzrange(p_starts_at, p_ends_at, '[)')
      union all
      select least(c.ends_at, p_ends_at) as event_at, -1 as delta
      from public.highlight_campaigns c
      where (p_exclude_campaign_id is null or c.id <> p_exclude_campaign_id)
        and c.city_id = v_business.city_id
        and c.placement in ('city', 'combo')
        and (
          c.status in ('scheduled', 'active')
          or (c.status = 'pending' and c.reservation_expires_at > now())
        )
        and tstzrange(c.starts_at, c.ends_at, '[)')
          && tstzrange(p_starts_at, p_ends_at, '[)')
    ), net_events as (
      select event_at, sum(delta) as delta
      from events
      group by event_at
    ), running_capacity as (
      select sum(delta) over (order by event_at) as concurrent_count
      from net_events
    )
    select coalesce(max(concurrent_count), 0)::integer
      into v_city_peak
    from running_capacity;

    if v_city_peak >= v_city_capacity then
      return false;
    end if;
  end if;

  if p_placement in ('category', 'combo') then
    select max_active into v_category_capacity
    from public.highlight_placement_rules
    where code = 'category' and is_active = true;

    if v_category_capacity is null then
      return false;
    end if;

    with events as (
      select greatest(c.starts_at, p_starts_at) as event_at, 1 as delta
      from public.highlight_campaigns c
      where (p_exclude_campaign_id is null or c.id <> p_exclude_campaign_id)
        and c.city_id = v_business.city_id
        and c.category_id = v_business.category_id
        and c.placement in ('category', 'combo')
        and (
          c.status in ('scheduled', 'active')
          or (c.status = 'pending' and c.reservation_expires_at > now())
        )
        and tstzrange(c.starts_at, c.ends_at, '[)')
          && tstzrange(p_starts_at, p_ends_at, '[)')
      union all
      select least(c.ends_at, p_ends_at) as event_at, -1 as delta
      from public.highlight_campaigns c
      where (p_exclude_campaign_id is null or c.id <> p_exclude_campaign_id)
        and c.city_id = v_business.city_id
        and c.category_id = v_business.category_id
        and c.placement in ('category', 'combo')
        and (
          c.status in ('scheduled', 'active')
          or (c.status = 'pending' and c.reservation_expires_at > now())
        )
        and tstzrange(c.starts_at, c.ends_at, '[)')
          && tstzrange(p_starts_at, p_ends_at, '[)')
    ), net_events as (
      select event_at, sum(delta) as delta
      from events
      group by event_at
    ), running_capacity as (
      select sum(delta) over (order by event_at) as concurrent_count
      from net_events
    )
    select coalesce(max(concurrent_count), 0)::integer
      into v_category_peak
    from running_capacity;

    if v_category_peak >= v_category_capacity then
      return false;
    end if;
  end if;

  return true;
end;
$$;

revoke all on function private.highlight_slot_available(
  bigint,
  bigint,
  text,
  timestamptz,
  timestamptz
) from public, anon, authenticated;
