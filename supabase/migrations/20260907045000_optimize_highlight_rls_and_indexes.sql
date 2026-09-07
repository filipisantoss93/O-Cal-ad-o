create index highlight_campaigns_category_id_idx
  on public.highlight_campaigns(category_id);

create index highlight_campaigns_package_code_idx
  on public.highlight_campaigns(package_code);

drop policy if exists highlight_placement_rules_public_read
  on public.highlight_placement_rules;
drop policy if exists highlight_placement_rules_admin_manage
  on public.highlight_placement_rules;

create policy highlight_placement_rules_public_read
  on public.highlight_placement_rules for select to anon
  using (is_active = true);

create policy highlight_placement_rules_authenticated_read
  on public.highlight_placement_rules for select to authenticated
  using (is_active = true or (select private.is_admin()));

create policy highlight_placement_rules_admin_update
  on public.highlight_placement_rules for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists highlight_packages_public_read
  on public.highlight_packages;
drop policy if exists highlight_packages_admin_manage
  on public.highlight_packages;

create policy highlight_packages_public_read
  on public.highlight_packages for select to anon
  using (is_active = true);

create policy highlight_packages_authenticated_read
  on public.highlight_packages for select to authenticated
  using (is_active = true or (select private.is_admin()));

create policy highlight_packages_admin_update
  on public.highlight_packages for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists highlight_campaigns_public_read
  on public.highlight_campaigns;
drop policy if exists highlight_campaigns_owner_read
  on public.highlight_campaigns;
drop policy if exists highlight_campaigns_admin_read
  on public.highlight_campaigns;

create policy highlight_campaigns_public_read
  on public.highlight_campaigns for select to anon
  using (
    status = 'active'
    and starts_at <= now()
    and ends_at > now()
    and private.is_highlight_business_eligible(business_id)
  );

create policy highlight_campaigns_authenticated_read
  on public.highlight_campaigns for select to authenticated
  using (
    (select auth.uid()) = user_id
    or (select private.is_admin())
    or (
      status = 'active'
      and starts_at <= now()
      and ends_at > now()
      and private.is_highlight_business_eligible(business_id)
    )
  );

drop policy if exists highlight_daily_metrics_owner_read
  on public.highlight_daily_metrics;
drop policy if exists highlight_daily_metrics_admin_read
  on public.highlight_daily_metrics;

create policy highlight_daily_metrics_authenticated_read
  on public.highlight_daily_metrics for select to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1
      from public.highlight_campaigns c
      where c.id = highlight_daily_metrics.campaign_id
        and c.user_id = (select auth.uid())
    )
  );
