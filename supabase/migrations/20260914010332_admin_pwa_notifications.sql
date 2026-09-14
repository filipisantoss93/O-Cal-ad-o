-- Administrative inbox and Web Push outbox for the designated administrator.
create table public.support_messages (
  id bigint generated always as identity primary key,
  sender_id uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  email text not null check (char_length(email) between 5 and 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  subject text not null check (char_length(btrim(subject)) between 3 and 160),
  message text not null check (char_length(btrim(message)) between 10 and 4000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

create table public.business_reports (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  email text not null check (char_length(email) between 5 and 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  reason text not null check (reason in ('inaccurate', 'fraud', 'inappropriate', 'other')),
  details text not null check (char_length(btrim(details)) between 10 and 4000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

create table public.admin_notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('new_user', 'support', 'report')),
  source_id text not null,
  title text not null,
  body text not null,
  destination text not null check (destination like '/painel/admin%'),
  read_at timestamptz,
  pushed_at timestamptz,
  push_attempts integer not null default 0,
  created_at timestamptz not null default now(),
  unique (recipient_id, event_type, source_id)
);

create table public.admin_push_subscriptions (
  endpoint text primary key check (char_length(endpoint) between 20 and 2048 and endpoint like 'https://%'),
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null check (char_length(p256dh) between 20 and 512),
  auth text not null check (char_length(auth) between 10 and 512),
  created_at timestamptz not null default now()
);

create index admin_notifications_recipient_created on public.admin_notifications(recipient_id, created_at desc);
create index admin_notifications_push_pending on public.admin_notifications(created_at) where pushed_at is null;
create index admin_push_subscriptions_user on public.admin_push_subscriptions(user_id);
create index support_messages_created on public.support_messages(created_at desc);
create index business_reports_business_created on public.business_reports(business_id, created_at desc);

alter table public.support_messages enable row level security;
alter table public.business_reports enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.admin_push_subscriptions enable row level security;

grant insert on public.support_messages, public.business_reports to anon, authenticated;
grant select, update on public.support_messages, public.business_reports to authenticated;
grant select, update on public.admin_notifications to authenticated;
grant select, insert, update, delete on public.admin_push_subscriptions to authenticated;
grant usage, select on sequence public.support_messages_id_seq, public.business_reports_id_seq to anon, authenticated;

create policy support_submit on public.support_messages for insert to anon, authenticated
  with check (status = 'open' and sender_id is not distinct from (select auth.uid()));
create policy support_admin_select on public.support_messages for select to authenticated
  using ((select private.is_admin()));
create policy support_admin_update on public.support_messages for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy reports_submit on public.business_reports for insert to anon, authenticated
  with check (status = 'open' and sender_id is not distinct from (select auth.uid())
    and exists (select 1 from public.businesses b where b.id = business_id and b.publication_status = 'published'));
create policy reports_admin_select on public.business_reports for select to authenticated
  using ((select private.is_admin()));
create policy reports_admin_update on public.business_reports for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create or replace function private.limit_admin_inbox_submissions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'support_messages' and exists (
    select 1 from public.support_messages where lower(email) = lower(new.email)
      and created_at > now() - interval '2 minutes'
  ) then
    raise exception using errcode = '23514', message = 'Aguarde alguns minutos antes de enviar outra mensagem.';
  end if;
  if tg_table_name = 'business_reports' and exists (
    select 1 from public.business_reports where lower(email) = lower(new.email)
      and business_id = new.business_id and created_at > now() - interval '10 minutes'
  ) then
    raise exception using errcode = '23514', message = 'Aguarde antes de enviar outra denúncia desta loja.';
  end if;
  return new;
end;
$$;
revoke all on function private.limit_admin_inbox_submissions() from public, anon, authenticated;
create trigger limit_support_submissions before insert on public.support_messages
for each row execute function private.limit_admin_inbox_submissions();
create trigger limit_report_submissions before insert on public.business_reports
for each row execute function private.limit_admin_inbox_submissions();

create policy admin_notifications_read on public.admin_notifications for select to authenticated
  using (recipient_id = (select auth.uid()) and (select private.is_admin()));
create policy admin_notifications_mark_read on public.admin_notifications for update to authenticated
  using (recipient_id = (select auth.uid()) and (select private.is_admin()))
  with check (recipient_id = (select auth.uid()) and (select private.is_admin()));

create policy push_subscriptions_own_select on public.admin_push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_admin()));
create policy push_subscriptions_own_insert on public.admin_push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_admin()));
create policy push_subscriptions_own_update on public.admin_push_subscriptions for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_admin()))
  with check (user_id = (select auth.uid()) and (select private.is_admin()));
create policy push_subscriptions_own_delete on public.admin_push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.is_admin()));

-- Do not let clients spoof a sent push or edit the content/source of a notification.
create or replace function private.guard_admin_notification_update()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user::text not in ('postgres', 'service_role', 'supabase_admin') and
     (new.recipient_id, new.event_type, new.source_id, new.title, new.body, new.destination,
      new.created_at, new.pushed_at, new.push_attempts) is distinct from
     (old.recipient_id, old.event_type, old.source_id, old.title, old.body, old.destination,
      old.created_at, old.pushed_at, old.push_attempts) then
    raise exception using errcode = '42501', message = 'Somente a leitura pode ser alterada.';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_admin_notification_update() from public, anon, authenticated;
create trigger guard_admin_notification_update before update on public.admin_notifications
for each row execute function private.guard_admin_notification_update();

-- An asynchronous request never blocks signup or message/report submission.
-- The Vault secrets are provisioned after this migration; an inbox item is saved even without push configuration.
create or replace function private.queue_admin_push()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  dispatch_token text;
  project_url text;
begin
  select decrypted_secret into dispatch_token from vault.decrypted_secrets where name = 'ocalcadao_push_dispatch_token';
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'ocalcadao_push_project_url';
  if nullif(dispatch_token, '') is not null and nullif(project_url, '') is not null then
    perform net.http_post(
      url := rtrim(project_url, '/') || '/functions/v1/admin-push-dispatch',
      body := jsonb_build_object('id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Dispatch-Token', dispatch_token),
      timeout_milliseconds := 5000
    );
  end if;
  return new;
exception when others then
  -- Keep the durable inbox even if push transport is temporarily unavailable.
  return new;
end;
$$;
revoke all on function private.queue_admin_push() from public, anon, authenticated;
create trigger queue_admin_push after insert on public.admin_notifications
for each row execute function private.queue_admin_push();

create or replace function private.retry_pending_admin_push()
returns void language plpgsql security definer set search_path = '' as $$
declare
  dispatch_token text;
  project_url text;
  item record;
begin
  select decrypted_secret into dispatch_token from vault.decrypted_secrets where name = 'ocalcadao_push_dispatch_token';
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'ocalcadao_push_project_url';
  if nullif(dispatch_token, '') is null or nullif(project_url, '') is null then return; end if;
  for item in select id from public.admin_notifications
    where pushed_at is null and push_attempts < 5 and created_at > now() - interval '24 hours'
    order by created_at limit 20
  loop
    perform net.http_post(
      url := rtrim(project_url, '/') || '/functions/v1/admin-push-dispatch',
      body := jsonb_build_object('id', item.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Dispatch-Token', dispatch_token),
      timeout_milliseconds := 5000
    );
  end loop;
end;
$$;
revoke all on function private.retry_pending_admin_push() from public, anon, authenticated;
select cron.schedule('ocalcadao-admin-push-retry', '*/5 * * * *', $cron$select private.retry_pending_admin_push()$cron$);

create or replace function private.notify_admin_of_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.admin_notifications (recipient_id, event_type, source_id, title, body, destination)
  select u.id, 'new_user', new.id::text, 'Novo usuário cadastrado',
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), new.email, 'Novo cadastro'), 120),
    '/painel/admin/notificacoes?tipo=new_user'
  from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = 'filipi.01@live.com' and p.role = 'admin' and u.id <> new.id;
  return new;
end;
$$;
revoke all on function private.notify_admin_of_user() from public, anon, authenticated;
-- After on_auth_user_created so the profile of a newly created admin exists.
create trigger zzz_notify_admin_new_user after insert on auth.users
for each row execute function private.notify_admin_of_user();

create or replace function private.notify_admin_of_support()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.admin_notifications (recipient_id, event_type, source_id, title, body, destination)
  select u.id, 'support', new.id::text, 'Nova mensagem de suporte', left(new.subject, 120),
    '/painel/admin/notificacoes?tipo=support&id=' || new.id
  from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = 'filipi.01@live.com' and p.role = 'admin';
  return new;
end;
$$;
revoke all on function private.notify_admin_of_support() from public, anon, authenticated;
create trigger notify_admin_support after insert on public.support_messages
for each row execute function private.notify_admin_of_support();

create or replace function private.notify_admin_of_report()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.admin_notifications (recipient_id, event_type, source_id, title, body, destination)
  select u.id, 'report', new.id::text, 'Nova denúncia de loja', left(b.name, 120),
    '/painel/admin/notificacoes?tipo=report&id=' || new.id
  from auth.users u join public.profiles p on p.id = u.id
  join public.businesses b on b.id = new.business_id
  where lower(u.email) = 'filipi.01@live.com' and p.role = 'admin';
  return new;
end;
$$;
revoke all on function private.notify_admin_of_report() from public, anon, authenticated;
create trigger notify_admin_report after insert on public.business_reports
for each row execute function private.notify_admin_of_report();

-- Only the Edge Function's service role can retrieve the Web Push signing keys and dispatch token.
create or replace function public.admin_push_config()
returns table (public_key text, private_key text, dispatch_token text)
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Acesso negado.';
  end if;
  return query select
    (select decrypted_secret from vault.decrypted_secrets where name = 'ocalcadao_vapid_public'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'ocalcadao_vapid_private'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'ocalcadao_push_dispatch_token');
end;
$$;
revoke all on function public.admin_push_config() from public, anon, authenticated;
grant execute on function public.admin_push_config() to service_role;

create or replace function public.admin_vapid_public_key()
returns text language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'Acesso negado.';
  end if;
  return (select decrypted_secret from vault.decrypted_secrets where name = 'ocalcadao_vapid_public');
end;
$$;
revoke all on function public.admin_vapid_public_key() from public, anon;
grant execute on function public.admin_vapid_public_key() to authenticated;

-- Realtime may use its table publication to update the administrative inbox while open.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_notifications') then
    alter publication supabase_realtime add table public.admin_notifications;
  end if;
end $$;
