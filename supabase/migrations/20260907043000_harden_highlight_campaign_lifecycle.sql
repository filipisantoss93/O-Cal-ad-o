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
  v_resume_status text;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'Acesso administrativo necessário.';
  end if;

  perform pg_advisory_xact_lock(9020260907);

  select * into v_campaign
  from public.highlight_campaigns
  where id = p_campaign_id
  for update;

  if v_campaign.id is null then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_INVALID_CAMPAIGN';
  end if;

  if p_action = 'pause' then
    if v_campaign.status not in ('active', 'scheduled') then
      return false;
    end if;

    v_remaining := case
      when v_campaign.status = 'active'
        then greatest(0, floor(extract(epoch from (v_campaign.ends_at - now())))::bigint)
      else v_campaign.remaining_seconds
    end;

    update public.highlight_campaigns
    set status = 'paused',
        paused_at = now(),
        pause_reason = 'admin',
        remaining_seconds = v_remaining
    where id = v_campaign.id;

  elsif p_action = 'resume' then
    if v_campaign.status <> 'paused' or v_campaign.remaining_seconds <= 0 then
      return false;
    end if;
    if not private.is_highlight_business_eligible(v_campaign.business_id) then
      raise exception using errcode = 'P0001', message = 'HIGHLIGHT_BUSINESS_INELIGIBLE';
    end if;

    if v_campaign.activated_at is null and v_campaign.starts_at > now() then
      v_start := v_campaign.starts_at;
      v_resume_status := 'scheduled';
    else
      v_start := now();
      v_resume_status := 'active';
    end if;
    v_end := v_start + make_interval(secs => v_campaign.remaining_seconds::double precision);

    if not private.highlight_slot_available(
      v_campaign.id,
      v_campaign.business_id,
      v_campaign.placement,
      v_start,
      v_end
    ) then
      raise exception using errcode = 'P0001', message = 'HIGHLIGHT_NO_AVAILABILITY';
    end if;

    update public.highlight_campaigns
    set status = v_resume_status,
        starts_at = v_start,
        ends_at = v_end,
        activated_at = case
          when v_resume_status = 'active' then coalesce(activated_at, now())
          else activated_at
        end,
        paused_at = null,
        pause_reason = null
    where id = v_campaign.id;

  elsif p_action = 'cancel' then
    if v_campaign.status in ('completed', 'cancelled', 'expired', 'refunded') then
      return false;
    end if;

    update public.highlight_campaigns
    set status = 'cancelled',
        completed_at = now(),
        reservation_expires_at = null
    where id = v_campaign.id;

  elsif p_action = 'bonus' then
    if p_bonus_days < 1
      or p_bonus_days > 90
      or v_campaign.duration_days + p_bonus_days > 120
      or v_campaign.status not in ('scheduled', 'active', 'paused')
    then
      return false;
    end if;

    if v_campaign.status in ('scheduled', 'active') then
      v_start := case
        when v_campaign.status = 'active' then now()
        else v_campaign.starts_at
      end;
      v_end := v_campaign.ends_at + make_interval(days => p_bonus_days);

      if not private.highlight_slot_available(
        v_campaign.id,
        v_campaign.business_id,
        v_campaign.placement,
        v_start,
        v_end
      ) then
        raise exception using errcode = 'P0001', message = 'HIGHLIGHT_NO_AVAILABILITY';
      end if;
    end if;

    update public.highlight_campaigns
    set duration_days = duration_days + p_bonus_days,
        ends_at = case
          when status in ('scheduled', 'active')
            then ends_at + make_interval(days => p_bonus_days)
          else ends_at
        end,
        remaining_seconds = case
          when status = 'active'
            then greatest(0, floor(extract(epoch from (ends_at - now())))::bigint)
                 + p_bonus_days::bigint * 86400
          else remaining_seconds + p_bonus_days::bigint * 86400
        end
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
  v_end timestamptz;
begin
  v_status := lower(coalesce(new.payload #>> '{status,current}', ''));
  v_charge_id := coalesce(new.payload #>> '{identifiers,charge_id}', new.provider_event_id);
  if v_charge_id is null or v_status = '' then
    return new;
  end if;

  select * into v_campaign
  from public.highlight_campaigns
  where provider = 'efi'
    and provider_charge_id = v_charge_id
  order by created_at desc
  limit 1
  for update;

  if v_campaign.id is null then
    return new;
  end if;

  if v_status in ('paid', 'settled') and v_campaign.status = 'pending' then
    v_start := greatest(v_campaign.starts_at, now());
    if not private.is_highlight_business_eligible(v_campaign.business_id) then
      update public.highlight_campaigns
      set status = 'paused',
          pause_reason = 'business_unavailable',
          paused_at = now(),
          remaining_seconds = v_campaign.duration_days::bigint * 86400,
          reservation_expires_at = null
      where id = v_campaign.id;
    elsif v_campaign.starts_at > now() then
      update public.highlight_campaigns
      set status = 'scheduled',
          ends_at = starts_at + make_interval(days => duration_days),
          remaining_seconds = duration_days::bigint * 86400,
          reservation_expires_at = null
      where id = v_campaign.id;
    else
      update public.highlight_campaigns
      set status = 'active',
          starts_at = v_start,
          ends_at = v_start + make_interval(days => duration_days),
          activated_at = coalesce(activated_at, now()),
          remaining_seconds = duration_days::bigint * 86400,
          paused_at = null,
          pause_reason = null,
          reservation_expires_at = null
      where id = v_campaign.id;
    end if;

  elsif v_status in ('paid', 'settled')
    and v_campaign.status = 'paused'
    and v_campaign.pause_reason = 'payment_dispute'
  then
    if not private.is_highlight_business_eligible(v_campaign.business_id) then
      update public.highlight_campaigns
      set pause_reason = 'business_unavailable'
      where id = v_campaign.id;
    else
      v_start := now();
      v_end := v_start + make_interval(secs => greatest(1, v_campaign.remaining_seconds)::double precision);
      if private.highlight_slot_available(
        v_campaign.id,
        v_campaign.business_id,
        v_campaign.placement,
        v_start,
        v_end
      ) then
        update public.highlight_campaigns
        set status = 'active',
            starts_at = v_start,
            ends_at = v_end,
            activated_at = coalesce(activated_at, now()),
            paused_at = null,
            pause_reason = null
        where id = v_campaign.id;
      end if;
    end if;

  elsif v_status = 'contested'
    and v_campaign.status in ('pending', 'scheduled', 'active')
  then
    update public.highlight_campaigns
    set remaining_seconds = case
          when status = 'active'
            then greatest(0, floor(extract(epoch from (ends_at - now())))::bigint)
          else remaining_seconds
        end,
        status = 'paused',
        pause_reason = 'payment_dispute',
        paused_at = now(),
        reservation_expires_at = null
    where id = v_campaign.id;

  elsif v_status in ('canceled', 'cancelled')
    and v_campaign.status not in ('completed', 'refunded')
  then
    update public.highlight_campaigns
    set status = 'cancelled',
        completed_at = now(),
        reservation_expires_at = null
    where id = v_campaign.id;

  elsif v_status = 'expired' and v_campaign.status = 'pending' then
    update public.highlight_campaigns
    set status = 'expired',
        completed_at = now(),
        reservation_expires_at = null
    where id = v_campaign.id;

  elsif v_status in ('refunded', 'refunded_total', 'refunded_partial') then
    update public.highlight_campaigns
    set status = 'refunded',
        completed_at = now(),
        reservation_expires_at = null
    where id = v_campaign.id;
  end if;

  return new;
end;
$$;

revoke all on function private.process_highlight_provider_event() from public, anon, authenticated;
