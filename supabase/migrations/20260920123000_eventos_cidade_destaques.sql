-- Exibição de eventos exclusivamente na cidade vinculada à vitrine.
-- Corrige comparação tautológica na política original de eventos.
drop policy if exists events_owner_insert on public.events;
create policy events_owner_insert on public.events
for insert to authenticated with check (
  exists (
    select 1 from public.businesses b
    where b.id = events.business_id
      and b.owner_id = (select auth.uid())
      and b.listing_type = 'business'
      and b.city_id = events.city_id
      and b.is_active and not b.billing_suspended
  )
);
drop policy if exists events_owner_update on public.events;
create policy events_owner_update on public.events
for update to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id = events.business_id
      and b.owner_id = (select auth.uid())
      and b.listing_type = 'business'
  )
)
with check (
  exists (
    select 1 from public.businesses b
    where b.id = events.business_id
      and b.owner_id = (select auth.uid())
      and b.listing_type = 'business'
      and b.city_id = events.city_id
      and b.is_active and not b.billing_suspended
  )
);
-- Solicitações de contratação: nunca permitem autoatribuir destaque.
-- Apenas o administrador pode registrar um pagamento verificado e ativar o período.
create table if not exists public.event_highlights (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.events(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','active','cancelled','expired')),
  amount_paid_cents integer,
  payment_reference text,
  paid_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_highlights_valid_paid_activation check (
    status <> 'active' or (
      amount_paid_cents > 0 and
      nullif(btrim(payment_reference), '') is not null and
      paid_at is not null and starts_at is not null and ends_at is not null
      and ends_at > starts_at
    )
  )
);
create index if not exists event_highlights_active_idx on public.event_highlights(status, starts_at, ends_at, event_id);
create index if not exists event_highlights_requester_idx on public.event_highlights(requester_id, created_at desc);
create unique index if not exists event_highlights_one_pending_per_event on public.event_highlights(event_id)
where status = 'pending';
alter table public.event_highlights enable row level security;
drop policy if exists event_highlights_admin_manage on public.event_highlights;
create policy event_highlights_admin_manage on public.event_highlights
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists event_highlights_own_read on public.event_highlights;
create policy event_highlights_own_read on public.event_highlights
for select to authenticated using (requester_id = (select auth.uid()));
drop policy if exists event_highlights_owner_request on public.event_highlights;
create policy event_highlights_owner_request on public.event_highlights
for insert to authenticated with check (
  requester_id = (select auth.uid()) and status = 'pending'
  and amount_paid_cents is null and payment_reference is null
  and paid_at is null and starts_at is null and ends_at is null
  and exists (
    select 1 from public.events e
    join public.businesses b on b.id = e.business_id
    where e.id = event_highlights.event_id and b.owner_id = (select auth.uid())
      and b.listing_type = 'business' and e.city_id = b.city_id
      and b.is_active and not b.billing_suspended and e.is_active
      and coalesce(e.ends_at,e.starts_at) > now()
  )
);
drop policy if exists event_highlights_public_paid_read on public.event_highlights;
create policy event_highlights_public_paid_read on public.event_highlights
for select to anon,authenticated using (
  status = 'active' and amount_paid_cents > 0
  and nullif(btrim(payment_reference),'') is not null and paid_at is not null
  and starts_at <= now() and ends_at > now()
);
-- A API pública só pode ler os campos necessários à ordenação;
-- valores, referência de pagamento e identidade do solicitante são privados.
grant select (id,event_id,status,starts_at,ends_at,created_at) on public.event_highlights to anon, authenticated;
grant insert, update, delete on public.event_highlights to authenticated;
grant usage, select on sequence public.event_highlights_id_seq to authenticated;
comment on table public.event_highlights is 'Pedidos de destaque por evento. Apenas confirmação administrativa de pagamento pode ativar prioridade; solicitação não equivale a compra.';
