create or replace function public.admin_create_complimentary_banner_campaign(
  p_business_id bigint,
  p_package_code text,
  p_creative_image_path text,
  p_creative_title text,
  p_creative_description text,
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

  perform pg_advisory_xact_lock(9020260918);

  select * into v_business
  from public.businesses
  where id = p_business_id;

  if v_business.id is null then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_INVALID_BUSINESS';
  end if;

  if v_business.owner_id is null
     or not private.is_highlight_business_eligible(v_business.id) then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_BUSINESS_INELIGIBLE';
  end if;

  select * into v_package
  from public.highlight_packages
  where code = p_package_code
    and placement = 'banner'
    and is_active = true;

  if v_package.code is null then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_INVALID_PACKAGE';
  end if;

  if char_length(btrim(coalesce(p_creative_title, ''))) < 3
     or char_length(btrim(coalesce(p_creative_title, ''))) > 90 then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_INVALID_CREATIVE_TITLE';
  end if;

  if char_length(btrim(coalesce(p_creative_description, ''))) < 3
     or char_length(btrim(coalesce(p_creative_description, ''))) > 180 then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_INVALID_CREATIVE_DESCRIPTION';
  end if;

  if p_creative_image_path is null
     or p_creative_image_path not like v_business.owner_id::text || '/banner-%'
     or not exists (
       select 1
       from storage.objects
       where bucket_id = 'business-media'
         and name = p_creative_image_path
     ) then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_INVALID_CREATIVE_IMAGE';
  end if;

  if exists (
    select 1
    from public.highlight_campaigns
    where business_id = v_business.id
      and status in ('pending', 'scheduled', 'active', 'paused')
  ) then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_ALREADY_OPEN';
  end if;

  v_start := greatest(coalesce(p_requested_start, now()), now());
  v_end := v_start + make_interval(days => v_package.duration_days);

  if not private.highlight_slot_available(
    null,
    v_business.id,
    'banner',
    v_start,
    v_end
  ) then
    raise exception using errcode = 'P0001', message = 'HIGHLIGHT_NO_AVAILABILITY';
  end if;

  v_status := case
    when v_start <= now() + interval '5 seconds' then 'active'
    else 'scheduled'
  end;

  insert into public.highlight_campaigns (
    user_id,
    business_id,
    package_code,
    placement,
    city_id,
    category_id,
    duration_days,
    base_price_cents,
    discount_cents,
    charged_price_cents,
    provider,
    status,
    starts_at,
    ends_at,
    activated_at,
    remaining_seconds,
    admin_note,
    creative_image_path,
    creative_title,
    creative_description,
    creative_status,
    creative_reviewed_at,
    creative_reviewed_by
  ) values (
    v_business.owner_id,
    v_business.id,
    v_package.code,
    'banner',
    v_business.city_id,
    v_business.category_id,
    v_package.duration_days,
    v_package.price_cents,
    v_package.price_cents,
    0,
    'manual',
    v_status,
    v_start,
    v_end,
    case when v_status = 'active' then now() else null end,
    v_package.duration_days::bigint * 86400,
    nullif(btrim(left(coalesce(p_admin_note, ''), 1000)), ''),
    p_creative_image_path,
    btrim(p_creative_title),
    btrim(p_creative_description),
    'approved',
    now(),
    auth.uid()
  )
  returning id into v_campaign_id;

  return v_campaign_id;
end;
$$;

revoke all on function public.admin_create_complimentary_banner_campaign(
  bigint, text, text, text, text, timestamptz, text
) from public, anon;

grant execute on function public.admin_create_complimentary_banner_campaign(
  bigint, text, text, text, text, timestamptz, text
) to authenticated;
