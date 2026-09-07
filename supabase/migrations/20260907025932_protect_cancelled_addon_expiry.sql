create or replace function private.expire_billing_periods()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.subscriptions
  set status = 'expired'
  where status = 'active'
    and current_period_end is not null
    and current_period_end <= now();

  update public.billing_addons
  set status = case when cancel_at_period_end then 'cancelled' else 'expired' end
  where status = 'active'
    and active_until is not null
    and active_until <= now();
end;
$$;

revoke all on function private.expire_billing_periods() from public;
