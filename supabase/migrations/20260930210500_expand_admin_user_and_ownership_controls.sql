begin;

alter table public.business_claim_requests
  drop constraint if exists business_claim_requests_status_check;

alter table public.business_claim_requests
  add constraint business_claim_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'revoked'));

alter table public.business_claim_requests
  drop constraint if exists business_claim_requests_review_state_check;

alter table public.business_claim_requests
  add constraint business_claim_requests_review_state_check check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (status in ('approved', 'rejected', 'revoked') and reviewed_at is not null and reviewed_by is not null)
  );

create table if not exists private.admin_business_owner_revocations (
  id bigint generated always as identity primary key,
  business_id bigint not null,
  previous_owner_id uuid not null,
  claim_request_id bigint,
  admin_id uuid not null,
  reason text not null check (char_length(btrim(reason)) between 5 and 1000),
  created_at timestamptz not null default now()
);

revoke all on table private.admin_business_owner_revocations from public, anon, authenticated;

create or replace function public.admin_revoke_business_ownership(
  p_business_id bigint,
  p_admin_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_business public.businesses%rowtype;
  v_claim public.business_claim_requests%rowtype;
  v_reason text := btrim(coalesce(p_admin_note, ''));
begin
  if v_actor is null or not (select private.is_admin()) then
    raise exception using errcode = '42501', message = 'Acesso negado.';
  end if;

  if p_business_id is null or p_business_id <= 0 then
    raise exception using errcode = '22023', message = 'Empresa inválida.';
  end if;

  if char_length(v_reason) < 5 or char_length(v_reason) > 1000 then
    raise exception using errcode = '22023', message = 'Informe o motivo da revogação com pelo menos 5 caracteres.';
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
    raise exception using errcode = '23514', message = 'Esta empresa já está sem responsável.';
  end if;

  select *
    into v_claim
  from public.business_claim_requests
  where business_id = v_business.id
    and requester_id = v_business.owner_id
    and status = 'approved'
  order by reviewed_at desc nulls last, id desc
  limit 1
  for update;

  update public.businesses
  set owner_id = null,
      pre_registered = true,
      billing_suspended = false,
      billing_suspension_reason = null,
      whatsapp_e164 = case
        when v_claim.id is not null and whatsapp_e164 = v_claim.whatsapp_e164 then null
        else whatsapp_e164
      end,
      updated_at = now()
  where id = v_business.id;

  if v_claim.id is not null then
    update public.business_claim_requests
    set status = 'revoked',
        admin_note = v_reason,
        reviewed_at = now(),
        reviewed_by = v_actor
    where id = v_claim.id;
  end if;

  update public.promotions
  set billing_suspended = true,
      billing_suspension_reason = 'ownership_revoked'
  where business_id = v_business.id
    and (
      billing_suspended is distinct from true
      or billing_suspension_reason is distinct from 'ownership_revoked'
    );

  perform private.reconcile_billing_entitlements(v_business.owner_id);

  insert into private.admin_business_owner_revocations
    (business_id, previous_owner_id, claim_request_id, admin_id, reason)
  values
    (v_business.id, v_business.owner_id, v_claim.id, v_actor, v_reason);
end;
$function$;

revoke all on function public.admin_revoke_business_ownership(bigint, text) from public, anon, authenticated;
grant execute on function public.admin_revoke_business_ownership(bigint, text) to authenticated;

create or replace function public.admin_search_users(
  p_query text default '',
  p_limit integer default 25
)
returns table(
  user_id uuid,
  full_name text,
  email text,
  phone_e164 text,
  role text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  banned_until timestamptz,
  used_businesses integer,
  allowed_businesses integer,
  subscription_plan text,
  subscription_status text,
  subscription_period_end timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_query text := btrim(coalesce(p_query, ''));
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 25);
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then
    raise exception using errcode = '42501', message = 'Acesso negado.';
  end if;

  if char_length(v_query) > 80 then
    raise exception using errcode = '22023', message = 'Pesquisa inválida.';
  end if;

  v_query := replace(replace(replace(v_query, '%', ''), '_', ''), chr(92), '');

  return query
  select
    p.id,
    p.full_name::text,
    u.email::text,
    p.phone_e164::text,
    p.role::text,
    p.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    u.banned_until,
    (select count(*)::integer from public.businesses b where b.owner_id = p.id),
    private.allowed_business_count(p.id),
    coalesce(s.plan_code, 'free')::text,
    coalesce(s.status, 'none')::text,
    s.current_period_end
  from public.profiles p
  join auth.users u on u.id = p.id
  left join lateral (
    select sub.plan_code, sub.status, sub.current_period_end
    from public.subscriptions sub
    where sub.user_id = p.id
    order by
      case sub.status
        when 'active' then 0
        when 'past_due' then 1
        when 'pending' then 2
        else 3
      end,
      sub.updated_at desc,
      sub.id desc
    limit 1
  ) s on true
  where
    v_query = ''
    or p.id::text = v_query
    or coalesce(p.full_name, '') ilike '%' || v_query || '%'
    or coalesce(u.email, '') ilike '%' || v_query || '%'
    or coalesce(p.phone_e164, '') ilike '%' || v_query || '%'
  order by
    case
      when v_query <> '' and (p.id::text = v_query or lower(coalesce(u.email, '')) = lower(v_query)) then 0
      else 1
    end,
    p.created_at desc,
    p.id
  limit v_limit;
end;
$function$;

revoke all on function public.admin_search_users(text, integer) from public, anon, authenticated;
grant execute on function public.admin_search_users(text, integer) to authenticated;

commit;
