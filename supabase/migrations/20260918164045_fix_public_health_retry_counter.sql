create or replace function public.claim_public_place_import_job(
  p_source_code text,
  p_city_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  claimed jsonb;
begin
  with candidate as (
    select j.id
    from public.public_place_import_jobs j
    join public.business_data_sources s on s.id=j.source_id
    where s.code=p_source_code
      and s.is_active=true
      and j.status in ('pending','partial','failed')
      and j.attempts < 5
      and j.next_run_at <= now()
      and (p_city_id is null or j.city_id=p_city_id)
    order by j.priority desc,j.next_run_at asc,j.id asc
    for update of j skip locked
    limit 1
  ),
  updated as (
    update public.public_place_import_jobs j
    set status='processing',
        last_run_at=now(),
        started_at=coalesce(j.started_at,now()),
        updated_at=now(),
        last_error=null
    from candidate c
    where j.id=c.id
    returning j.*
  )
  select to_jsonb(updated.*)
  into claimed
  from updated;

  return claimed;
end;
$function$;

revoke all on function public.claim_public_place_import_job(text,bigint)
from public,anon,authenticated;
grant execute on function public.claim_public_place_import_job(text,bigint)
to service_role;

create or replace function private.dispatch_due_national_public_health_import()
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  due_count integer;
  dispatch_count integer;
  request_id bigint;
  i integer;
begin
  update public.public_place_import_jobs
  set attempts=attempts+1,
      status=case when attempts+1 >= 5 then 'paused' else 'failed' end,
      last_error=coalesce(last_error,'Worker interrompido antes de concluir.'),
      next_run_at=case
        when attempts+1 >= 5 then '2100-01-01T00:00:00Z'::timestamptz
        else now()
      end,
      updated_at=now()
  where status='processing'
    and last_run_at < now() - interval '20 minutes';

  select count(*)
  into due_count
  from public.public_place_import_jobs j
  join public.business_data_sources s on s.id=j.source_id
  where s.code='cnes_public_health'
    and j.status in ('pending','partial','failed')
    and j.attempts < 5
    and j.next_run_at <= now();

  dispatch_count := least(coalesce(due_count,0),3);

  if dispatch_count <= 0 then
    return null;
  end if;

  for i in 1..dispatch_count loop
    select private.dispatch_national_public_health_import(null,5)
    into request_id;
  end loop;

  return request_id;
end;
$function$;

revoke all on function private.dispatch_due_national_public_health_import()
from public,anon,authenticated;
grant execute on function private.dispatch_due_national_public_health_import()
to service_role;

update public.public_place_import_jobs
set attempts=0,updated_at=now()
where source_id=(select id from public.business_data_sources where code='cnes_public_health')
  and status in ('pending','partial');
