begin;

alter table public.businesses
  drop constraint if exists businesses_listing_integrity_check;

alter table public.businesses
  add constraint businesses_listing_integrity_check check (
    (
      listing_type = 'business'
      and public_place_kind is null
      and (
        (pre_registered = false and owner_id is not null)
        or (pre_registered = true and owner_id is null)
      )
    )
    or (
      listing_type = 'public_place'
      and owner_id is null
      and public_place_kind is not null
      and pre_registered = false
      and plan = 'free'
      and featured_until is null
    )
  );

alter table public.businesses
  add column if not exists data_source_url text
    check (data_source_url is null or char_length(data_source_url) <= 1000),
  add column if not exists data_source_checked_at timestamptz;

create table if not exists public.business_claim_requests (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  requester_name text not null check (char_length(btrim(requester_name)) between 2 and 120),
  requester_email text not null check (
    char_length(requester_email) <= 254
    and requester_email = lower(btrim(requester_email))
  ),
  relationship text not null check (relationship in ('owner', 'manager', 'employee', 'agency', 'other')),
  evidence text not null check (char_length(btrim(evidence)) between 10 and 1500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_claim_requests_review_state_check check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (status in ('approved', 'rejected') and reviewed_at is not null and reviewed_by is not null)
  )
);

create unique index if not exists business_claim_requests_pending_user_idx
  on public.business_claim_requests (business_id, requester_id)
  where status = 'pending';

create index if not exists business_claim_requests_admin_idx
  on public.business_claim_requests (status, created_at desc);

create table if not exists public.business_listing_requests (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  requester_id uuid references auth.users(id) on delete set null,
  requester_name text not null check (char_length(btrim(requester_name)) between 2 and 120),
  requester_email text not null check (
    char_length(requester_email) <= 254
    and requester_email = lower(btrim(requester_email))
  ),
  request_type text not null check (request_type in ('correction', 'update', 'removal')),
  details text not null check (char_length(btrim(details)) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending', 'resolved', 'rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_listing_requests_review_state_check check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (status in ('resolved', 'rejected') and reviewed_at is not null and reviewed_by is not null)
  )
);

create index if not exists business_listing_requests_admin_idx
  on public.business_listing_requests (status, created_at desc);

alter table public.business_claim_requests enable row level security;
alter table public.business_listing_requests enable row level security;

revoke all on table public.business_claim_requests from anon, authenticated;
grant select, insert on table public.business_claim_requests to authenticated;

revoke all on table public.business_listing_requests from anon, authenticated;
grant insert on table public.business_listing_requests to anon, authenticated;
grant select on table public.business_listing_requests to authenticated;

drop policy if exists business_claim_requests_owner_read on public.business_claim_requests;
create policy business_claim_requests_owner_read
  on public.business_claim_requests for select
  to authenticated
  using ((select auth.uid()) = requester_id);

drop policy if exists business_claim_requests_admin_read on public.business_claim_requests;
create policy business_claim_requests_admin_read
  on public.business_claim_requests for select
  to authenticated
  using ((select private.is_admin()));

drop policy if exists business_claim_requests_owner_insert on public.business_claim_requests;
create policy business_claim_requests_owner_insert
  on public.business_claim_requests for insert
  to authenticated
  with check (
    (select auth.uid()) = requester_id
    and status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
    and exists (
      select 1
      from public.businesses b
      where b.id = business_id
        and b.listing_type = 'business'
        and b.pre_registered = true
        and b.owner_id is null
        and b.is_active = true
    )
  );

drop policy if exists business_listing_requests_owner_read on public.business_listing_requests;
create policy business_listing_requests_owner_read
  on public.business_listing_requests for select
  to authenticated
  using ((select auth.uid()) = requester_id);

drop policy if exists business_listing_requests_admin_read on public.business_listing_requests;
create policy business_listing_requests_admin_read
  on public.business_listing_requests for select
  to authenticated
  using ((select private.is_admin()));

drop policy if exists business_listing_requests_public_insert on public.business_listing_requests;
create policy business_listing_requests_public_insert
  on public.business_listing_requests for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
    and (requester_id is null or requester_id = (select auth.uid()))
    and exists (
      select 1
      from public.businesses b
      where b.id = business_id
        and b.listing_type = 'business'
        and b.pre_registered = true
        and b.owner_id is null
        and b.is_active = true
    )
  );

drop trigger if exists business_claim_requests_set_updated_at on public.business_claim_requests;
create trigger business_claim_requests_set_updated_at
before update on public.business_claim_requests
for each row execute function private.set_updated_at();

drop trigger if exists business_listing_requests_set_updated_at on public.business_listing_requests;
create trigger business_listing_requests_set_updated_at
before update on public.business_listing_requests
for each row execute function private.set_updated_at();

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

  select *
    into v_request
  from public.business_claim_requests
  where id = p_request_id
  for update;

  if not found or v_request.status <> 'pending' then
    raise exception 'Solicitação não está pendente.';
  end if;

  select *
    into v_business
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

create or replace function public.review_business_listing_request(
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
  v_request public.business_listing_requests%rowtype;
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then
    raise exception 'Acesso negado.';
  end if;

  if p_decision not in ('resolve', 'reject', 'remove') then
    raise exception 'Decisão inválida.';
  end if;

  select *
    into v_request
  from public.business_listing_requests
  where id = p_request_id
  for update;

  if not found or v_request.status <> 'pending' then
    raise exception 'Solicitação não está pendente.';
  end if;

  if p_decision = 'remove' then
    update public.businesses
    set publication_status = 'unpublished',
        is_active = false,
        updated_at = now()
    where id = v_request.business_id
      and pre_registered = true
      and owner_id is null;
  end if;

  update public.business_listing_requests
  set status = case when p_decision = 'reject' then 'rejected' else 'resolved' end,
      admin_note = nullif(btrim(coalesce(p_admin_note, '')), ''),
      reviewed_at = now(),
      reviewed_by = (select auth.uid())
  where id = v_request.id;
end;
$function$;

revoke all on function public.review_business_listing_request(bigint, text, text) from public, anon;
grant execute on function public.review_business_listing_request(bigint, text, text) to authenticated;

commit;
