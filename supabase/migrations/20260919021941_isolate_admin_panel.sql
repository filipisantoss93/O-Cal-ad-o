drop policy if exists admin_notifications_delete on public.admin_notifications;

alter table public.admin_notifications
  drop constraint if exists admin_notifications_destination_check;

update public.admin_notifications
set destination = replace(destination, '/painel/admin', '/admin')
where destination like '/painel/admin%';

alter table public.admin_notifications
  add constraint admin_notifications_destination_check
  check (
    destination = '/admin'
    or destination like '/admin/%'
    or destination like '/admin?%'
  );

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      join auth.users u on u.id = p.id
      where p.id = (select auth.uid())
        and p.role = 'admin'
        and lower(u.email) = 'filipi.01@live.com'
    );
$function$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

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
    replace(p_destination, '/painel/admin', '/admin')
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'admin'
    and lower(u.email) = 'filipi.01@live.com'
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
    '/admin/notificacoes?tipo=new_user'
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'admin'
    and lower(u.email) = 'filipi.01@live.com'
    and p.id <> new.id
  on conflict (recipient_id, event_type, source_id) do nothing;

  return new;
end;
$function$;

revoke all on function private.notify_admin_of_user()
  from public, anon, authenticated;

grant delete on public.admin_notifications to authenticated;

create policy admin_notifications_delete
on public.admin_notifications for delete
to authenticated
using (
  recipient_id = (select auth.uid())
  and (select private.is_admin())
);
