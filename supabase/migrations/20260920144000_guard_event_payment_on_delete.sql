-- Impede que um pedido Efí ainda pagável perca o evento por ON DELETE CASCADE.
-- A proteção vale também para a exclusão da vitrine organizadora.
create or replace function private.guard_event_with_open_payment()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_open boolean;
begin
 if tg_table_name = 'events' then
   select exists(
     select 1 from public.event_highlights h where h.event_id=old.id
       and (
         (h.status='pending' and h.provider_charge_id is not null
          and (h.payment_expires_at is null or h.payment_expires_at>now()))
         or (h.status='active' and h.ends_at>now())
       )
   ) into v_open;
 elsif tg_table_name = 'businesses' then
   select exists(
     select 1 from public.events e
     join public.event_highlights h on h.event_id=e.id
     where e.business_id=old.id
       and (
         (h.status='pending' and h.provider_charge_id is not null
          and (h.payment_expires_at is null or h.payment_expires_at>now()))
         or (h.status='active' and h.ends_at>now())
       )
   ) into v_open;
 end if;
 if v_open then
   raise exception using errcode='23514',
     message='EVENT_HIGHLIGHT_PAYMENT_PENDING',
     detail='Não é permitido excluir evento ou vitrine com pagamento de destaque em aberto ou vigência ativa.';
 end if;
 return old;
end;
$$;
drop trigger if exists guard_event_open_payment_delete on public.events;
create trigger guard_event_open_payment_delete before delete on public.events
 for each row execute function private.guard_event_with_open_payment();
drop trigger if exists guard_business_event_open_payment_delete on public.businesses;
create trigger guard_business_event_open_payment_delete before delete on public.businesses
 for each row execute function private.guard_event_with_open_payment();
