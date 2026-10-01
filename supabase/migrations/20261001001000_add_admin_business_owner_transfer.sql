begin;

create table if not exists private.admin_business_owner_transfers (
  id bigint generated always as identity primary key,
  business_id bigint not null,
  previous_owner_id uuid not null,
  new_owner_id uuid not null,
  previous_owner_name text,
  previous_owner_email text,
  new_owner_name text,
  new_owner_email text,
  admin_id uuid not null,
  reason text not null check (char_length(btrim(reason)) between 5 and 1000),
  previous_owner_businesses_before integer not null,
  new_owner_businesses_before integer not null,
  new_owner_allowed_businesses integer not null,
  previous_claim_request_id bigint,
  new_claim_request_id bigint,
  created_at timestamptz not null default now()
);

create index if not exists admin_business_owner_transfers_business_idx
  on private.admin_business_owner_transfers (business_id, created_at desc);

revoke all on table private.admin_business_owner_transfers from public, anon, authenticated;

create or replace function public.admin_transfer_business_owner(
  p_business_id bigint,
  p_new_owner_id uuid,
  p_reason text,
  p_confirmation text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_business public.businesses%rowtype;
  v_previous_owner_id uuid;
  v_target_user_id uuid;
  v_previous_owner_name text;
  v_previous_owner_email text;
  v_new_owner_name text;
  v_new_owner_email text;
  v_previous_count integer;
  v_new_count integer;
  v_new_allowed integer;
  v_previous_claim_id bigint;
  v_new_claim_id bigint;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_transfer_id bigint;
begin
  if v_actor is null or not (select private.is_admin()) then
    raise exception using errcode = '42501', message = 'Acesso negado.';
  end if;

  if p_confirmation <> 'TRANSFERIR' then
    raise exception using errcode = '22023', message = 'Confirmação da transferência inválida.';
  end if;

  if p_business_id is null or p_business_id <= 0 or p_new_owner_id is null then
    raise exception using errcode = '22023', message = 'Empresa e novo responsável são obrigatórios.';
  end if;

  if char_length(v_reason) < 5 or char_length(v_reason) > 1000 then
    raise exception using errcode = '22023', message = 'Informe um motivo com pelo menos 5 caracteres.';
  end if;

  select *
    into v_business
  from public.businesses
  where id = p_business_id
  for update;

  if not found or v_business.listing_type <> 'business' then
    raise exception using errcode = '22023', message = 'Empresa não encontrada.';
  end if;

  if v_business.owner_id is null then
    raise exception using errcode = '23514', message = 'A empresa não possui responsável atual. Use o vínculo de perfil não reivindicado.';
  end if;

  v_previous_owner_id := v_business.owner_id;

  if v_previous_owner_id = p_new_owner_id then
    raise exception using errcode = '23514', message = 'O usuário selecionado já é o responsável pela empresa.';
  end if;

  select p.id
    into v_target_user_id
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_new_owner_id
    and p.role = 'merchant'
  for update of p;

  if v_target_user_id is null then
    raise exception using errcode = '22023', message = 'Novo responsável não encontrado ou não autorizado a possuir empresas.';
  end if;

  select p.full_name::text, u.email::text
    into v_previous_owner_name, v_previous_owner_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = v_previous_owner_id;

  select p.full_name::text, u.email::text
    into v_new_owner_name, v_new_owner_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = v_target_user_id;

  select count(*)::integer
    into v_previous_count
  from public.businesses
  where owner_id = v_previous_owner_id;

  select count(*)::integer
    into v_new_count
  from public.businesses
  where owner_id = v_target_user_id;

  v_new_allowed := private.allowed_business_count(v_target_user_id);

  if v_new_count >= v_new_allowed then
    raise exception using errcode = '23514',
      message = 'Limite de lojas atingido para a conta de destino. Transferência não realizada.';
  end if;

  select id
    into v_previous_claim_id
  from public.business_claim_requests
  where business_id = v_business.id
    and requester_id = v_previous_owner_id
    and status = 'approved'
  order by reviewed_at desc nulls last, id desc
  limit 1
  for update;

  select id
    into v_new_claim_id
  from public.business_claim_requests
  where business_id = v_business.id
    and requester_id = v_target_user_id
    and status = 'pending'
  order by created_at desc, id desc
  limit 1
  for update;

  update public.businesses
  set owner_id = v_target_user_id,
      pre_registered = false,
      billing_suspended = false,
      billing_suspension_reason = null,
      updated_at = now()
  where id = v_business.id
    and owner_id = v_previous_owner_id;

  if not found then
    raise exception using errcode = '40001', message = 'O responsável foi alterado por outra operação. Atualize a página.';
  end if;

  if v_previous_claim_id is not null then
    update public.business_claim_requests
    set status = 'revoked',
        admin_note = left('Transferência administrativa: ' || v_reason, 1000),
        reviewed_at = now(),
        reviewed_by = v_actor
    where id = v_previous_claim_id;
  end if;

  if v_new_claim_id is not null then
    update public.business_claim_requests
    set status = 'approved',
        admin_note = left('Transferência administrativa: ' || v_reason, 1000),
        reviewed_at = now(),
        reviewed_by = v_actor
    where id = v_new_claim_id;
  end if;

  update public.business_claim_requests
  set status = 'rejected',
      admin_note = 'Estabelecimento transferido administrativamente para outro usuário.',
      reviewed_at = now(),
      reviewed_by = v_actor
  where business_id = v_business.id
    and status = 'pending'
    and id is distinct from v_new_claim_id;

  perform private.reconcile_billing_entitlements(v_previous_owner_id);
  perform private.reconcile_billing_entitlements(v_target_user_id);

  insert into private.admin_business_owner_transfers (
    business_id,
    previous_owner_id,
    new_owner_id,
    previous_owner_name,
    previous_owner_email,
    new_owner_name,
    new_owner_email,
    admin_id,
    reason,
    previous_owner_businesses_before,
    new_owner_businesses_before,
    new_owner_allowed_businesses,
    previous_claim_request_id,
    new_claim_request_id
  )
  values (
    v_business.id,
    v_previous_owner_id,
    v_target_user_id,
    v_previous_owner_name,
    v_previous_owner_email,
    v_new_owner_name,
    v_new_owner_email,
    v_actor,
    v_reason,
    v_previous_count,
    v_new_count,
    v_new_allowed,
    v_previous_claim_id,
    v_new_claim_id
  )
  returning id into v_transfer_id;

  return v_transfer_id;
end;
$function$;

revoke all on function public.admin_transfer_business_owner(bigint, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_transfer_business_owner(bigint, uuid, text, text)
  to authenticated;

create or replace function public.admin_business_owner_transfer_history(
  p_business_id bigint,
  p_limit integer default 20
)
returns table(
  transfer_id bigint,
  business_id bigint,
  previous_owner_id uuid,
  new_owner_id uuid,
  previous_owner_name text,
  previous_owner_email text,
  new_owner_name text,
  new_owner_email text,
  reason text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then
    raise exception using errcode = '42501', message = 'Acesso negado.';
  end if;

  if p_business_id is null or p_business_id <= 0 then
    return;
  end if;

  return query
  select
    t.id,
    t.business_id,
    t.previous_owner_id,
    t.new_owner_id,
    t.previous_owner_name,
    t.previous_owner_email,
    t.new_owner_name,
    t.new_owner_email,
    t.reason,
    t.created_at
  from private.admin_business_owner_transfers t
  where t.business_id = p_business_id
  order by t.created_at desc, t.id desc
  limit v_limit;
end;
$function$;

revoke all on function public.admin_business_owner_transfer_history(bigint, integer)
  from public, anon, authenticated;
grant execute on function public.admin_business_owner_transfer_history(bigint, integer)
  to authenticated;

commit;
