-- Agregações exatas para o painel administrativo, respeitando RLS do solicitante.
create or replace function public.admin_dashboard_metrics(p_days integer default 30)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_since timestamptz;
  v_result jsonb;
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then
    raise exception 'Acesso restrito à administração' using errcode = '42501';
  end if;
  if p_days not in (7, 30, 90) then
    raise exception 'Período inválido' using errcode = '22023';
  end if;

  v_since := now() - make_interval(days => p_days);

  with accounts as (
    select count(*) as total,
      count(*) filter (where created_at >= v_since) as recent
    from public.profiles
  ), stores as (
    select count(*) as total,
      count(*) filter (where created_at >= v_since) as recent,
      count(*) filter (where status = 'pending') as pending,
      count(*) filter (where status = 'approved') as approved,
      count(*) filter (where status = 'rejected') as rejected,
      count(*) filter (where status = 'suspended') as suspended,
      count(*) filter (where publication_status = 'published' and is_active and not billing_suspended) as published,
      count(*) filter (where billing_suspended) as billing_suspended
    from public.businesses
  ), offers as (
    select count(*) as total,
      count(*) filter (where p.created_at >= v_since) as recent,
      count(*) filter (where p.is_active and not p.billing_suspended
        and p.starts_at <= now() and p.ends_at > now()
        and b.publication_status = 'published' and b.is_active and not b.billing_suspended) as visible
    from public.promotions p join public.businesses b on b.id = p.business_id
  ), pro as (
    select count(distinct user_id) as active
    from public.subscriptions
    where status = 'active' and current_period_start <= now() and current_period_end > now()
  ), ads as (
    select count(*) as total,
      count(*) filter (where provider = 'efi' and status in ('scheduled', 'active', 'paused', 'completed')) as paid,
      count(*) filter (where status = 'active') as active,
      count(*) filter (where status = 'pending') as awaiting_payment,
      count(*) filter (where placement = 'banner' and creative_status = 'pending') as banners_to_review,
      coalesce(sum(charged_price_cents) filter
        (where provider = 'efi' and status in ('scheduled', 'active', 'paused', 'completed')), 0) as confirmed_cents,
      coalesce(sum(charged_price_cents) filter
        (where provider = 'efi' and status in ('scheduled', 'active', 'paused', 'completed') and created_at >= v_since), 0) as recent_confirmed_cents,
      coalesce(sum(charged_price_cents) filter
        (where provider = 'efi' and status = 'pending'), 0) as awaiting_payment_cents
    from public.highlight_campaigns
  ), inbox as (
    select
      (select count(*) from public.support_messages where status = 'open') as support_open,
      (select count(*) from public.business_reports where status = 'open') as reports_open,
      (select count(*) from public.admin_notifications
       where recipient_id = (select auth.uid()) and read_at is null) as unread
  ), monthly as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'month', to_char(m.month_start, 'YYYY-MM'),
      'accounts', (select count(*) from public.profiles p
        where p.created_at >= m.month_start and p.created_at < m.month_start + interval '1 month'),
      'stores', (select count(*) from public.businesses b
        where b.created_at >= m.month_start and b.created_at < m.month_start + interval '1 month')
    ) order by m.month_start), '[]'::jsonb) as points
    from generate_series(
      date_trunc('month', now()) - interval '5 months',
      date_trunc('month', now()), interval '1 month'
    ) as m(month_start)
  )
  select jsonb_build_object(
    'accounts', jsonb_build_object('total', accounts.total, 'recent', accounts.recent, 'pro', pro.active),
    'stores', to_jsonb(stores),
    'offers', to_jsonb(offers),
    'ads', to_jsonb(ads),
    'inbox', to_jsonb(inbox),
    'monthly', monthly.points
  ) into v_result
  from accounts cross join stores cross join offers cross join pro cross join ads cross join inbox cross join monthly;

  return v_result;
end;
$$;

revoke all on function public.admin_dashboard_metrics(integer) from public, anon, authenticated;
grant execute on function public.admin_dashboard_metrics(integer) to authenticated;
