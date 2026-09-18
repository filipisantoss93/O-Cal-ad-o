drop trigger if exists business_network_units_prioritize_geocoding
on public.business_network_units;

drop trigger if exists business_geocoding_queue_set_priority
on public.business_geocoding_queue;

drop function if exists private.set_network_geocoding_priority();
drop function if exists private.set_geocoding_queue_default_priority();

drop index if exists public.business_geocoding_queue_priority_due_idx;

alter table public.business_geocoding_queue
drop column if exists priority;

create or replace function private.expedite_network_geocoding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.business_geocoding_queue
  set next_attempt_at = least(next_attempt_at, timestamptz '2000-01-01 00:00:00+00'),
      updated_at = now()
  where business_id = new.business_id
    and status = 'pending'
    and attempts = 0;

  return new;
end;
$$;

revoke all on function private.expedite_network_geocoding()
from public, anon, authenticated;

create trigger business_network_units_expedite_geocoding
after insert or update of business_id, network_id
on public.business_network_units
for each row
execute function private.expedite_network_geocoding();

create or replace function private.expedite_network_queue_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending'
     and new.attempts = 0
     and exists (
       select 1
       from public.business_network_units u
       where u.business_id = new.business_id
     )
  then
    new.next_attempt_at := least(
      new.next_attempt_at,
      timestamptz '2000-01-01 00:00:00+00'
    );
  end if;

  return new;
end;
$$;

revoke all on function private.expedite_network_queue_on_insert()
from public, anon, authenticated;

create trigger business_geocoding_queue_expedite_network
before insert
on public.business_geocoding_queue
for each row
execute function private.expedite_network_queue_on_insert();

update public.business_geocoding_queue q
set next_attempt_at = timestamptz '2000-01-01 00:00:00+00',
    updated_at = now()
where q.status = 'pending'
  and q.attempts = 0
  and exists (
    select 1
    from public.business_network_units u
    where u.business_id = q.business_id
  );
