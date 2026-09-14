-- Catalog capacity belongs to the account, across all its businesses.
alter table public.billing_plan_rules
  add column included_catalog_items integer not null default 8
    constraint billing_plan_rules_catalog_items_check check (included_catalog_items >= 0);

update public.billing_plan_rules
set included_catalog_items = case code when 'pro' then 20 else 8 end;

create or replace function private.allowed_catalog_count(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.is_pro_active(p_user_id)
    then coalesce((select included_catalog_items from public.billing_plan_rules where code = 'pro' and is_active), 20)
    else coalesce((select included_catalog_items from public.billing_plan_rules where code = 'free' and is_active), 8)
  end;
$$;

create or replace function private.enforce_catalog_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_previous_owner uuid;
  v_count integer;
begin
  select owner_id into v_owner from public.businesses where id = new.business_id;
  if v_owner is null then
    raise exception using errcode = '23503', message = 'Loja inválida para o catálogo.';
  end if;

  -- Keep administrative maintenance possible, but validate every merchant write.
  if (select auth.uid()) is null or private.is_admin() then
    return new;
  end if;
  if v_owner <> (select auth.uid()) then
    raise exception using errcode = '42501', message = 'Loja não pertence ao usuário autenticado.';
  end if;
  if tg_op = 'UPDATE' then
    select owner_id into v_previous_owner from public.businesses where id = old.business_id;
    if v_previous_owner = v_owner then
      return new;
    end if;
  end if;

  -- Serializes simultaneous inserts for the same account.
  perform pg_catalog.pg_advisory_xact_lock(925419, pg_catalog.hashtext(v_owner::text));
  select count(*)::integer into v_count
  from public.catalog_items ci
  join public.businesses b on b.id = ci.business_id
  where b.owner_id = v_owner;
  if v_count >= private.allowed_catalog_count(v_owner) then
    raise exception using errcode = 'P0001', message = 'BILLING_CATALOG_LIMIT: limite de produtos e serviços da conta atingido.';
  end if;
  return new;
end;
$$;

revoke all on function private.allowed_catalog_count(uuid) from public, anon, authenticated;
revoke all on function private.enforce_catalog_limit() from public, anon, authenticated;
create trigger catalog_items_enforce_plan_limit
before insert or update of business_id on public.catalog_items
for each row execute function private.enforce_catalog_limit();

-- A highlighted promotion is a Pro benefit; banners remain available on both plans.
create or replace function private.enforce_pro_promotion_feature()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if not new.is_featured then
    return new;
  end if;
  select owner_id into v_owner from public.businesses where id = new.business_id;
  if v_owner is null or not private.is_pro_active(v_owner) then
    raise exception using errcode = 'P0001', message = 'BILLING_PRO_REQUIRED: somente assinantes Pro podem destacar promoções.';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_pro_promotion_feature() from public, anon, authenticated;
create trigger promotions_require_pro_for_feature
before insert or update of is_featured, business_id on public.promotions
for each row execute function private.enforce_pro_promotion_feature();

-- Existing highlights are removed on plan loss (including cron expiry).
create or replace function private.clear_featured_promotions_without_pro(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is not null and not private.is_pro_active(p_user_id) then
    update public.promotions p set is_featured = false
    from public.businesses b
    where b.id = p.business_id and b.owner_id = p_user_id and p.is_featured;
  end if;
end;
$$;

create or replace function private.clear_featured_promotions_on_subscription_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    perform private.clear_featured_promotions_without_pro(old.user_id);
  end if;
  if tg_op <> 'DELETE' then
    perform private.clear_featured_promotions_without_pro(new.user_id);
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function private.clear_featured_promotions_without_pro(uuid) from public, anon, authenticated;
revoke all on function private.clear_featured_promotions_on_subscription_change() from public, anon, authenticated;
create trigger subscriptions_clear_featured_promotions
after insert or update or delete on public.subscriptions
for each row execute function private.clear_featured_promotions_on_subscription_change();

update public.promotions p set is_featured = false
from public.businesses b
where b.id = p.business_id and p.is_featured and not private.is_pro_active(b.owner_id);
