-- Update the included store capacity for each plan. Extra Pro store slots
-- continue using the existing recurring product price (R$ 9,90 per month).
update public.billing_plan_rules
set included_businesses = case code
  when 'free' then 3
  when 'pro' then 10
  else included_businesses
end,
updated_at = now()
where code in ('free', 'pro');

-- Recalculate access for existing accounts using the new limits.
select private.reconcile_billing_entitlements(u.id)
from auth.users u;
