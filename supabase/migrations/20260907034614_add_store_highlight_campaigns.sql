create table public.highlight_placement_rules (
  code text primary key check (code in ('city', 'category')),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  max_active integer not null check (max_active between 1 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.highlight_packages (
  code text primary key check (code ~ '^(city|category|combo)_(7|15|30)$'),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  placement text not null check (placement in ('city', 'category', 'combo')),
  duration_days integer not null check (duration_days in (7, 15, 30)),
  price_cents integer not null check (price_cents >= 0),
  display_order integer not null default 0 check (display_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (placement, duration_days)
);

create table public.highlight_campaigns (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id bigint not null references public.businesses(id) on delete cascade,
  package_code text not null references public.highlight_packages(code) on update cascade on delete restrict,
  placement text not null check (placement in ('city', 'category', 'combo')),
  city_id bigint not null references public.cities(id) on delete restrict,
  category_id bigint not null references public.categories(id) on delete restrict,
  duration_days integer not null check (duration_days between 1 and 120),
  base_price_cents integer not null check (base_price_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  charged_price_cents integer not null check (charged_price_cents >= 0),
  provider text not null default 'efi' check (provider in ('efi', 'manual')),
  provider_charge_id text,
  status text not null default 'pending'
    check (status in ('pending', 'scheduled', 'active', 'paused', 'completed', 'cancelled', 'expired', 'refunded')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  activated_at timestamptz,
  completed_at timestamptz,
  paused_at timestamptz,
  pause_reason text check (pause_reason is null or pause_reason in ('business_unavailable', 'admin', 'payment_dispute')),
  remaining_seconds bigint not null check (remaining_seconds >= 0),
  reservation_expires_at timestamptz,
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (discount_cents <= base_price_cents),
  check (charged_price_cents = base_price_cents - discount_cents),
  check ((provider = 'manual' and charged_price_cents = 0) or provider = 'efi')
);

create unique index highlight_campaigns_provider_charge_uidx
  on public.highlight_campaigns(provider, provider_charge_id)
  where provider_charge_id is not null;

create unique index highlight_campaigns_one_open_per_business_uidx
  on public.highlight_campaigns(business_id)
  where status in ('pending', 'scheduled', 'active', 'paused');

create index highlight_campaigns_public_city_idx
  on public.highlight_campaigns(city_id, status, starts_at, ends_at)
  where placement in ('city', 'combo');

create index highlight_campaigns_public_category_idx
  on public.highlight_campaigns(city_id, category_id, status, starts_at, ends_at)
  where placement in ('category', 'combo');

create index highlight_campaigns_owner_idx
  on public.highlight_campaigns(user_id, created_at desc);

create table public.highlight_daily_metrics (
  campaign_id bigint not null references public.highlight_campaigns(id) on delete cascade,
  metric_date date not null,
  impressions bigint not null default 0 check (impressions >= 0),
  store_views bigint not null default 0 check (store_views >= 0),
  whatsapp_clicks bigint not null default 0 check (whatsapp_clicks >= 0),
  directions_clicks bigint not null default 0 check (directions_clicks >= 0),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, metric_date)
);

create table private.highlight_event_dedup (
  campaign_id bigint not null references public.highlight_campaigns(id) on delete cascade,
  event_type text not null check (event_type in ('impression', 'store_view', 'whatsapp', 'directions')),
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  event_date date not null,
  created_at timestamptz not null default now(),
  primary key (campaign_id, event_type, visitor_hash, event_date)
);

alter table public.highlight_placement_rules enable row level security;
alter table public.highlight_packages enable row level security;
alter table public.highlight_campaigns enable row level security;
alter table public.highlight_daily_metrics enable row level security;

revoke all on public.highlight_placement_rules from anon, authenticated;
revoke all on public.highlight_packages from anon, authenticated;
revoke all on public.highlight_campaigns from anon, authenticated;
revoke all on public.highlight_daily_metrics from anon, authenticated;
revoke all on private.highlight_event_dedup from public, anon, authenticated;

grant select on public.highlight_placement_rules, public.highlight_packages to anon, authenticated;
grant update on public.highlight_placement_rules, public.highlight_packages to authenticated;
grant select on public.highlight_campaigns to anon, authenticated;
grant select on public.highlight_daily_metrics to authenticated;

create policy highlight_placement_rules_public_read
  on public.highlight_placement_rules for select to anon, authenticated
  using (is_active = true);

create policy highlight_placement_rules_admin_manage
  on public.highlight_placement_rules for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy highlight_packages_public_read
  on public.highlight_packages for select to anon, authenticated
  using (is_active = true);

create policy highlight_packages_admin_manage
  on public.highlight_packages for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create or replace function private.is_highlight_business_eligible(p_business_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.businesses b
    join public.cities c on c.id = b.city_id and c.is_active = true
    join public.categories cat on cat.id = b.category_id and cat.is_active = true
    where b.id = p_business_id
      and b.status = 'approved'
      and b.is_active = true
      and b.billing_suspended = false
      and b.logo_path is not null
      and b.cover_path is not null
  );
$$;

revoke all on function private.is_highlight_business_eligible(bigint) from public, anon, authenticated;

create policy highlight_campaigns_public_read
  on public.highlight_campaigns for select to anon, authenticated
  using (
    status = 'active'
    and starts_at <= now()
    and ends_at > now()
    and private.is_highlight_business_eligible(business_id)
  );

create policy highlight_campaigns_owner_read
  on public.highlight_campaigns for select to authenticated
  using ((select auth.uid()) = user_id);

create policy highlight_campaigns_admin_read
  on public.highlight_campaigns for select to authenticated
  using ((select private.is_admin()));

create policy highlight_daily_metrics_owner_read
  on public.highlight_daily_metrics for select to authenticated
  using (
    exists (
      select 1 from public.highlight_campaigns c
      where c.id = highlight_daily_metrics.campaign_id
        and c.user_id = (select auth.uid())
    )
  );

create policy highlight_daily_metrics_admin_read
  on public.highlight_daily_metrics for select to authenticated
  using ((select private.is_admin()));

insert into public.highlight_placement_rules (code, name, max_active)
values
  ('city', 'Página inicial da cidade', 8),
  ('category', 'Categoria na cidade', 6)
on conflict (code) do update set
  name = excluded.name,
  max_active = excluded.max_active,
  is_active = true,
  updated_at = now();

insert into public.highlight_packages (code, name, placement, duration_days, price_cents, display_order)
values
  ('category_7', 'Destaque de categoria por 7 dias', 'category', 7, 1990, 10),
  ('category_15', 'Destaque de categoria por 15 dias', 'category', 15, 3490, 20),
  ('category_30', 'Destaque de categoria por 30 dias', 'category', 30, 5990, 30),
  ('city_7', 'Destaque da cidade por 7 dias', 'city', 7, 3990, 40),
  ('city_15', 'Destaque da cidade por 15 dias', 'city', 15, 6990, 50),
  ('city_30', 'Destaque da cidade por 30 dias', 'city', 30, 11990, 60),
  ('combo_7', 'Combo cidade e categoria por 7 dias', 'combo', 7, 4990, 70),
  ('combo_15', 'Combo cidade e categoria por 15 dias', 'combo', 15, 8990, 80),
  ('combo_30', 'Combo cidade e categoria por 30 dias', 'combo', 30, 14990, 90)
on conflict (code) do update set
  name = excluded.name,
  placement = excluded.placement,
  duration_days = excluded.duration_days,
  price_cents = excluded.price_cents,
  display_order = excluded.display_order,
  is_active = true,
  updated_at = now();

create trigger highlight_placement_rules_set_updated_at
before update on public.highlight_placement_rules
for each row execute function private.set_updated_at();

create trigger highlight_packages_set_updated_at
before update on public.highlight_packages
for each row execute function private.set_updated_at();

create trigger highlight_campaigns_set_updated_at
before update on public.highlight_campaigns
for each row execute function private.set_updated_at();

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
  v_city_count integer;
  v_category_count integer;
begin
  if p_placement not in ('city', 'category', 'combo') or p_ends_at <= p_starts_at then
    return false;
  end if;

  select * into v_business from public.businesses where id = p_business_id;
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

    select count(*)::integer into v_city_count
    from public.highlight_campaigns c
    where (p_exclude_campaign_id is null or c.id <> p_exclude_campaign_id)
      and c.city_id = v_business.city_id
      and c.placement in ('city', 'combo')
      and (
        c.status in ('scheduled', 'active')
        or (c.status = 'pending' and c.reservation_expires_at > now())
      )
      and tstzrange(c.starts_at, c.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)');

    if v_city_count >= v_city_capacity then
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

    select count(*)::integer into v_category_count
    from public.highlight_campaigns c
    where (p_exclude_campaign_id is null or c.id <> p_exclude_campaign_id)
      and c.city_id = v_business.city_id
      and c.category_id = v_business.category_id
      and c.placement in ('category', 'combo')
      and (
        c.status in ('scheduled', 'active')
        or (c.status = 'pending' and c.reservation_expires_at > now())
      )
      and tstzrange(c.starts_at, c.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)');

    if v_category_count >= v_category_capacity then
      return false;
    end if;
  end if;

  return true;
end;
$$;

revoke all on function private.highlight_slot_available(bigint, bigint, text, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.reserve_highlight_campaign(
  p_user_id uuid,
  p_business_id bigint,
  p_package_code text,
  p_requested_start timestamptz default null
)
returns table (
  campaign_id bigint,
  package_name text,
  charged_price_cents integer,
  duration_days integer
)
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

  select * into v_business
  from public.businesses
  where id = p_business_id and owner_id = p_user_id;
  if v_business.id is null then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_INVALID_BUSINESS';
  end if;
  if not private.is_highlight_business_eligible(v_business.id) then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_BUSINESS_INELIGIBLE';
  end if;

  select * into v_package
  from public.highlight_packages
  where code = p_package_code and is_active = true;
  if v_package.code is null then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_INVALID_PACKAGE';
  end if;

  if exists (
    select 1 from public.highlight_campaigns
    where business_id = v_business.id
      and status in ('pending', 'scheduled', 'active', 'paused')
  ) then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_ALREADY_OPEN';
  end if;

  v_start := greatest(coalesce(p_requested_start, now()), now());
  if v_start > now() + interval '90 days' then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_START_TOO_FAR';
  end if;
  v_end := v_start + make_interval(days => v_package.duration_days);

  if not private.highlight_slot_available(null, v_business.id, v_package.placement, v_start, v_end) then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_NO_AVAILABILITY';
  end if;

  v_discount := case
    when private.is_pro_active(p_user_id) then round(v_package.price_cents * 0.10)::integer
    else 0
  end;

  insert into public.highlight_campaigns (
    user_id, business_id, package_code, placement, city_id, category_id,
    duration_days, base_price_cents, discount_cents, charged_price_cents,
    provider, status, starts_at, ends_at, remaining_seconds,
    reservation_expires_at
  ) values (
    p_user_id, v_business.id, v_package.code, v_package.placement,
    v_business.city_id, v_business.category_id, v_package.duration_days,
    v_package.price_cents, v_discount, v_package.price_cents - v_discount,
    'efi', 'pending', v_start, v_end, v_package.duration_days::bigint * 86400,
    now() + interval '3 days'
  ) returning id into v_campaign_id;

  return query select v_campaign_id, v_package.name, v_package.price_cents - v_discount, v_package.duration_days;
end;
$$;

revoke all on function public.reserve_highlight_campaign(uuid, bigint, text, timestamptz) from public, anon, authenticated;
grant execute on function public.reserve_highlight_campaign(uuid, bigint, text, timestamptz) to service_role;

create or replace function public.record_highlight_event(
  p_campaign_id bigint,
  p_event_type text,
  p_visitor_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date := (now() at time zone 'America/Sao_Paulo')::date;
  v_inserted integer;
begin
  if p_event_type not in ('impression', 'store_view', 'whatsapp', 'directions')
    or p_visitor_hash !~ '^[a-f0-9]{64}$'
  then
    return false;
  end if;

  if not exists (
    select 1 from public.highlight_campaigns c
    where c.id = p_campaign_id
      and c.status = 'active'
      and c.starts_at <= now()
      and c.ends_at > now()
      and private.is_highlight_business_eligible(c.business_id)
  ) then
    return false;
  end if;

  insert into private.highlight_event_dedup (campaign_id, event_type, visitor_hash, event_date)
  values (p_campaign_id, p_event_type, p_visitor_hash, v_date)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return false;
  end if;

  insert into public.highlight_daily_metrics (
    campaign_id, metric_date, impressions, store_views, whatsapp_clicks, directions_clicks
  ) values (
    p_campaign_id,
    v_date,
    case when p_event_type = 'impression' then 1 else 0 end,
    case when p_event_type = 'store_view' then 1 else 0 end,
    case when p_event_type = 'whatsapp' then 1 else 0 end,
    case when p_event_type = 'directions' then 1 else 0 end
  )
  on conflict (campaign_id, metric_date) do update set
    impressions = public.highlight_daily_metrics.impressions + excluded.impressions,
    store_views = public.highlight_daily_metrics.store_views + excluded.store_views,
    whatsapp_clicks = public.highlight_daily_metrics.whatsapp_clicks + excluded.whatsapp_clicks,
    directions_clicks = public.highlight_daily_metrics.directions_clicks + excluded.directions_clicks,
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.record_highlight_event(bigint, text, text) from public;
grant execute on function public.record_highlight_event(bigint, text, text) to anon, authenticated;

create or replace function public.admin_create_highlight_campaign(
  p_business_id bigint,
  p_package_code text,
  p_requested_start timestamptz default null,
  p_admin_note text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business public.businesses%rowtype;
  v_package public.highlight_packages%rowtype;
  v_start timestamptz;
  v_end timestamptz;
  v_status text;
  v_campaign_id bigint;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'Acesso administrativo necessário.';
  end if;
  perform pg_advisory_xact_lock(9020260907);

  select * into v_business from public.businesses where id = p_business_id;
  if v_business.id is null then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_INVALID_BUSINESS';
  end if;
  if not private.is_highlight_business_eligible(v_business.id) then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_BUSINESS_INELIGIBLE';
  end if;
  select * into v_package from public.highlight_packages where code = p_package_code and is_active = true;
  if v_package.code is null then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_INVALID_PACKAGE';
  end if;
  if exists (
    select 1 from public.highlight_campaigns
    where business_id = v_business.id and status in ('pending', 'scheduled', 'active', 'paused')
  ) then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_ALREADY_OPEN';
  end if;

  v_start := greatest(coalesce(p_requested_start, now()), now());
  v_end := v_start + make_interval(days => v_package.duration_days);
  if not private.highlight_slot_available(null, v_business.id, v_package.placement, v_start, v_end) then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_NO_AVAILABILITY';
  end if;
  v_status := case when v_start <= now() + interval '5 seconds' then 'active' else 'scheduled' end;

  insert into public.highlight_campaigns (
    user_id, business_id, package_code, placement, city_id, category_id,
    duration_days, base_price_cents, discount_cents, charged_price_cents,
    provider, status, starts_at, ends_at, activated_at, remaining_seconds,
    admin_note
  ) values (
    v_business.owner_id, v_business.id, v_package.code, v_package.placement,
    v_business.city_id, v_business.category_id, v_package.duration_days,
    v_package.price_cents, v_package.price_cents, 0,
    'manual', v_status, v_start, v_end,
    case when v_status = 'active' then now() else null end,
    v_package.duration_days::bigint * 86400,
    nullif(btrim(left(coalesce(p_admin_note, ''), 1000)), '')
  ) returning id into v_campaign_id;

  return v_campaign_id;
end;
$$;

revoke all on function public.admin_create_highlight_campaign(bigint, text, timestamptz, text) from public, anon;
grant execute on function public.admin_create_highlight_campaign(bigint, text, timestamptz, text) to authenticated;

create or replace function public.admin_manage_highlight_campaign(
  p_campaign_id bigint,
  p_action text,
  p_bonus_days integer default 0
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.highlight_campaigns%rowtype;
  v_remaining bigint;
  v_start timestamptz;
  v_end timestamptz;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'Acesso administrativo necessário.';
  end if;
  perform pg_advisory_xact_lock(9020260907);
  select * into v_campaign from public.highlight_campaigns where id = p_campaign_id for update;
  if v_campaign.id is null then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_INVALID_CAMPAIGN';
  end if;

  if p_action = 'pause' then
    if v_campaign.status not in ('active', 'scheduled') then return false; end if;
    v_remaining := case
      when v_campaign.status = 'active'
        then greatest(0, floor(extract(epoch from (v_campaign.ends_at - now())))::bigint)
      else v_campaign.remaining_seconds
    end;
    update public.highlight_campaigns
    set status = 'paused', paused_at = now(), pause_reason = 'admin', remaining_seconds = v_remaining
    where id = v_campaign.id;
  elsif p_action = 'resume' then
    if v_campaign.status <> 'paused' then return false; end if;
    if not private.is_highlight_business_eligible(v_campaign.business_id) then
      raise exception using errcode = 'P0001', message = 'HIGHLIGHT_BUSINESS_INELIGIBLE';
    end if;
    v_start := now();
    v_end := v_start + make_interval(secs => greatest(1, v_campaign.remaining_seconds)::double precision);
    if not private.highlight_slot_available(v_campaign.id, v_campaign.business_id, v_campaign.placement, v_start, v_end) then
      raise exception using errcode = 'P0001', message = 'HIGHLIGHT_NO_AVAILABILITY';
    end if;
    update public.highlight_campaigns
    set status = 'active', starts_at = v_start, ends_at = v_end,
        activated_at = coalesce(activated_at, now()), paused_at = null, pause_reason = null
    where id = v_campaign.id;
  elsif p_action = 'cancel' then
    if v_campaign.status in ('completed', 'cancelled', 'expired', 'refunded') then return false; end if;
    update public.highlight_campaigns
    set status = 'cancelled', completed_at = now(), reservation_expires_at = null
    where id = v_campaign.id;
  elsif p_action = 'bonus' then
    if p_bonus_days < 1 or p_bonus_days > 90
      or v_campaign.status not in ('scheduled', 'active', 'paused')
    then
      return false;
    end if;
    update public.highlight_campaigns
    set duration_days = duration_days + p_bonus_days,
        ends_at = case when status in ('scheduled', 'active') then ends_at + make_interval(days => p_bonus_days) else ends_at end,
        remaining_seconds = remaining_seconds + p_bonus_days::bigint * 86400
    where id = v_campaign.id;
  else
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.admin_manage_highlight_campaign(bigint, text, integer) from public, anon;
grant execute on function public.admin_manage_highlight_campaign(bigint, text, integer) to authenticated;

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
begin
  v_status := lower(coalesce(new.payload #>> '{status,current}', ''));
  v_charge_id := coalesce(new.payload #>> '{identifiers,charge_id}', new.provider_event_id);
  if v_charge_id is null or v_status = '' then return new; end if;

  select * into v_campaign
  from public.highlight_campaigns
  where provider = 'efi' and provider_charge_id = v_charge_id
  order by created_at desc
  limit 1
  for update;
  if v_campaign.id is null then return new; end if;

  if v_status in ('paid', 'settled') then
    v_start := greatest(v_campaign.starts_at, now());
    if not private.is_highlight_business_eligible(v_campaign.business_id) then
      update public.highlight_campaigns
      set status = 'paused', pause_reason = 'business_unavailable', paused_at = now(),
          remaining_seconds = v_campaign.duration_days::bigint * 86400,
          reservation_expires_at = null
      where id = v_campaign.id;
    elsif v_campaign.starts_at > now() then
      update public.highlight_campaigns
      set status = 'scheduled', ends_at = starts_at + make_interval(days => duration_days),
          remaining_seconds = duration_days::bigint * 86400,
          reservation_expires_at = null
      where id = v_campaign.id;
    else
      update public.highlight_campaigns
      set status = 'active', starts_at = v_start,
          ends_at = v_start + make_interval(days => duration_days),
          activated_at = coalesce(activated_at, now()),
          remaining_seconds = duration_days::bigint * 86400,
          paused_at = null, pause_reason = null, reservation_expires_at = null
      where id = v_campaign.id;
    end if;
  elsif v_status = 'contested' then
    update public.highlight_campaigns
    set remaining_seconds = case
          when status = 'active' then greatest(0, floor(extract(epoch from (ends_at - now())))::bigint)
          else remaining_seconds
        end,
        status = 'paused', pause_reason = 'payment_dispute', paused_at = now()
    where id = v_campaign.id;
  elsif v_status in ('canceled', 'cancelled') then
    update public.highlight_campaigns
    set status = 'cancelled', completed_at = now(), reservation_expires_at = null
    where id = v_campaign.id;
  elsif v_status = 'expired' then
    update public.highlight_campaigns
    set status = 'expired', completed_at = now(), reservation_expires_at = null
    where id = v_campaign.id and status = 'pending';
  elsif v_status in ('refunded', 'refunded_total', 'refunded_partial') then
    update public.highlight_campaigns
    set status = 'refunded', completed_at = now(), reservation_expires_at = null
    where id = v_campaign.id;
  end if;

  return new;
end;
$$;

revoke all on function private.process_highlight_provider_event() from public, anon, authenticated;

create trigger billing_provider_events_process_highlight
after insert on public.billing_provider_events
for each row execute function private.process_highlight_provider_event();

create or replace function private.expire_billing_periods()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.highlight_campaigns%rowtype;
  v_end timestamptz;
begin
  update public.subscriptions
  set status = 'expired'
  where status = 'active'
    and current_period_end is not null
    and current_period_end <= now();

  update public.billing_addons
  set status = case when cancel_at_period_end then 'cancelled' else 'expired' end
  where status = 'active'
    and active_until is not null
    and active_until <= now();

  update public.highlight_campaigns
  set status = 'expired', completed_at = now()
  where status = 'pending'
    and reservation_expires_at is not null
    and reservation_expires_at <= now();

  update public.highlight_campaigns
  set status = 'completed', completed_at = now(), remaining_seconds = 0
  where status = 'active' and ends_at <= now();

  for v_campaign in
    select * from public.highlight_campaigns
    where status = 'active'
      and not private.is_highlight_business_eligible(business_id)
    order by id
    for update
  loop
    update public.highlight_campaigns
    set status = 'paused', pause_reason = 'business_unavailable', paused_at = now(),
        remaining_seconds = greatest(0, floor(extract(epoch from (v_campaign.ends_at - now())))::bigint)
    where id = v_campaign.id;
  end loop;

  for v_campaign in
    select * from public.highlight_campaigns
    where status = 'scheduled' and starts_at <= now()
    order by starts_at, id
    for update
  loop
    if private.is_highlight_business_eligible(v_campaign.business_id) then
      update public.highlight_campaigns
      set status = 'active', activated_at = coalesce(activated_at, now()),
          starts_at = now(), ends_at = now() + make_interval(secs => remaining_seconds::double precision)
      where id = v_campaign.id;
    else
      update public.highlight_campaigns
      set status = 'paused', pause_reason = 'business_unavailable', paused_at = now()
      where id = v_campaign.id;
    end if;
  end loop;

  for v_campaign in
    select * from public.highlight_campaigns
    where status = 'paused'
      and pause_reason = 'business_unavailable'
      and remaining_seconds > 0
      and private.is_highlight_business_eligible(business_id)
    order by paused_at nulls first, id
    for update
  loop
    v_end := now() + make_interval(secs => v_campaign.remaining_seconds::double precision);
    if private.highlight_slot_available(v_campaign.id, v_campaign.business_id, v_campaign.placement, now(), v_end) then
      update public.highlight_campaigns
      set status = 'active', starts_at = now(), ends_at = v_end,
          activated_at = coalesce(activated_at, now()), paused_at = null, pause_reason = null
      where id = v_campaign.id;
    end if;
  end loop;

  delete from private.highlight_event_dedup
  where event_date < (now() at time zone 'America/Sao_Paulo')::date - 45;
end;
$$;

revoke all on function private.expire_billing_periods() from public, anon, authenticated;
