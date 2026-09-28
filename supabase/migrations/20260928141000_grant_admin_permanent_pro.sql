create or replace function private.is_pro_active(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = p_user_id
      and s.plan_code = 'pro'
      and s.status = 'active'
      and s.current_period_start is not null
      and s.current_period_start <= now()
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

create or replace function private.allowed_business_count(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with plan_limit as (
    select case
      when private.is_pro_active(p_user_id) then coalesce((select included_businesses from public.billing_plan_rules where code = 'pro' and is_active), 4)
      else coalesce((select included_businesses from public.billing_plan_rules where code = 'free' and is_active), 1)
    end as base_count
  ), extras as (
    select coalesce(sum(p.units * a.quantity), 0)::integer as extra_count
    from public.billing_addons a
    join public.billing_products p on p.code = a.product_code
    where a.user_id = p_user_id
      and p.kind = 'store_slot'
      and p.is_active
      and a.status = 'active'
      and (a.active_from is null or a.active_from <= now())
      and (a.active_until is null or a.active_until > now())
      and private.is_pro_active(p_user_id)
  )
  select greatest(1, plan_limit.base_count + extras.extra_count)::integer
  from plan_limit, extras;
$$;

do $$
declare
  v_user_id uuid;
begin
  select u.id
  into v_user_id
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower('Filipi.01@live.com')
    and p.role = 'admin';

  if v_user_id is null then
    raise exception 'Admin account Filipi.01@live.com was not found';
  end if;

  if not exists (
    select 1
    from public.subscriptions s
    where s.user_id = v_user_id
      and s.plan_code = 'pro'
      and s.status = 'active'
      and s.current_period_end is null
  ) then
    insert into public.subscriptions (
      user_id,
      plan_code,
      billing_cycle,
      payment_method,
      status,
      current_period_start,
      current_period_end,
      cancel_at_period_end
    ) values (
      v_user_id,
      'pro',
      'monthly',
      'pix',
      'active',
      now(),
      null,
      false
    );
  end if;

  perform private.reconcile_billing_entitlements(v_user_id);
end;
$$;