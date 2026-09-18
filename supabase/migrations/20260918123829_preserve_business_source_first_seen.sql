create or replace function private.preserve_business_source_found_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.found_at := old.found_at;
  end if;
  return new;
end;
$$;

revoke all on function private.preserve_business_source_found_at()
from public, anon, authenticated;

drop trigger if exists business_source_records_preserve_found_at
on public.business_source_records;

create trigger business_source_records_preserve_found_at
before update on public.business_source_records
for each row
execute function private.preserve_business_source_found_at();

comment on function private.preserve_business_source_found_at()
is 'Mantém found_at como a data da primeira descoberta; reimportações são registradas por updated_at e business_source_links.last_seen_at.';
