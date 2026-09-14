-- A record for support_messages has no business_id; evaluate each branch separately.
create or replace function private.limit_admin_inbox_submissions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'support_messages' then
    if exists (
      select 1 from public.support_messages where lower(email) = lower(new.email)
        and created_at > now() - interval '2 minutes'
    ) then
      raise exception using errcode = '23514', message = 'Aguarde alguns minutos antes de enviar outra mensagem.';
    end if;
  elsif tg_table_name = 'business_reports' then
    if exists (
      select 1 from public.business_reports where lower(email) = lower(new.email)
        and business_id = new.business_id and created_at > now() - interval '10 minutes'
    ) then
      raise exception using errcode = '23514', message = 'Aguarde antes de enviar outra denúncia desta loja.';
    end if;
  end if;
  return new;
end;
$$;
