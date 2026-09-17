begin;

alter table public.business_claim_requests
  add column if not exists whatsapp_e164 text;

alter table public.business_claim_requests
  drop constraint if exists business_claim_requests_whatsapp_check;

alter table public.business_claim_requests
  add constraint business_claim_requests_whatsapp_check
  check (whatsapp_e164 is null or whatsapp_e164 ~ '^[+][1-9][0-9]{7,14}$');

alter table public.business_claim_requests
  alter column whatsapp_e164 set not null;

drop policy if exists business_claim_requests_admin_manage on public.business_claim_requests;
drop policy if exists business_claim_requests_requester_insert on public.business_claim_requests;
drop policy if exists business_claim_requests_requester_read on public.business_claim_requests;

drop function if exists public.admin_review_business_claim(bigint, boolean, text);

create or replace function public.review_business_claim_request(
  p_request_id bigint,
  p_decision text,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request public.business_claim_requests%rowtype;
  v_business public.businesses%rowtype;
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then
    raise exception 'Acesso negado.';
  end if;

  if p_decision not in ('approve', 'reject') then
    raise exception 'Decisão inválida.';
  end if;

  select * into v_request
  from public.business_claim_requests
  where id = p_request_id
  for update;

  if not found or v_request.status <> 'pending' then
    raise exception 'Solicitação não está pendente.';
  end if;

  select * into v_business
  from public.businesses
  where id = v_request.business_id
  for update;

  if not found then
    raise exception 'Estabelecimento não encontrado.';
  end if;

  if p_decision = 'approve' then
    if v_business.pre_registered is not true or v_business.owner_id is not null then
      raise exception 'Este estabelecimento já foi reivindicado.';
    end if;

    update public.businesses
    set owner_id = v_request.requester_id,
        pre_registered = false,
        whatsapp_e164 = v_request.whatsapp_e164,
        updated_at = now()
    where id = v_business.id;

    update public.business_claim_requests
    set status = 'approved',
        admin_note = nullif(btrim(coalesce(p_admin_note, '')), ''),
        reviewed_at = now(),
        reviewed_by = (select auth.uid())
    where id = v_request.id;

    update public.business_claim_requests
    set status = 'rejected',
        admin_note = 'Outro pedido de reivindicação foi aprovado para este estabelecimento.',
        reviewed_at = now(),
        reviewed_by = (select auth.uid())
    where business_id = v_business.id
      and id <> v_request.id
      and status = 'pending';

    perform private.reconcile_billing_entitlements(v_request.requester_id);
  else
    update public.business_claim_requests
    set status = 'rejected',
        admin_note = nullif(btrim(coalesce(p_admin_note, '')), ''),
        reviewed_at = now(),
        reviewed_by = (select auth.uid())
    where id = v_request.id;
  end if;
end;
$function$;

revoke all on function public.review_business_claim_request(bigint, text, text) from public, anon;
grant execute on function public.review_business_claim_request(bigint, text, text) to authenticated;

commit;
