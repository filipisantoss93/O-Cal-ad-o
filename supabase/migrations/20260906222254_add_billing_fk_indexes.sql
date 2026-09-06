create index if not exists billing_addons_product_code_idx
  on public.billing_addons (product_code);

create index if not exists subscriptions_plan_code_idx
  on public.subscriptions (plan_code);
