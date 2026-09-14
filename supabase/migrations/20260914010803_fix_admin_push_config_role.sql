-- New API keys provide the role through the JWT claims JSON object.
create or replace function public.admin_push_config()
returns table (public_key text, private_key text, dispatch_token text)
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Acesso negado.';
  end if;
  return query select
    (select decrypted_secret from vault.decrypted_secrets where name = 'ocalcadao_vapid_public'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'ocalcadao_vapid_private'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'ocalcadao_push_dispatch_token');
end;
$$;
