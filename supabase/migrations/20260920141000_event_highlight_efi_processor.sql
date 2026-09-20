-- Confirmação de pagamento exclusivamente a partir do webhook que consultou a notificação na Efí.
-- Executar apenas como service_role; comerciantes não conseguem promover destaques.
create or replace function public.process_efi_event_highlight_payment(
 p_charge_id text, p_status text, p_custom_id text default null
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
 v_request public.event_highlights%rowtype;
 v_event public.events%rowtype;
 v_business public.businesses%rowtype;
 v_product public.event_highlight_packages%rowtype;
 v_now timestamptz := now();
 v_ends timestamptz;
begin
 if current_user::text not in ('postgres','service_role','supabase_admin') then
   raise exception using errcode='42501',message='Acesso negado ao processamento de destaque de eventos.';
 end if;
 if nullif(btrim(p_charge_id),'') is null then return false; end if;
 select * into v_request from public.event_highlights
 where provider_charge_id=p_charge_id for update;
 if not found then return false; end if;
 if p_custom_id is not null
   and p_custom_id <> ('ocalcadao_event_' || v_request.id::text) then
   raise exception 'Referência de cobrança do evento divergente.';
 end if;

 if lower(coalesce(p_status,'')) in ('paid','settled') then
   if v_request.status <> 'pending' then return false; end if;
   select * into v_event from public.events where id=v_request.event_id;
   select * into v_product from public.event_highlight_packages where code=v_request.product_code;
   if v_event.id is null or v_product.code is null
      or v_request.quoted_price_cents is null or v_request.quoted_price_cents <= 0 then
     raise exception 'Pedido de destaque de evento inválido para cobrança %',p_charge_id;
   end if;
   select * into v_business from public.businesses where id=v_event.business_id;
   if v_business.id is null or v_business.city_id<>v_event.city_id or v_business.owner_id is distinct from v_request.requester_id
      or v_business.listing_type<>'business' or not v_business.is_active
      or v_business.billing_suspended or v_business.publication_status<>'published'
      or not v_event.is_active or coalesce(v_event.ends_at,v_event.starts_at)<=v_now then
      -- Pagamento registrado mas sem exibir evento inelegível; tratar estorno pelo admin.
      update public.event_highlights
      set status='cancelled', paid_at=v_now,
          payment_reference='efi:'||p_charge_id,
          amount_paid_cents=v_request.quoted_price_cents, updated_at=v_now
      where id=v_request.id and status='pending';
      return false;
   end if;
   v_ends := least(v_now + make_interval(days=>v_product.duration_days),coalesce(v_event.ends_at,v_event.starts_at));
   if v_ends<=v_now then return false; end if;
   update public.event_highlights set status='active',
     amount_paid_cents=v_request.quoted_price_cents,
     payment_reference='efi:'||p_charge_id, paid_at=v_now,
     starts_at=v_now, ends_at=v_ends, updated_at=v_now
   where id=v_request.id and status='pending';
   return found;
 elsif lower(coalesce(p_status,'')) in ('refunded','contested','canceled','cancelled') then
   update public.event_highlights set status='cancelled',updated_at=v_now
    where id=v_request.id and status in ('active','pending');
   return found;
 elsif lower(coalesce(p_status,'')) = 'unpaid' then
   -- Um link criado pode emitir "unpaid" antes de o cliente realizar o pagamento.
   -- Não cancelar a reserva pendente, só retirar destaque que já estava ativo.
   update public.event_highlights set status='cancelled',updated_at=v_now
    where id=v_request.id and status='active';
   return found;
 end if;
 return false;
end;
$$;
revoke all on function public.process_efi_event_highlight_payment(text,text,text) from public,anon,authenticated;
grant execute on function public.process_efi_event_highlight_payment(text,text,text) to service_role;
comment on function public.process_efi_event_highlight_payment(text,text,text) is
 'Somente serviço Efí verificado pode ativar ou cancelar destaque pago. Idempotente por cobrança e status.';
