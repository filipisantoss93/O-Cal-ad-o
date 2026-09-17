create table if not exists public.business_geocoding_queue (
  business_id bigint primary key references public.businesses(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'failed')),
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 100),
  next_attempt_at timestamptz not null default now(),
  last_error text null check (last_error is null or char_length(last_error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_geocoding_queue enable row level security;
revoke all on table public.business_geocoding_queue from anon, authenticated;
grant select, insert, update, delete on table public.business_geocoding_queue to service_role;

create index if not exists business_geocoding_queue_due_idx
  on public.business_geocoding_queue (status, next_attempt_at, created_at);

comment on table public.business_geocoding_queue is
  'Fila interna para geocodificar automaticamente vitrines comerciais sem latitude/longitude.';

create or replace function private.clear_business_coordinates_on_address_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (
    new.city_id is distinct from old.city_id
    or new.street is distinct from old.street
    or new.address_number is distinct from old.address_number
    or new.neighborhood is distinct from old.neighborhood
    or new.postal_code is distinct from old.postal_code
  )
  and new.latitude is not distinct from old.latitude
  and new.longitude is not distinct from old.longitude
  then
    new.latitude := null;
    new.longitude := null;
  end if;

  return new;
end;
$$;

revoke all on function private.clear_business_coordinates_on_address_change() from public, anon, authenticated;

drop trigger if exists businesses_clear_stale_coordinates on public.businesses;
create trigger businesses_clear_stale_coordinates
before update of city_id, street, address_number, neighborhood, postal_code
on public.businesses
for each row
execute function private.clear_business_coordinates_on_address_change();

create or replace function private.sync_business_geocoding_queue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  address_changed boolean := true;
begin
  if new.listing_type <> 'business' then
    delete from public.business_geocoding_queue where business_id = new.id;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    address_changed :=
      new.city_id is distinct from old.city_id
      or new.street is distinct from old.street
      or new.address_number is distinct from old.address_number
      or new.neighborhood is distinct from old.neighborhood
      or new.postal_code is distinct from old.postal_code;
  end if;

  if new.latitude is not null and new.longitude is not null then
    delete from public.business_geocoding_queue where business_id = new.id;
    return new;
  end if;

  if nullif(btrim(new.street), '') is null
     or nullif(btrim(new.address_number), '') is null
     or nullif(btrim(new.neighborhood), '') is null
  then
    return new;
  end if;

  if tg_op = 'INSERT' or address_changed then
    insert into public.business_geocoding_queue (
      business_id, status, attempts, next_attempt_at, last_error, created_at, updated_at
    ) values (
      new.id, 'pending', 0, now(), null, now(), now()
    )
    on conflict (business_id) do update set
      status = 'pending',
      attempts = 0,
      next_attempt_at = now(),
      last_error = null,
      updated_at = now();
  else
    insert into public.business_geocoding_queue (business_id)
    values (new.id)
    on conflict (business_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_business_geocoding_queue() from public, anon, authenticated;

drop trigger if exists businesses_enqueue_geocoding_insert on public.businesses;
create trigger businesses_enqueue_geocoding_insert
after insert on public.businesses
for each row
execute function private.sync_business_geocoding_queue();

drop trigger if exists businesses_enqueue_geocoding_update on public.businesses;
create trigger businesses_enqueue_geocoding_update
after update of listing_type, city_id, street, address_number, neighborhood, postal_code, latitude, longitude
on public.businesses
for each row
execute function private.sync_business_geocoding_queue();

create or replace function private.dispatch_business_geocoding()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  dispatch_token text;
begin
  select decrypted_secret
    into dispatch_token
  from vault.decrypted_secrets
  where name = 'ocalcadao_business_geocoding_token'
  limit 1;

  if nullif(dispatch_token, '') is null then
    return;
  end if;

  perform net.http_post(
    url := 'https://mieekhdagjlzdbeklrxp.supabase.co/functions/v1/geocode-businesses',
    body := jsonb_build_object('limit', 8),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Geocoding-Token', dispatch_token
    ),
    timeout_milliseconds := 55000
  );
end;
$$;

revoke all on function private.dispatch_business_geocoding() from public, anon, authenticated;

insert into public.business_geocoding_queue (business_id)
select b.id
from public.businesses b
where b.listing_type = 'business'
  and (b.latitude is null or b.longitude is null)
on conflict (business_id) do nothing;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'ocalcadao-business-geocoding'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'ocalcadao-business-geocoding',
    '* * * * *',
    'select private.dispatch_business_geocoding();'
  );
end;
$$;