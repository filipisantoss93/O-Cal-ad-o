alter table public.billing_plan_rules
  alter column included_catalog_items set default 4;

update public.billing_plan_rules
set included_catalog_items = 4
where code = 'free';
