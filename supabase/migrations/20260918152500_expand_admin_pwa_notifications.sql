begin;

alter table public.admin_notifications
  drop constraint if exists admin_notifications_event_type_check;

alter table public.admin_notifications
  add constraint admin_notifications_event_type_check
  check (
    event_type in (
      'new_user',
      'support',
      'report',
      'business_claim',
      'listing_request',
      'business_moderation',
      'banner_review'
    )
  );

create or replace function private.enqueue_admin_notification(
  p_event_type text,
  p_source_id text,
  p_title text,
  p_body text,
  p_destination text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.admin_notifications (
    recipient_id,
    event_type,
    source_id,
    title,
    body,
    destination
  )
  select
    p.id,
    p_event_type,
    p_source_id,
    p_title,
    p_body,
    p_destination
  from public.profiles p
  where p.role = 'admin'
  on conflict (recipient_id, event_type, source_id) do nothing;
end;
$function$;

revoke all on function private.enqueue_admin_notification(text, text, text, text, text)
  from public, anon, authenticated;

create or replace function private.notify_admin_of_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return new;
  end if;

  insert into public.admin_notifications (
    recipient_id,
    event_type,
    source_id,
    title,
    body,
    destination
  )
  select
    p.id,
    'new_user',
    new.id::text,
    'Novo usuário confirmado',
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        new.email,
        'Novo cadastro'
      ),
      120
    ),
    '/painel/admin/notificacoes?tipo=new_user'
  from public.profiles p
  where p.role = 'admin'
    and p.id <> new.id
  on conflict (recipient_id, event_type, source_id) do nothing;

  return new;
end;
$function$;

revoke all on function private.notify_admin_of_user()
  from public, anon, authenticated;

drop trigger if exists zzz_notify_admin_new_user on auth.users;
create trigger zzz_notify_admin_new_user
after insert or update of email_confirmed_at on auth.users
for each row execute function private.notify_admin_of_user();

create or replace function private.notify_admin_of_support()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.enqueue_admin_notification(
    'support',
    new.id::text,
    'Nova mensagem de suporte',
    left(new.subject, 120),
    '/painel/admin/notificacoes?tipo=support&id=' || new.id
  );
  return new;
end;
$function$;

revoke all on function private.notify_admin_of_support()
  from public, anon, authenticated;

create or replace function private.notify_admin_of_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_business_name text;
begin
  select b.name
  into v_business_name
  from public.businesses b
  where b.id = new.business_id;

  perform private.enqueue_admin_notification(
    'report',
    new.id::text,
    'Nova denúncia de loja',
    left(coalesce(v_business_name, 'Estabelecimento'), 120),
    '/painel/admin/notificacoes?tipo=report&id=' || new.id
  );
  return new;
end;
$function$;

revoke all on function private.notify_admin_of_report()
  from public, anon, authenticated;

create or replace function private.notify_admin_of_business_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_business_name text;
begin
  select b.name
  into v_business_name
  from public.businesses b
  where b.id = new.business_id;

  perform private.enqueue_admin_notification(
    'business_claim',
    new.id::text,
    'Nova reivindicação de estabelecimento',
    left(
      coalesce(v_business_name, 'Estabelecimento') || ' · ' || new.requester_name,
      220
    ),
    '/painel/admin/reivindicacoes'
  );
  return new;
end;
$function$;

revoke all on function private.notify_admin_of_business_claim()
  from public, anon, authenticated;

drop trigger if exists notify_admin_business_claim on public.business_claim_requests;
create trigger notify_admin_business_claim
after insert on public.business_claim_requests
for each row execute function private.notify_admin_of_business_claim();

create or replace function private.notify_admin_of_listing_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_business_name text;
  v_title text;
begin
  select b.name
  into v_business_name
  from public.businesses b
  where b.id = new.business_id;

  v_title := case new.request_type
    when 'correction' then 'Nova solicitação de correção'
    when 'update' then 'Nova solicitação de atualização'
    when 'removal' then 'Nova solicitação de remoção'
    else 'Nova solicitação sobre estabelecimento'
  end;

  perform private.enqueue_admin_notification(
    'listing_request',
    new.id::text,
    v_title,
    left(coalesce(v_business_name, 'Estabelecimento'), 220),
    '/painel/admin/reivindicacoes'
  );
  return new;
end;
$function$;

revoke all on function private.notify_admin_of_listing_request()
  from public, anon, authenticated;

drop trigger if exists notify_admin_listing_request on public.business_listing_requests;
create trigger notify_admin_listing_request
after insert on public.business_listing_requests
for each row execute function private.notify_admin_of_listing_request();

create or replace function private.notify_admin_of_business_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.listing_type <> 'business'
    or new.owner_id is null
    or new.pre_registered
    or new.status <> 'pending'
  then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'pending' then
    return new;
  end if;

  perform private.enqueue_admin_notification(
    'business_moderation',
    new.id::text || ':' || txid_current()::text,
    'Loja aguardando moderação',
    left(new.name, 220),
    '/painel/admin?status=pending'
  );
  return new;
end;
$function$;

revoke all on function private.notify_admin_of_business_moderation()
  from public, anon, authenticated;

drop trigger if exists notify_admin_business_moderation on public.businesses;
create trigger notify_admin_business_moderation
after insert or update of status on public.businesses
for each row execute function private.notify_admin_of_business_moderation();

create or replace function private.notify_admin_of_banner_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_business_name text;
begin
  if new.placement <> 'banner'
    or new.creative_status <> 'pending'
    or new.status <> 'paused'
    or new.pause_reason <> 'creative_review'
  then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.creative_status = new.creative_status
    and old.status = new.status
    and old.pause_reason is not distinct from new.pause_reason
  then
    return new;
  end if;

  select b.name
  into v_business_name
  from public.businesses b
  where b.id = new.business_id;

  perform private.enqueue_admin_notification(
    'banner_review',
    new.id::text || ':' || txid_current()::text,
    'Banner aguardando revisão',
    left(coalesce(v_business_name, 'Estabelecimento'), 220),
    '/painel/admin/destaques'
  );
  return new;
end;
$function$;

revoke all on function private.notify_admin_of_banner_review()
  from public, anon, authenticated;

drop trigger if exists notify_admin_banner_review on public.highlight_campaigns;
create trigger notify_admin_banner_review
after insert or update of status, creative_status, pause_reason
on public.highlight_campaigns
for each row execute function private.notify_admin_of_banner_review();

-- Recover administrative requests created before these triggers existed.
insert into public.admin_notifications (
  recipient_id,
  event_type,
  source_id,
  title,
  body,
  destination
)
select
  p.id,
  'business_claim',
  r.id::text,
  'Nova reivindicação de estabelecimento',
  left(coalesce(b.name, 'Estabelecimento') || ' · ' || r.requester_name, 220),
  '/painel/admin/reivindicacoes'
from public.business_claim_requests r
join public.businesses b on b.id = r.business_id
cross join public.profiles p
where p.role = 'admin'
  and r.status = 'pending'
on conflict (recipient_id, event_type, source_id) do nothing;

insert into public.admin_notifications (
  recipient_id,
  event_type,
  source_id,
  title,
  body,
  destination
)
select
  p.id,
  'listing_request',
  r.id::text,
  case r.request_type
    when 'correction' then 'Nova solicitação de correção'
    when 'update' then 'Nova solicitação de atualização'
    when 'removal' then 'Nova solicitação de remoção'
    else 'Nova solicitação sobre estabelecimento'
  end,
  left(coalesce(b.name, 'Estabelecimento'), 220),
  '/painel/admin/reivindicacoes'
from public.business_listing_requests r
join public.businesses b on b.id = r.business_id
cross join public.profiles p
where p.role = 'admin'
  and r.status = 'pending'
on conflict (recipient_id, event_type, source_id) do nothing;

commit;
