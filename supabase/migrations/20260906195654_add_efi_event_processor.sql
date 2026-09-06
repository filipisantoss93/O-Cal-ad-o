alter table public.subscriptions
  add column provider_charge_id text;

create unique index subscriptions_provider_charge_uidx
  on public.subscriptions(provider, provider_charge_id)
  where provider_charge_id is not null;

create or replace function public.process_efi_billing_event(
  p_event_key text,
  p_event_type text,
  p_status text,
  p_subscription_id text default null,
  p_charge_id text default null,
  p_payload jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_addon public.billing_addons%rowtype;
  v_product public.billing_products%rowtype;
  v_months integer;
  v_base timestamptz;
begin
  if current_user::text not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception using errcode = '42501', message = 'Acesso negado ao processador de cobrança.';
  end if;

  insert into public.billing_provider_events (
    event_key,
    provider,
    provider_event_id,
    event_type,
    payload
  ) values (
    p_event_key,
    'efi',
    coalesce(p_subscription_id, p_charge_id),
    p_event_type,
    p_payload
  )
  on conflict (event_key) do nothing;

  if not found then
    return false;
  end if;

  if p_subscription_id is not null then
    select * into v_subscription
    from public.subscriptions
    where provider = 'efi'
      and provider_subscription_id = p_subscription_id
    order by created_at desc
    limit 1;
  end if;

  if v_subscription.id is null and p_charge_id is not null then
    select * into v_subscription
    from public.subscriptions
    where provider = 'efi'
      and provider_charge_id = p_charge_id
    order by created_at desc
    limit 1;
  end if;

  if v_subscription.id is not null then
    v_months := case v_subscription.billing_cycle
      when 'monthly' then 1
      when 'semiannual' then 6
      when 'annual' then 12
      else 1
    end;

    if p_status in ('paid', 'settled', 'active') then
      v_base := greatest(now(), coalesce(v_subscription.current_period_end, now()));
      update public.subscriptions
      set status = 'active',
          current_period_start = case
            when current_period_end is null or current_period_end <= now() then now()
            else current_period_start
          end,
          current_period_end = case
            when p_status in ('paid', 'settled') then v_base + make_interval(months => v_months)
            when current_period_end is null or current_period_end <= now() then now() + make_interval(months => v_months)
            else current_period_end
          end
      where id = v_subscription.id;
    elsif p_status in ('unpaid', 'contested') then
      update public.subscriptions set status = 'past_due' where id = v_subscription.id;
    elsif p_status in ('canceled', 'cancelled') then
      update public.subscriptions set status = 'cancelled' where id = v_subscription.id;
    elsif p_status = 'expired' then
      update public.subscriptions set status = 'expired' where id = v_subscription.id;
    end if;
    return true;
  end if;

  if p_subscription_id is not null then
    select * into v_addon
    from public.billing_addons
    where provider = 'efi'
      and provider_subscription_id = p_subscription_id
    order by created_at desc
    limit 1;
  end if;

  if v_addon.id is null and p_charge_id is not null then
    select * into v_addon
    from public.billing_addons
    where provider = 'efi'
      and provider_charge_id = p_charge_id
    order by created_at desc
    limit 1;
  end if;

  if v_addon.id is not null then
    select * into v_product
    from public.billing_products
    where code = v_addon.product_code;

    if p_status in ('paid', 'settled', 'active') then
      if v_product.kind = 'store_slot' then
        v_base := greatest(now(), coalesce(v_addon.active_until, now()));
        update public.billing_addons
        set status = 'active',
            active_from = coalesce(active_from, now()),
            active_until = case
              when p_status in ('paid', 'settled') then v_base + interval '1 month'
              when active_until is null or active_until <= now() then now() + interval '1 month'
              else active_until
            end
        where id = v_addon.id;
      else
        update public.billing_addons
        set status = 'active',
            active_from = coalesce(active_from, now()),
            active_until = null
        where id = v_addon.id;
      end if;
    elsif p_status in ('unpaid', 'contested') then
      update public.billing_addons set status = 'past_due' where id = v_addon.id;
    elsif p_status in ('canceled', 'cancelled') then
      update public.billing_addons set status = 'cancelled' where id = v_addon.id;
    elsif p_status = 'expired' then
      update public.billing_addons set status = 'expired' where id = v_addon.id;
    end if;
    return true;
  end if;

  return true;
end;
$$;

revoke all on function public.process_efi_billing_event(text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.process_efi_billing_event(text, text, text, text, text, jsonb) to service_role;
