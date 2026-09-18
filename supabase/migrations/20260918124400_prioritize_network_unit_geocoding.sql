alter table public.business_geocoding_queue
add column if not exists priority smallint not null default 100
check (priority between 0 and 100);

create index if not exists business_geocoding_queue_priority_due_idx
on public.business_geocoding_queue (status, priority, next_attempt_at, created_at);

create or replace function private.set_network_geocoding_priority()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.business_geocoding_queue
  set priority = least(priority, 20),
      updated_at = now()
  where business_id = new.business_id;

  return new;
end;
$$;

revoke all on function private.set_network_geocoding_priority()
from public, anon, authenticated;

drop trigger if exists business_network_units_prioritize_geocoding
on public.business_network_units;

create trigger business_network_units_prioritize_geocoding
after insert or update of business_id, network_id
on public.business_network_units
for each row
execute function private.set_network_geocoding_priority();

create or replace function private.set_geocoding_queue_default_priority()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.business_network_units u
    where u.business_id = new.business_id
  ) then
    new.priority := least(coalesce(new.priority,100),20);
  end if;
  return new;
end;
$$;

revoke all on function private.set_geocoding_queue_default_priority()
from public, anon, authenticated;

drop trigger if exists business_geocoding_queue_set_priority
on public.business_geocoding_queue;

create trigger business_geocoding_queue_set_priority
before insert
on public.business_geocoding_queue
for each row
execute function private.set_geocoding_queue_default_priority();

update public.business_geocoding_queue q
set priority = 20,
    updated_at = now()
where exists (
  select 1
  from public.business_network_units u
  where u.business_id = q.business_id
);
