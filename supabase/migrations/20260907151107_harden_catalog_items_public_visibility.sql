drop policy if exists catalog_items_public_read on public.catalog_items;

create policy catalog_items_public_read
on public.catalog_items
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.businesses b
    where b.id = catalog_items.business_id
      and b.status = 'approved'
      and b.is_active = true
      and b.billing_suspended = false
      and exists (
        select 1
        from public.cities c
        where c.id = b.city_id
          and c.is_active = true
      )
      and exists (
        select 1
        from public.categories cat
        where cat.id = b.category_id
          and cat.is_active = true
      )
  )
);
