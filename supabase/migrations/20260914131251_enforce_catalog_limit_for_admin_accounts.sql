-- Admin accounts use the same catalog quota when acting as merchants.
-- Service-role maintenance (no auth.uid()) remains possible.
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

  if (select auth.uid()) is null then
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
