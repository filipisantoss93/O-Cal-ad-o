create or replace function private.dispatch_national_public_health_import(
  p_city_id bigint default null,
  p_max_pages integer default 5
)
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  dispatch_token text;
  request_id bigint;
  request_body jsonb;
begin
  select decrypted_secret
  into dispatch_token
  from vault.decrypted_secrets
  where name='ocalcadao_business_geocoding_token'
  limit 1;

  if nullif(dispatch_token,'') is null then
    raise exception using errcode='22023',message='Token interno indisponível.';
  end if;

  request_body := jsonb_build_object(
    'maxPages', greatest(1,least(coalesce(p_max_pages,5),10))
  );

  if p_city_id is not null then
    request_body := request_body || jsonb_build_object('cityId',p_city_id);
  end if;

  select net.http_post(
    url := 'https://mieekhdagjlzdbeklrxp.supabase.co/functions/v1/sync-national-public-health',
    body := request_body,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'X-Geocoding-Token',dispatch_token
    ),
    timeout_milliseconds := 55000
  ) into request_id;

  return request_id;
end;
$function$;

revoke all on function private.dispatch_national_public_health_import(bigint,integer)
  from public, anon, authenticated;
grant execute on function private.dispatch_national_public_health_import(bigint,integer)
  to service_role;
