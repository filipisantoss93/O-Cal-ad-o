create or replace function private.dispatch_smartfit_network_sync(p_payload jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_request_id bigint;
begin
  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name='ocalcadao_business_geocoding_token'
  limit 1;

  if nullif(v_token,'') is null then
    raise exception 'Token interno indisponivel.';
  end if;

  select net.http_post(
    url := 'https://mieekhdagjlzdbeklrxp.supabase.co/functions/v1/sync-smartfit-network',
    body := coalesce(p_payload,'{}'::jsonb),
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'X-Network-Sync-Token',v_token
    ),
    timeout_milliseconds := 120000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.dispatch_smartfit_network_sync(jsonb)
from public, anon, authenticated;

comment on function private.dispatch_smartfit_network_sync(jsonb)
is 'Dispara sincronizacao nacional ou por UF das unidades Smart Fit usando o localizador oficial.';
