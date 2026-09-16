alter table public.businesses
  add column if not exists pre_registered boolean not null default false;

alter table public.businesses
  drop constraint if exists businesses_listing_integrity_check;

alter table public.businesses
  add constraint businesses_listing_integrity_check check (
    (
      listing_type = 'business'
      and whatsapp_e164 is not null
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

create table if not exists public.business_claims (
  business_id bigint primary key references public.businesses(id) on delete cascade,
  claim_email text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null,
  constraint business_claims_email_check check (
    char_length(claim_email) <= 254
    and claim_email = lower(btrim(claim_email))
  ),
  constraint business_claims_claim_state_check check (
    (claimed_at is null and claimed_by is null)
    or (claimed_at is not null and claimed_by is not null)
  )
);

create index if not exists business_claims_pending_email_idx
  on public.business_claims (claim_email)
  where claimed_at is null;

alter table public.business_claims enable row level security;
grant select, insert, update, delete on table public.business_claims to authenticated;
revoke all on table public.business_claims from anon;

drop policy if exists business_claims_admin_manage on public.business_claims;
create policy business_claims_admin_manage
  on public.business_claims
  for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create or replace function private.claim_pre_registered_businesses(
  p_user_id uuid,
  p_email text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_claimed integer := 0;
begin
  if p_user_id is null or v_email = '' then
    return 0;
  end if;

  if not exists (
    select 1
    from auth.users u
    where u.id = p_user_id
      and lower(coalesce(u.email, '')) = v_email
      and u.email_confirmed_at is not null
  ) then
    return 0;
  end if;

  with claimed as (
    update public.businesses b
    set owner_id = p_user_id,
        pre_registered = false
    from public.business_claims bc
    where bc.business_id = b.id
      and bc.claim_email = v_email
      and bc.claimed_at is null
      and b.listing_type = 'business'
      and b.pre_registered = true
      and b.owner_id is null
    returning b.id
  )
  update public.business_claims bc
  set claimed_at = now(),
      claimed_by = p_user_id
  from claimed c
  where bc.business_id = c.id;

  get diagnostics v_claimed = row_count;

  if v_claimed > 0 then
    perform private.reconcile_billing_entitlements(p_user_id);
  end if;

  return v_claimed;
end;
$function$;

revoke all on function private.claim_pre_registered_businesses(uuid, text) from public;

create or replace function private.claim_pre_registered_business_after_claim_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_user_email text;
begin
  if new.claimed_at is not null then
    return new;
  end if;

  select u.id, u.email
    into v_user_id, v_user_email
  from auth.users u
  where lower(coalesce(u.email, '')) = new.claim_email
    and u.email_confirmed_at is not null
  order by u.created_at
  limit 1;

  if v_user_id is not null then
    perform private.claim_pre_registered_businesses(v_user_id, v_user_email);
  end if;

  return new;
end;
$function$;

drop trigger if exists business_claims_claim_existing_user on public.business_claims;
create trigger business_claims_claim_existing_user
after insert or update of claim_email on public.business_claims
for each row execute function private.claim_pre_registered_business_after_claim_change();

create or replace function private.claim_pre_registered_businesses_after_auth_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.email_confirmed_at is null or new.email is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform private.claim_pre_registered_businesses(new.id, new.email);
  elsif new.email is distinct from old.email
     or new.email_confirmed_at is distinct from old.email_confirmed_at then
    perform private.claim_pre_registered_businesses(new.id, new.email);
  end if;

  return new;
end;
$function$;

drop trigger if exists users_claim_pre_registered_businesses on auth.users;
create trigger users_claim_pre_registered_businesses
after insert or update of email, email_confirmed_at on auth.users
for each row execute function private.claim_pre_registered_businesses_after_auth_change();
