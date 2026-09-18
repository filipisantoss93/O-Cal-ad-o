create or replace function private.dispatch_due_national_public_health_import()
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  has_due boolean;
  request_id bigint;
begin
  update public.public_place_import_jobs
  set status='failed',
      last_error=coalesce(last_error,'Worker interrompido antes de concluir.'),
      next_run_at=now(),
      updated_at=now()
  where status='processing'
    and last_run_at < now() - interval '20 minutes'
    and attempts < 5;

  update public.public_place_import_jobs
  set status='paused',
      updated_at=now()
  where status in ('failed','processing')
    and attempts >= 5;

  select exists(
    select 1
    from public.public_place_import_jobs j
    join public.business_data_sources s on s.id=j.source_id
    where s.code='cnes_public_health'
      and j.status in ('pending','partial','failed')
      and j.attempts < 5
      and j.next_run_at <= now()
  ) into has_due;

  if not has_due then
    return null;
  end if;

  select private.dispatch_national_public_health_import(null,5)
  into request_id;

  return request_id;
end;
$function$;

revoke all on function private.dispatch_due_national_public_health_import()
  from public, anon, authenticated;
grant execute on function private.dispatch_due_national_public_health_import()
  to service_role;

select cron.unschedule(jobid)
from cron.job
where jobname='ocalcadao_national_public_health_import';

select cron.schedule(
  'ocalcadao_national_public_health_import',
  '* * * * *',
  'select private.dispatch_due_national_public_health_import();'
);
