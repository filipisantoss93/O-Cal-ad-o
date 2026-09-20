-- Controlled, self-limiting automated pilot. Processes at most ten CNES
-- pages (200 upstream records) in Assis/SP; creates unpublished private listings.
-- A separate reviewed migration will be required for national expansion.
create or replace function private.dispatch_due_private_health_pilot()
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  selected_city bigint;
begin
  update public.public_place_import_jobs j
  set status='failed',
      last_error=coalesce(j.last_error,'Worker privado interrompido.'),
      next_run_at=now(),updated_at=now()
  from public.business_data_sources s
  where s.id=j.source_id and s.code='cnes_private_health'
    and j.status='processing'
    and j.last_run_at < now()-interval '20 minutes'
    and j.attempts < 5;

  update public.public_place_import_jobs j
  set status='paused', updated_at=now()
  from public.business_data_sources s
  where s.id=j.source_id and s.code='cnes_private_health'
    and j.status in ('processing','failed')
    and j.attempts >= 5;

  select j.city_id into selected_city
  from public.public_place_import_jobs j
  join public.business_data_sources s on s.id=j.source_id
  join public.cities c on c.id=j.city_id
  where s.code='cnes_private_health'
    and s.is_active=true
    and c.name='Assis' and c.state_code='SP'
    and j.status in ('pending','partial','failed')
    and j.attempts < 5
    and j.cursor_offset < 200
    and j.next_run_at<=now()
  order by j.id
  limit 1;

  if selected_city is null then return null; end if;
  return private.dispatch_national_private_health_import(selected_city,1);
end;
$function$;

revoke all on function private.dispatch_due_private_health_pilot()
  from public,anon,authenticated;
grant execute on function private.dispatch_due_private_health_pilot()
  to service_role;

select cron.unschedule(jobid)
from cron.job
where jobname='ocalcadao_private_health_assis_pilot';

select cron.schedule(
  'ocalcadao_private_health_assis_pilot',
  '*/5 * * * *',
  'select private.dispatch_due_private_health_pilot();'
);
