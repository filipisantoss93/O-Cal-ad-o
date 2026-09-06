create or replace function private.enforce_business_billing_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_allowed integer;
  v_actor uuid;
begin
  v_actor := (select auth.uid());

  if v_actor is null or private.is_admin() then
    return new;
  end if;

  if new.owner_id <> v_actor then
    raise exception using errcode = '42501', message = 'Loja não pertence ao usuário autenticado.';
  end if;

  select count(*)::integer into v_count
  from public.businesses
  where owner_id = new.owner_id;

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
  v_actor uuid;
begin
  v_actor := (select auth.uid());

  if v_actor is null or private.is_admin() then
    return new;
  end if;

  select owner_id into v_owner_id
  from public.businesses
  where id = new.business_id;

  if v_owner_id is null or v_owner_id <> v_actor then
    raise exception using errcode = '42501', message = 'Loja não pertence ao usuário autenticado.';
  end if;

  if not private.business_has_billing_access(new.business_id) then
    raise exception using errcode = 'P0001', message = 'BILLING_BUSINESS_SUSPENDED: esta loja está suspensa pelo limite do plano.';
  end if;

  select count(*)::integer into v_count
  from public.promotions
  where business_id = new.business_id;

  v_allowed := private.allowed_promotion_count(new.business_id);
  if v_count >= v_allowed then
    raise exception using errcode = 'P0001', message = 'BILLING_PROMOTION_LIMIT: limite de promoções atingido para esta loja.';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_business_billing_limit() from public;
revoke all on function private.enforce_promotion_billing_limit() from public;
