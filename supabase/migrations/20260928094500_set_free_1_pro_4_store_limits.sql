-- Correct the included store capacity for each plan.
-- The existing recurring store add-on applies above the Pro allowance.
update public.billing_plan_rules
set included_businesses = case code
  when 'free' then 1
  when 'pro' then 4
  else included_businesses
end,
updated_at = now()
where code in ('free', 'pro');

-- Recalculate access for existing accounts using the corrected limits.
select private.reconcile_billing_entitlements(u.id)
from auth.users u;
