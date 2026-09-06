alter table public.billing_addons
  add column payment_method text not null default 'credit_card'
    check (payment_method in ('credit_card', 'pix_auto', 'pix')),
  add column provider_plan_id text,
  add column provider_subscription_id text;

create unique index billing_addons_provider_subscription_uidx
  on public.billing_addons(provider, provider_subscription_id)
  where provider_subscription_id is not null;

create unique index billing_addons_provider_charge_uidx
  on public.billing_addons(provider, provider_charge_id)
  where provider_charge_id is not null;

create table public.billing_provider_events (
  event_key text primary key,
  provider text not null check (provider = 'efi'),
  provider_event_id text,
  event_type text,
  payload jsonb,
  processed_at timestamptz not null default now()
);

alter table public.billing_provider_events enable row level security;
revoke all on public.billing_provider_events from anon, authenticated;

create or replace function private.add_months_from_now(p_months integer)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now() + make_interval(months => p_months);
$$;

revoke all on function private.add_months_from_now(integer) from public;
