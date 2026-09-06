create extension if not exists pg_cron;

create table public.billing_plan_rules (
  code text primary key,
  name text not null,
  included_businesses integer not null check (included_businesses >= 1),
  included_promotions_per_business integer not null check (included_promotions_per_business >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_plan_rules_code_check check (code in ('free', 'pro'))
);

create table public.billing_plan_prices (
  id bigint generated always as identity primary key,
  plan_code text not null references public.billing_plan_rules(code) on update cascade on delete restrict,
  billing_cycle text not null check (billing_cycle in ('monthly', 'semiannual', 'annual')),
  interval_months integer not null check (interval_months in (1, 6, 12)),
  price_cents integer not null check (price_cents >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_code, billing_cycle)
);

create table public.billing_products (
  code text primary key,
  name text not null,
  kind text not null check (kind in ('store_slot', 'promotion_pack')),
  units integer not null check (units > 0),
  price_cents integer not null check (price_cents >= 0),
  billing_mode text not null check (billing_mode in ('recurring', 'one_time')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null default 'pro' references public.billing_plan_rules(code) on update cascade on delete restrict,
  billing_cycle text not null check (billing_cycle in ('monthly', 'semiannual', 'annual')),
  payment_method text not null check (payment_method in ('credit_card', 'pix_auto', 'pix')),
  provider text not null default 'efi' check (provider = 'efi'),
  provider_plan_id text,
  provider_subscription_id text,
  provider_recurrence_id text,
  status text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'cancelled', 'expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_pro_only check (plan_code = 'pro'),
  constraint subscriptions_period_check check (current_period_end is null or current_period_start is null or current_period_end > current_period_start)
);

create table public.billing_addons (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id bigint references public.businesses(id) on delete cascade,
  product_code text not null references public.billing_products(code) on update cascade on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  provider text not null default 'efi' check (provider = 'efi'),
  provider_charge_id text,
  status text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'cancelled', 'expired')),
  active_from timestamptz,
  active_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_addons_period_check check (active_until is null or active_from is null or active_until > active_from)
);

create unique index subscriptions_provider_subscription_uidx
  on public.subscriptions(provider, provider_subscription_id)
  where provider_subscription_id is not null;
create unique index subscriptions_provider_recurrence_uidx
  on public.subscriptions(provider, provider_recurrence_id)
  where provider_recurrence_id is not null;
create index subscriptions_user_status_idx on public.subscriptions(user_id, status, current_period_end);
create index billing_addons_user_status_idx on public.billing_addons(user_id, status, active_until);
create index billing_addons_business_status_idx on public.billing_addons(business_id, status) where business_id is not null;

alter table public.businesses
  add column billing_suspended boolean not null default false,
  add column billing_suspension_reason text;

alter table public.promotions
  add column billing_suspended boolean not null default false,
  add column billing_suspension_reason text;

alter table public.billing_plan_rules enable row level security;
alter table public.billing_plan_prices enable row level security;
alter table public.billing_products enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_addons enable row level security;

revoke all on public.billing_plan_rules from anon, authenticated;
revoke all on public.billing_plan_prices from anon, authenticated;
revoke all on public.billing_products from anon, authenticated;
revoke all on public.subscriptions from anon, authenticated;
revoke all on public.billing_addons from anon, authenticated;

grant select on public.billing_plan_rules to anon, authenticated;
grant select on public.billing_plan_prices to anon, authenticated;
grant select on public.billing_products to anon, authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.billing_addons to authenticated;

create policy billing_plan_rules_public_read
  on public.billing_plan_rules for select to anon, authenticated
  using (is_active = true);
create policy billing_plan_prices_public_read
  on public.billing_plan_prices for select to anon, authenticated
  using (is_active = true);
create policy billing_products_public_read
  on public.billing_products for select to anon, authenticated
  using (is_active = true);
create policy subscriptions_owner_read
  on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy subscriptions_admin_manage
  on public.subscriptions for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
create policy billing_addons_owner_read
  on public.billing_addons for select to authenticated
  using ((select auth.uid()) = user_id);
create policy billing_addons_admin_manage
  on public.billing_addons for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

insert into public.billing_plan_rules (code, name, included_businesses, included_promotions_per_business)
values
  ('free', 'Grátis', 1, 2),
  ('pro', 'Calçadão Pro', 3, 10)
on conflict (code) do update set
  name = excluded.name,
  included_businesses = excluded.included_businesses,
  included_promotions_per_business = excluded.included_promotions_per_business,
  is_active = true,
  updated_at = now();

insert into public.billing_plan_prices (plan_code, billing_cycle, interval_months, price_cents)
values
  ('pro', 'monthly', 1, 2990),
  ('pro', 'semiannual', 6, 15990),
  ('pro', 'annual', 12, 29990)
on conflict (plan_code, billing_cycle) do update set
  interval_months = excluded.interval_months,
  price_cents = excluded.price_cents,
  is_active = true,
  updated_at = now();

insert into public.billing_products (code, name, kind, units, price_cents, billing_mode)
values
  ('extra_store', 'Loja adicional', 'store_slot', 1, 990, 'recurring'),
  ('promo_5', 'Pacote de 5 promoções', 'promotion_pack', 5, 990, 'one_time'),
  ('promo_10', 'Pacote de 10 promoções', 'promotion_pack', 10, 1790, 'one_time'),
  ('promo_20', 'Pacote de 20 promoções', 'promotion_pack', 20, 2990, 'one_time'),
  ('promo_50', 'Pacote de 50 promoções', 'promotion_pack', 50, 5990, 'one_time')
on conflict (code) do update set
  name = excluded.name,
  kind = excluded.kind,
  units = excluded.units,
  price_cents = excluded.price_cents,
  billing_mode = excluded.billing_mode,
  is_active = true,
  updated_at = now();

create trigger billing_plan_rules_set_updated_at
before update on public.billing_plan_rules
for each row execute function private.set_updated_at();
create trigger billing_plan_prices_set_updated_at
before update on public.billing_plan_prices
for each row execute function private.set_updated_at();
create trigger billing_products_set_updated_at
before update on public.billing_products
for each row execute function private.set_updated_at();
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function private.set_updated_at();
create trigger billing_addons_set_updated_at
before update on public.billing_addons
for each row execute function private.set_updated_at();

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
      and s.current_period_end is not null
      and s.current_period_end > now()
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
      when private.is_pro_active(p_user_id) then coalesce((select included_businesses from public.billing_plan_rules where code = 'pro' and is_active), 3)
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

create or replace function private.business_has_billing_access(p_business_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select id, owner_id, created_at
    from public.businesses
    where id = p_business_id
  ), ranked as (
    select count(*)::integer + 1 as position
    from public.businesses b
    join target t on t.owner_id = b.owner_id
    where (b.created_at, b.id) < (t.created_at, t.id)
  )
  select coalesce(ranked.position <= private.allowed_business_count(target.owner_id), false)
  from target cross join ranked;
$$;

create or replace function private.allowed_promotion_count(p_business_id bigint)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select owner_id
    from public.businesses
    where id = p_business_id
  ), base_limit as (
    select case
      when not private.business_has_billing_access(p_business_id) then 0
      when private.is_pro_active(target.owner_id) then coalesce((select included_promotions_per_business from public.billing_plan_rules where code = 'pro' and is_active), 10)
      else coalesce((select included_promotions_per_business from public.billing_plan_rules where code = 'free' and is_active), 2)
    end::integer as base_count,
    target.owner_id
    from target
  ), extras as (
    select coalesce(sum(p.units * a.quantity), 0)::integer as extra_count
    from public.billing_addons a
    join public.billing_products p on p.code = a.product_code
    join target t on t.owner_id = a.user_id
    where a.business_id = p_business_id
      and p.kind = 'promotion_pack'
      and p.is_active
      and a.status = 'active'
      and (a.active_from is null or a.active_from <= now())
      and (a.active_until is null or a.active_until > now())
      and private.is_pro_active(t.owner_id)
  )
  select greatest(0, base_limit.base_count + extras.extra_count)::integer
  from base_limit, extras;
$$;

create or replace function private.reconcile_billing_entitlements(p_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed_businesses integer;
begin
  if p_owner_id is null then
    return;
  end if;

  v_allowed_businesses := private.allowed_business_count(p_owner_id);

  with ranked as (
    select b.id,
           row_number() over (order by b.created_at, b.id) as position
    from public.businesses b
    where b.owner_id = p_owner_id
  )
  update public.businesses b
  set billing_suspended = (r.position > v_allowed_businesses),
      billing_suspension_reason = case when r.position > v_allowed_businesses then 'store_limit' else null end
  from ranked r
  where b.id = r.id
    and (
      b.billing_suspended is distinct from (r.position > v_allowed_businesses)
      or b.billing_suspension_reason is distinct from (case when r.position > v_allowed_businesses then 'store_limit' else null end)
    );

  with ranked as (
    select p.id,
           p.business_id,
           b.billing_suspended as business_suspended,
           row_number() over (partition by p.business_id order by p.created_at, p.id) as position,
           private.allowed_promotion_count(p.business_id) as allowed_count
    from public.promotions p
    join public.businesses b on b.id = p.business_id
    where b.owner_id = p_owner_id
  )
  update public.promotions p
  set billing_suspended = (r.business_suspended or r.position > r.allowed_count),
      billing_suspension_reason = case
        when r.business_suspended then 'business_suspended'
        when r.position > r.allowed_count then 'promotion_limit'
        else null
      end
  from ranked r
  where p.id = r.id
    and (
      p.billing_suspended is distinct from (r.business_suspended or r.position > r.allowed_count)
      or p.billing_suspension_reason is distinct from case
        when r.business_suspended then 'business_suspended'
        when r.position > r.allowed_count then 'promotion_limit'
        else null
      end
    );
end;
$$;

create or replace function private.guard_business_billing_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  privileged_actor boolean;
begin
  privileged_actor := current_user::text in ('postgres', 'service_role', 'supabase_admin') or private.is_admin();
  if tg_op = 'INSERT' then
    if not privileged_actor then
      new.billing_suspended := false;
      new.billing_suspension_reason := null;
    end if;
    return new;
  end if;
  if not privileged_actor and (
    new.billing_suspended is distinct from old.billing_suspended
    or new.billing_suspension_reason is distinct from old.billing_suspension_reason
  ) then
    raise exception using errcode = '42501', message = 'Campos de suspensão por assinatura são controlados pelo sistema.';
  end if;
  return new;
end;
$$;

create or replace function private.guard_promotion_billing_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  privileged_actor boolean;
begin
  privileged_actor := current_user::text in ('postgres', 'service_role', 'supabase_admin') or private.is_admin();
  if tg_op = 'INSERT' then
    if not privileged_actor then
      new.billing_suspended := false;
      new.billing_suspension_reason := null;
    end if;
    return new;
  end if;
  if not privileged_actor and (
    new.billing_suspended is distinct from old.billing_suspended
    or new.billing_suspension_reason is distinct from old.billing_suspension_reason
  ) then
    raise exception using errcode = '42501', message = 'Campos de suspensão por assinatura são controlados pelo sistema.';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_business_billing_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_allowed integer;
  privileged_actor boolean;
begin
  privileged_actor := current_user::text in ('postgres', 'service_role', 'supabase_admin') or private.is_admin();
  if privileged_actor then
    return new;
  end if;
  select count(*)::integer into v_count from public.businesses where owner_id = new.owner_id;
  v_allowed := private.allowed_business_count(new.owner_id);
  if v_count >= v_allowed then
    raise exception using errcode = 'P0001', message = 'BILLING_STORE_LIMIT: limite de lojas atingido para o plano atual.';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_promotion_billing_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_count integer;
  v_allowed integer;
  privileged_actor boolean;
begin
  privileged_actor := current_user::text in ('postgres', 'service_role', 'supabase_admin') or private.is_admin();
  if privileged_actor then
    return new;
  end if;
  select owner_id into v_owner_id from public.businesses where id = new.business_id;
  if v_owner_id is null or v_owner_id <> (select auth.uid()) then
    raise exception using errcode = '42501', message = 'Loja não pertence ao usuário autenticado.';
  end if;
  if not private.business_has_billing_access(new.business_id) then
    raise exception using errcode = 'P0001', message = 'BILLING_BUSINESS_SUSPENDED: esta loja está suspensa pelo limite do plano.';
  end if;
  select count(*)::integer into v_count from public.promotions where business_id = new.business_id;
  v_allowed := private.allowed_promotion_count(new.business_id);
  if v_count >= v_allowed then
    raise exception using errcode = 'P0001', message = 'BILLING_PROMOTION_LIMIT: limite de promoções atingido para esta loja.';
  end if;
  return new;
end;
$$;

create or replace function private.reconcile_subscription_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.reconcile_billing_entitlements(old.user_id);
    return old;
  end if;
  perform private.reconcile_billing_entitlements(new.user_id);
  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    perform private.reconcile_billing_entitlements(old.user_id);
  end if;
  return new;
end;
$$;

create or replace function private.reconcile_addon_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.reconcile_billing_entitlements(old.user_id);
    return old;
  end if;
  perform private.reconcile_billing_entitlements(new.user_id);
  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    perform private.reconcile_billing_entitlements(old.user_id);
  end if;
  return new;
end;
$$;

create or replace function private.reconcile_business_collection_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.reconcile_billing_entitlements(old.owner_id);
    return old;
  end if;
  perform private.reconcile_billing_entitlements(new.owner_id);
  return new;
end;
$$;

create or replace function private.reconcile_promotion_collection_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
begin
  select owner_id into v_owner_id
  from public.businesses
  where id = coalesce(new.business_id, old.business_id);
  if v_owner_id is not null then
    perform private.reconcile_billing_entitlements(v_owner_id);
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function private.expire_billing_periods()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.subscriptions
  set status = 'expired'
  where status = 'active'
    and current_period_end is not null
    and current_period_end <= now();

  update public.billing_addons
  set status = 'expired'
  where status = 'active'
    and active_until is not null
    and active_until <= now();
end;
$$;

revoke all on function private.is_pro_active(uuid) from public;
revoke all on function private.allowed_business_count(uuid) from public;
revoke all on function private.business_has_billing_access(bigint) from public;
revoke all on function private.allowed_promotion_count(bigint) from public;
revoke all on function private.reconcile_billing_entitlements(uuid) from public;
revoke all on function private.enforce_business_billing_limit() from public;
revoke all on function private.enforce_promotion_billing_limit() from public;
revoke all on function private.reconcile_subscription_change() from public;
revoke all on function private.reconcile_addon_change() from public;
revoke all on function private.reconcile_business_collection_change() from public;
revoke all on function private.reconcile_promotion_collection_change() from public;
revoke all on function private.expire_billing_periods() from public;

create trigger businesses_guard_billing_fields
before insert or update on public.businesses
for each row execute function private.guard_business_billing_fields();

create trigger businesses_enforce_billing_limit
before insert on public.businesses
for each row execute function private.enforce_business_billing_limit();

create trigger promotions_guard_billing_fields
before insert or update on public.promotions
for each row execute function private.guard_promotion_billing_fields();

create trigger promotions_enforce_billing_limit
before insert on public.promotions
for each row execute function private.enforce_promotion_billing_limit();

create trigger subscriptions_reconcile_entitlements
after insert or update or delete on public.subscriptions
for each row execute function private.reconcile_subscription_change();

create trigger billing_addons_reconcile_entitlements
after insert or update or delete on public.billing_addons
for each row execute function private.reconcile_addon_change();

create trigger businesses_reconcile_entitlements
after insert or delete on public.businesses
for each row execute function private.reconcile_business_collection_change();

create trigger promotions_reconcile_entitlements
after insert or delete on public.promotions
for each row execute function private.reconcile_promotion_collection_change();

drop policy if exists businesses_public_read on public.businesses;
create policy businesses_public_read
  on public.businesses for select to anon, authenticated
  using (
    status = 'approved'
    and is_active = true
    and billing_suspended = false
    and exists (select 1 from public.cities where cities.id = businesses.city_id and cities.is_active = true)
    and exists (select 1 from public.categories where categories.id = businesses.category_id and categories.is_active = true)
  );

drop policy if exists promotions_public_read on public.promotions;
create policy promotions_public_read
  on public.promotions for select to anon, authenticated
  using (
    is_active = true
    and billing_suspended = false
    and now() >= starts_at
    and now() <= ends_at
    and exists (
      select 1 from public.businesses
      where businesses.id = promotions.business_id
        and businesses.status = 'approved'
        and businesses.is_active = true
        and businesses.billing_suspended = false
    )
  );

do $$
begin
  if exists (select 1 from cron.job where jobname = 'billing-entitlements-expiry') then
    perform cron.unschedule('billing-entitlements-expiry');
  end if;
end $$;

select cron.schedule(
  'billing-entitlements-expiry',
  '*/5 * * * *',
  'select private.expire_billing_periods();'
);

select private.reconcile_billing_entitlements(id) from auth.users;
