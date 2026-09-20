-- Pacotes de lançamento: somente administração pode alterar preços.
create table if not exists public.event_highlight_packages (
 code text primary key check (code in ('event_7','event_15','event_30')),
 duration_days integer not null check (duration_days in (7,15,30)),
 price_cents integer not null check (price_cents > 0),
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);
insert into public.event_highlight_packages(code,duration_days,price_cents) values
 ('event_7',7,990),('event_15',15,1790),('event_30',30,2990)
on conflict (code) do nothing;
alter table public.event_highlight_packages enable row level security;
drop policy if exists event_highlight_packages_public_read on public.event_highlight_packages;
create policy event_highlight_packages_public_read on public.event_highlight_packages
 for select to anon, authenticated using (is_active);
drop policy if exists event_highlight_packages_admin_manage on public.event_highlight_packages;
create policy event_highlight_packages_admin_manage on public.event_highlight_packages
 for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
grant select on public.event_highlight_packages to anon,authenticated;
grant insert,update,delete on public.event_highlight_packages to authenticated;

-- A referência financeira pertence ao servidor e nunca é fornecida pelo comerciante.
alter table public.event_highlights
 add column if not exists product_code text references public.event_highlight_packages(code),
 add column if not exists quoted_price_cents integer check (quoted_price_cents > 0),
 add column if not exists provider_charge_id text,
 add column if not exists provider_payment_url text,
 add column if not exists payment_expires_at timestamptz;
create unique index if not exists event_highlights_charge_unique on public.event_highlights(provider_charge_id)
 where provider_charge_id is not null;
create index if not exists event_highlights_pending_provider_idx on public.event_highlights(provider_charge_id,status)
 where provider_charge_id is not null;

-- A política de inserção do comerciante só admite pedido vazio. Compras autenticadas
-- são iniciadas na Edge Function depois de verificar a propriedade da vitrine.
drop policy if exists event_highlights_owner_request on public.event_highlights;
create policy event_highlights_owner_request on public.event_highlights for insert to authenticated with check (
 requester_id = (select auth.uid()) and status='pending'
 and amount_paid_cents is null and payment_reference is null and paid_at is null
 and starts_at is null and ends_at is null
 and product_code is null and quoted_price_cents is null
 and provider_charge_id is null and provider_payment_url is null and payment_expires_at is null
 and exists (
   select 1 from public.events e join public.businesses b on b.id=e.business_id
   where e.id=event_highlights.event_id and b.owner_id=(select auth.uid())
    and b.listing_type='business' and e.city_id=b.city_id
    and b.is_active and not b.billing_suspended and e.is_active
    and coalesce(e.ends_at,e.starts_at)>now()
 )
);
-- Apenas dados públicos necessários à ordenação são legíveis no feed.
revoke select on public.event_highlights from anon,authenticated;
grant select(id,event_id,status,starts_at,ends_at,created_at,product_code,payment_expires_at) on public.event_highlights to anon,authenticated;
comment on table public.event_highlight_packages is 'Pacotes de destaque por evento com preço inicial em centavos; ajuste administrativo independente do plano Pro.';
