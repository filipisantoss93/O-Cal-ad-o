create or replace function private.dispatch_mcdonalds_network_sync(
  p_seed_missing_only boolean default true,
  p_max_cities integer default 500
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_request_id bigint;
begin
  select decrypted_secret
    into v_token
  from vault.decrypted_secrets
  where name='ocalcadao_business_geocoding_token'
  limit 1;

  if nullif(v_token,'') is null then
    raise exception 'Token interno indisponivel.';
  end if;

  select net.http_post(
    url := 'https://mieekhdagjlzdbeklrxp.supabase.co/functions/v1/sync-mcdonalds-network',
    body := jsonb_build_object(
      'seed_missing_only', p_seed_missing_only,
      'max_cities', greatest(1,least(coalesce(p_max_cities,500),500))
    ),
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'X-Network-Sync-Token',v_token
    ),
    timeout_milliseconds := 120000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.dispatch_mcdonalds_network_sync(boolean,integer)
from public, anon, authenticated;

comment on function private.dispatch_mcdonalds_network_sync(boolean,integer)
is 'Dispara a sincronizacao nacional do McDonalds a partir da fonte oficial, sem SQL especifico por cidade.';
