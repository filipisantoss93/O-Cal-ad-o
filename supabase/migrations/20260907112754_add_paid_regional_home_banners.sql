begin;

alter table public.highlight_placement_rules
  drop constraint if exists highlight_placement_rules_code_check;
alter table public.highlight_placement_rules
  add constraint highlight_placement_rules_code_check
  check (code in ('city', 'category', 'banner'));

alter table public.highlight_packages
  drop constraint if exists highlight_packages_code_check,
  drop constraint if exists highlight_packages_placement_check;
alter table public.highlight_packages
  add constraint highlight_packages_code_check
    check (code ~ '^(city|category|combo|banner)_(7|15|30)$'),
  add constraint highlight_packages_placement_check
    check (placement in ('city', 'category', 'combo', 'banner'));

alter table public.highlight_campaigns
  drop constraint if exists highlight_campaigns_placement_check,
  drop constraint if exists highlight_campaigns_pause_reason_check;
alter table public.highlight_campaigns
  add column creative_image_path text,
  add column creative_title text,
  add column creative_description text,
  add column creative_status text not null default 'approved',
  add column creative_rejection_reason text,
  add column creative_reviewed_at timestamptz,
  add column creative_reviewed_by uuid references auth.users(id) on delete set null,
  add constraint highlight_campaigns_placement_check
    check (placement in ('city', 'category', 'combo', 'banner')),
  add constraint highlight_campaigns_pause_reason_check
    check (
      pause_reason is null
      or pause_reason in (
        'business_unavailable', 'admin', 'payment_dispute',
        'creative_review', 'creative_rejected'
      )
    ),
  add constraint highlight_campaigns_creative_status_check
    check (creative_status in ('pending', 'approved', 'rejected')),
  add constraint highlight_campaigns_creative_title_check
    check (creative_title is null or char_length(btrim(creative_title)) between 3 and 90),
  add constraint highlight_campaigns_creative_description_check
    check (creative_description is null or char_length(btrim(creative_description)) between 3 and 180),
  add constraint highlight_campaigns_creative_rejection_check
    check (creative_rejection_reason is null or char_length(btrim(creative_rejection_reason)) between 3 and 500),
  add constraint highlight_campaigns_banner_creative_check
    check (
      placement <> 'banner'
      or (
        creative_image_path is not null
        and creative_title is not null
        and creative_description is not null
      )
    );

drop index if exists public.highlight_campaigns_one_open_per_business_uidx;
create unique index highlight_campaigns_one_open_store_per_business_uidx
  on public.highlight_campaigns(business_id)
  where placement <> 'banner'
    and status in ('pending', 'scheduled', 'active', 'paused');
create unique index highlight_campaigns_one_open_banner_per_business_uidx
  on public.highlight_campaigns(business_id)
  where placement = 'banner'
    and status in ('pending', 'scheduled', 'active', 'paused');
create index highlight_campaigns_public_banner_idx
  on public.highlight_campaigns(city_id, status, creative_status, starts_at, ends_at)
  where placement = 'banner';

insert into public.highlight_placement_rules (code, name, max_active, is_active)
values ('banner', 'Banner principal por cidade', 5, true)
on conflict (code) do update set
  name = excluded.name,
  max_active = excluded.max_active,
  is_active = true,
  updated_at = now();

insert into public.highlight_packages (
  code, name, placement, duration_days, price_cents, display_order, is_active
)
values
  ('banner_7', 'Banner regional por 7 dias', 'banner', 7, 6990, 100, true),
  ('banner_15', 'Banner regional por 15 dias', 'banner', 15, 11990, 110, true),
  ('banner_30', 'Banner regional por 30 dias', 'banner', 30, 19990, 120, true)
on conflict (code) do update set
  name = excluded.name,
  placement = excluded.placement,
  duration_days = excluded.duration_days,
  price_cents = excluded.price_cents,
  display_order = excluded.display_order,
  is_active = true,
  updated_at = now();

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
  v_capacity integer;
  v_peak integer;
begin
  if p_placement not in ('city', 'category', 'combo', 'banner')
    or p_ends_at <= p_starts_at
  then
    return false;
  end if;

  select * into v_business from public.businesses where id = p_business_id;
  if v_business.id is null then return false; end if;

  if p_placement in ('city', 'combo') then
    select max_active into v_capacity
    from public.highlight_placement_rules
    where code = 'city' and is_active = true;
    if v_capacity is null then return false; end if;

    with events as (
      select greatest(c.starts_at, p_starts_at) event_at, 1 delta
      from public.highlight_campaigns c
      where (p_exclude_campaign_id is null or c.id <> p_exclude_campaign_id)
        and c.city_id = v_business.city_id
        and c.placement in ('city', 'combo')
        and (c.status in ('scheduled', 'active') or (c.status = 'pending' and c.reservation_expires_at > now()))
        and tstzrange(c.starts_at, c.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
      union all
      select least(c.ends_at, p_ends_at), -1
      from public.highlight_campaigns c
      where (p_exclude_campaign_id is null or c.id <> p_exclude_campaign_id)
        and c.city_id = v_business.city_id
        and c.placement in ('city', 'combo')
        and (c.status in ('scheduled', 'active') or (c.status = 'pending' and c.reservation_expires_at > now()))
        and tstzrange(c.starts_at, c.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
    ), net as (select event_at, sum(delta) delta from events group by event_at),
    running as (select sum(delta) over (order by event_at) concurrent_count from net)
    select coalesce(max(concurrent_count), 0)::integer into v_peak from running;
    if v_peak >= v_capacity then return false; end if;
  end if;

  if p_placement in ('category', 'combo') then
    select max_active into v_capacity
    from public.highlight_placement_rules
    where code = 'category' and is_active = true;
    if v_capacity is null then return false; end if;

    with events as (
      select greatest(c.starts_at, p_starts_at) event_at, 1 delta
      from public.highlight_campaigns c
      where (p_exclude_campaign_id is null or c.id <> p_exclude_campaign_id)
        and c.city_id = v_business.city_id and c.category_id = v_business.category_id
        and c.placement in ('category', 'combo')
        and (c.status in ('scheduled', 'active') or (c.status = 'pending' and c.reservation_expires_at > now()))
        and tstzrange(c.starts_at, c.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
      union all
      select least(c.ends_at, p_ends_at), -1
      from public.highlight_campaigns c
      where (p_exclude_campaign_id is null or c.id <> p_exclude_campaign_id)
        and c.city_id = v_business.city_id and c.category_id = v_business.category_id
        and c.placement in ('category', 'combo')
        and (c.status in ('scheduled', 'active') or (c.status = 'pending' and c.reservation_expires_at > now()))
        and tstzrange(c.starts_at, c.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
    ), net as (select event_at, sum(delta) delta from events group by event_at),
    running as (select sum(delta) over (order by event_at) concurrent_count from net)
    select coalesce(max(concurrent_count), 0)::integer into v_peak from running;
    if v_peak >= v_capacity then return false; end if;
  end if;

  if p_placement = 'banner' then
    select max_active into v_capacity
    from public.highlight_placement_rules
    where code = 'banner' and is_active = true;
    if v_capacity is null then return false; end if;

    with events as (
      select greatest(c.starts_at, p_starts_at) event_at, 1 delta
      from public.highlight_campaigns c
      where (p_exclude_campaign_id is null or c.id <> p_exclude_campaign_id)
        and c.city_id = v_business.city_id and c.placement = 'banner'
        and (
          c.status in ('scheduled', 'active')
          or (c.status = 'pending' and c.reservation_expires_at > now())
          or (c.status = 'paused' and c.pause_reason = 'creative_review')
        )
        and tstzrange(c.starts_at, c.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
      union all
      select least(c.ends_at, p_ends_at), -1
      from public.highlight_campaigns c
      where (p_exclude_campaign_id is null or c.id <> p_exclude_campaign_id)
        and c.city_id = v_business.city_id and c.placement = 'banner'
        and (
          c.status in ('scheduled', 'active')
          or (c.status = 'pending' and c.reservation_expires_at > now())
          or (c.status = 'paused' and c.pause_reason = 'creative_review')
        )
        and tstzrange(c.starts_at, c.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
    ), net as (select event_at, sum(delta) delta from events group by event_at),
    running as (select sum(delta) over (order by event_at) concurrent_count from net)
    select coalesce(max(concurrent_count), 0)::integer into v_peak from running;
    if v_peak >= v_capacity then return false; end if;
  end if;

  return true;
end;
$$;

revoke all on function private.highlight_slot_available(bigint, bigint, text, timestamptz, timestamptz)
  from public, anon, authenticated;

create or replace function public.reserve_highlight_campaign(
  p_user_id uuid,
  p_business_id bigint,
  p_package_code text,
  p_requested_start timestamptz default null
)
returns table (campaign_id bigint, package_name text, charged_price_cents integer, duration_days integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business public.businesses%rowtype;
  v_package public.highlight_packages%rowtype;
  v_start timestamptz;
  v_end timestamptz;
  v_discount integer;
  v_campaign_id bigint;
begin
  perform pg_advisory_xact_lock(9020260907);
  select * into v_business from public.businesses where id = p_business_id and owner_id = p_user_id;
  if v_business.id is null then raise exception using errcode = 'P0001', message = 'HIGHLIGHT_INVALID_BUSINESS'; end if;
  if not private.is_highlight_business_eligible(v_business.id) then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_BUSINESS_INELIGIBLE';
  end if;
  select * into v_package from public.highlight_packages
  where code = p_package_code and is_active = true and placement <> 'banner';
  if v_package.code is null then raise exception using errcode = 'P0001', message = 'HIGHLIGHT_INVALID_PACKAGE'; end if;
  if exists (
    select 1 from public.highlight_campaigns
    where business_id = v_business.id and placement <> 'banner'
      and status in ('pending', 'scheduled', 'active', 'paused')
  ) then raise exception using errcode = 'P0001', message = 'HIGHLIGHT_ALREADY_OPEN'; end if;
  v_start := greatest(coalesce(p_requested_start, now()), now());
  if v_start > now() + interval '90 days' then raise exception using errcode = 'P0001', message = 'HIGHLIGHT_START_TOO_FAR'; end if;
  v_end := v_start + make_interval(days => v_package.duration_days);
  if not private.highlight_slot_available(null, v_business.id, v_package.placement, v_start, v_end) then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_NO_AVAILABILITY';
  end if;
  v_discount := case when private.is_pro_active(p_user_id) then round(v_package.price_cents * 0.10)::integer else 0 end;
  insert into public.highlight_campaigns (
    user_id, business_id, package_code, placement, city_id, category_id,
    duration_days, base_price_cents, discount_cents, charged_price_cents,
    provider, status, starts_at, ends_at, remaining_seconds, reservation_expires_at
  ) values (
    p_user_id, v_business.id, v_package.code, v_package.placement, v_business.city_id, v_business.category_id,
    v_package.duration_days, v_package.price_cents, v_discount, v_package.price_cents - v_discount,
    'efi', 'pending', v_start, v_end, v_package.duration_days::bigint * 86400, now() + interval '3 days'
  ) returning id into v_campaign_id;
  return query select v_campaign_id, v_package.name, v_package.price_cents - v_discount, v_package.duration_days;
end;
$$;
revoke all on function public.reserve_highlight_campaign(uuid, bigint, text, timestamptz) from public, anon, authenticated;
grant execute on function public.reserve_highlight_campaign(uuid, bigint, text, timestamptz) to service_role;

create or replace function public.reserve_banner_campaign(
  p_user_id uuid,
  p_business_id bigint,
  p_package_code text,
  p_requested_start timestamptz,
  p_image_path text,
  p_title text,
  p_description text
)
returns table (campaign_id bigint, package_name text, charged_price_cents integer, duration_days integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business public.businesses%rowtype;
  v_package public.highlight_packages%rowtype;
  v_start timestamptz;
  v_end timestamptz;
  v_discount integer;
  v_campaign_id bigint;
begin
  perform pg_advisory_xact_lock(9020260907);
  select * into v_business from public.businesses where id = p_business_id and owner_id = p_user_id;
  if v_business.id is null then raise exception using errcode = 'P0001', message = 'HIGHLIGHT_INVALID_BUSINESS'; end if;
  if not private.is_highlight_business_eligible(v_business.id) then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_BUSINESS_INELIGIBLE';
  end if;
  select * into v_package from public.highlight_packages
  where code = p_package_code and is_active = true and placement = 'banner';
  if v_package.code is null then raise exception using errcode = 'P0001', message = 'HIGHLIGHT_INVALID_PACKAGE'; end if;
  if p_image_path is null
    or p_image_path !~ ('^' || p_user_id::text || '/banner-[a-f0-9-]+\.(jpg|png|webp|avif)$')
    or char_length(btrim(coalesce(p_title, ''))) not between 3 and 90
    or char_length(btrim(coalesce(p_description, ''))) not between 3 and 180
  then raise exception using errcode = 'P0001', message = 'BANNER_INVALID_CREATIVE'; end if;
  if exists (
    select 1 from public.highlight_campaigns
    where business_id = v_business.id and placement = 'banner'
      and status in ('pending', 'scheduled', 'active', 'paused')
  ) then raise exception using errcode = 'P0001', message = 'BANNER_ALREADY_OPEN'; end if;
  v_start := greatest(coalesce(p_requested_start, now()), now());
  if v_start > now() + interval '90 days' then raise exception using errcode = 'P0001', message = 'HIGHLIGHT_START_TOO_FAR'; end if;
  v_end := v_start + make_interval(days => v_package.duration_days);
  if not private.highlight_slot_available(null, v_business.id, 'banner', v_start, v_end) then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_NO_AVAILABILITY';
  end if;
  v_discount := case when private.is_pro_active(p_user_id) then round(v_package.price_cents * 0.10)::integer else 0 end;
  insert into public.highlight_campaigns (
    user_id, business_id, package_code, placement, city_id, category_id,
    duration_days, base_price_cents, discount_cents, charged_price_cents,
    provider, status, starts_at, ends_at, remaining_seconds, reservation_expires_at,
    creative_image_path, creative_title, creative_description, creative_status
  ) values (
    p_user_id, v_business.id, v_package.code, 'banner', v_business.city_id, v_business.category_id,
    v_package.duration_days, v_package.price_cents, v_discount, v_package.price_cents - v_discount,
    'efi', 'pending', v_start, v_end, v_package.duration_days::bigint * 86400, now() + interval '3 days',
    p_image_path, btrim(p_title), btrim(p_description), 'pending'
  ) returning id into v_campaign_id;
  return query select v_campaign_id, v_package.name, v_package.price_cents - v_discount, v_package.duration_days;
end;
$$;
revoke all on function public.reserve_banner_campaign(uuid, bigint, text, timestamptz, text, text, text)
  from public, anon, authenticated;
grant execute on function public.reserve_banner_campaign(uuid, bigint, text, timestamptz, text, text, text)
  to service_role;

create or replace function public.replace_banner_creative(
  p_campaign_id bigint,
  p_image_path text,
  p_title text,
  p_description text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.highlight_campaigns%rowtype;
begin
  select * into v_campaign from public.highlight_campaigns
  where id = p_campaign_id and user_id = (select auth.uid()) and placement = 'banner'
  for update;
  if v_campaign.id is null or v_campaign.status not in ('pending', 'paused') then return false; end if;
  if p_image_path !~ ('^' || (select auth.uid())::text || '/banner-[a-f0-9-]+\.(jpg|png|webp|avif)$')
    or char_length(btrim(coalesce(p_title, ''))) not between 3 and 90
    or char_length(btrim(coalesce(p_description, ''))) not between 3 and 180
  then return false; end if;
  update public.highlight_campaigns set
    creative_image_path = p_image_path,
    creative_title = btrim(p_title),
    creative_description = btrim(p_description),
    creative_status = 'pending',
    creative_rejection_reason = null,
    creative_reviewed_at = null,
    creative_reviewed_by = null,
    pause_reason = case when status = 'paused' and pause_reason = 'creative_rejected' then 'creative_review' else pause_reason end
  where id = v_campaign.id;
  return true;
end;
$$;
revoke all on function public.replace_banner_creative(bigint, text, text, text) from public, anon;
grant execute on function public.replace_banner_creative(bigint, text, text, text) to authenticated;

create or replace function public.admin_review_banner_campaign(
  p_campaign_id bigint,
  p_decision text,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.highlight_campaigns%rowtype;
  v_start timestamptz;
  v_end timestamptz;
  v_status text;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'Acesso administrativo necessário.';
  end if;
  if p_decision not in ('approve', 'reject') then return false; end if;
  perform pg_advisory_xact_lock(9020260907);
  select * into v_campaign from public.highlight_campaigns
  where id = p_campaign_id and placement = 'banner' for update;
  if v_campaign.id is null then return false; end if;

  if p_decision = 'reject' then
    if char_length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then return false; end if;
    update public.highlight_campaigns set
      creative_status = 'rejected',
      creative_rejection_reason = btrim(p_reason),
      creative_reviewed_at = now(),
      creative_reviewed_by = (select auth.uid()),
      remaining_seconds = case when status = 'active'
        then greatest(0, floor(extract(epoch from (ends_at - now())))::bigint)
        else remaining_seconds end,
      status = case when status in ('active', 'scheduled', 'paused') then 'paused' else status end,
      paused_at = case when status in ('active', 'scheduled', 'paused') then now() else paused_at end,
      pause_reason = case when status in ('active', 'scheduled', 'paused') then 'creative_rejected' else pause_reason end
    where id = v_campaign.id;
    return true;
  end if;

  if v_campaign.status = 'paused' and v_campaign.pause_reason in ('creative_review', 'creative_rejected') then
    if not private.is_highlight_business_eligible(v_campaign.business_id) then
      update public.highlight_campaigns set
        creative_status = 'approved', creative_rejection_reason = null,
        creative_reviewed_at = now(), creative_reviewed_by = (select auth.uid()),
        pause_reason = 'business_unavailable'
      where id = v_campaign.id;
      return true;
    end if;
    v_start := case when v_campaign.activated_at is null and v_campaign.starts_at > now()
      then v_campaign.starts_at else now() end;
    v_status := case when v_start > now() + interval '5 seconds' then 'scheduled' else 'active' end;
    v_end := v_start + make_interval(secs => greatest(1, v_campaign.remaining_seconds)::double precision);
    if not private.highlight_slot_available(v_campaign.id, v_campaign.business_id, 'banner', v_start, v_end) then
      raise exception using errcode = 'P0001', message = 'HIGHLIGHT_NO_AVAILABILITY';
    end if;
    update public.highlight_campaigns set
      creative_status = 'approved', creative_rejection_reason = null,
      creative_reviewed_at = now(), creative_reviewed_by = (select auth.uid()),
      status = v_status, starts_at = v_start, ends_at = v_end,
      activated_at = case when v_status = 'active' then coalesce(activated_at, now()) else activated_at end,
      paused_at = null, pause_reason = null
    where id = v_campaign.id;
  else
    update public.highlight_campaigns set
      creative_status = 'approved', creative_rejection_reason = null,
      creative_reviewed_at = now(), creative_reviewed_by = (select auth.uid())
    where id = v_campaign.id;
  end if;
  return true;
end;
$$;
revoke all on function public.admin_review_banner_campaign(bigint, text, text) from public, anon;
grant execute on function public.admin_review_banner_campaign(bigint, text, text) to authenticated;

create or replace function private.process_highlight_provider_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.highlight_campaigns%rowtype;
  v_status text;
  v_charge_id text;
  v_start timestamptz;
  v_end timestamptz;
begin
  v_status := lower(coalesce(new.payload #>> '{status,current}', ''));
  v_charge_id := coalesce(new.payload #>> '{identifiers,charge_id}', new.provider_event_id);
  if v_charge_id is null or v_status = '' then return new; end if;
  select * into v_campaign from public.highlight_campaigns
  where provider = 'efi' and provider_charge_id = v_charge_id
  order by created_at desc limit 1 for update;
  if v_campaign.id is null then return new; end if;

  if v_status in ('paid', 'settled') and v_campaign.status = 'pending' then
    v_start := greatest(v_campaign.starts_at, now());
    if v_campaign.placement = 'banner' and v_campaign.creative_status <> 'approved' then
      update public.highlight_campaigns set
        status = 'paused',
        pause_reason = case when creative_status = 'rejected' then 'creative_rejected' else 'creative_review' end,
        paused_at = now(), remaining_seconds = duration_days::bigint * 86400,
        reservation_expires_at = null
      where id = v_campaign.id;
    elsif not private.is_highlight_business_eligible(v_campaign.business_id) then
      update public.highlight_campaigns set
        status = 'paused', pause_reason = 'business_unavailable', paused_at = now(),
        remaining_seconds = duration_days::bigint * 86400, reservation_expires_at = null
      where id = v_campaign.id;
    elsif v_campaign.starts_at > now() then
      update public.highlight_campaigns set
        status = 'scheduled', ends_at = starts_at + make_interval(days => duration_days),
        remaining_seconds = duration_days::bigint * 86400, reservation_expires_at = null
      where id = v_campaign.id;
    else
      update public.highlight_campaigns set
        status = 'active', starts_at = v_start,
        ends_at = v_start + make_interval(days => duration_days),
        activated_at = coalesce(activated_at, now()),
        remaining_seconds = duration_days::bigint * 86400,
        paused_at = null, pause_reason = null, reservation_expires_at = null
      where id = v_campaign.id;
    end if;
  elsif v_status in ('paid', 'settled') and v_campaign.status = 'paused'
    and v_campaign.pause_reason = 'payment_dispute'
  then
    if v_campaign.placement = 'banner' and v_campaign.creative_status <> 'approved' then
      update public.highlight_campaigns set
        pause_reason = case when creative_status = 'rejected' then 'creative_rejected' else 'creative_review' end
      where id = v_campaign.id;
    elsif not private.is_highlight_business_eligible(v_campaign.business_id) then
      update public.highlight_campaigns set pause_reason = 'business_unavailable' where id = v_campaign.id;
    else
      v_start := now();
      v_end := v_start + make_interval(secs => greatest(1, v_campaign.remaining_seconds)::double precision);
      if private.highlight_slot_available(v_campaign.id, v_campaign.business_id, v_campaign.placement, v_start, v_end) then
        update public.highlight_campaigns set
          status = 'active', starts_at = v_start, ends_at = v_end,
          activated_at = coalesce(activated_at, now()), paused_at = null, pause_reason = null
        where id = v_campaign.id;
      end if;
    end if;
  elsif v_status = 'contested' and v_campaign.status in ('pending', 'scheduled', 'active', 'paused') then
    update public.highlight_campaigns set
      remaining_seconds = case when status = 'active'
        then greatest(0, floor(extract(epoch from (ends_at - now())))::bigint)
        else remaining_seconds end,
      status = 'paused', pause_reason = 'payment_dispute', paused_at = now(), reservation_expires_at = null
    where id = v_campaign.id;
  elsif v_status in ('canceled', 'cancelled') and v_campaign.status not in ('completed', 'refunded') then
    update public.highlight_campaigns set status = 'cancelled', completed_at = now(), reservation_expires_at = null
    where id = v_campaign.id;
  elsif v_status = 'expired' and v_campaign.status = 'pending' then
    update public.highlight_campaigns set status = 'expired', completed_at = now(), reservation_expires_at = null
    where id = v_campaign.id;
  elsif v_status in ('refunded', 'refunded_total', 'refunded_partial') then
    update public.highlight_campaigns set status = 'refunded', completed_at = now(), reservation_expires_at = null
    where id = v_campaign.id;
  end if;
  return new;
end;
$$;
revoke all on function private.process_highlight_provider_event() from public, anon, authenticated;

create or replace function private.enforce_banner_creative_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.placement = 'banner'
    and new.status in ('scheduled', 'active')
    and new.creative_status <> 'approved'
  then
    raise exception using errcode = '23514', message = 'BANNER_REQUIRES_APPROVAL';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_banner_creative_approval() from public, anon, authenticated;

create trigger highlight_campaigns_enforce_banner_approval
before insert or update on public.highlight_campaigns
for each row execute function private.enforce_banner_creative_approval();

commit;
