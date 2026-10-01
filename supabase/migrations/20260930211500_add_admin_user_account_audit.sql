begin;

create table public.admin_user_account_actions (
  id bigint generated always as identity primary key,
  admin_id uuid not null references auth.users(id) on delete restrict,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('email_changed', 'suspended', 'reactivated')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_user_account_actions_target_idx
  on public.admin_user_account_actions (target_user_id, created_at desc);

alter table public.admin_user_account_actions enable row level security;

revoke all on table public.admin_user_account_actions from public, anon, authenticated;
grant select on table public.admin_user_account_actions to authenticated;
grant insert on table public.admin_user_account_actions to service_role;

create policy admin_user_account_actions_admin_read
  on public.admin_user_account_actions
  for select
  to authenticated
  using ((select private.is_admin()));

commit;
