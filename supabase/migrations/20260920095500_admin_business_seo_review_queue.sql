-- A auditoria de 19/09 iniciou a tabela em producao; esta migration a reproduz
-- em novos ambientes sem apagar a fila existente.
create table if not exists public.business_seo_review_queue (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  related_business_id bigint references public.businesses(id) on delete cascade,
  issue_code text not null check (issue_code in ('generic_category','missing_neighborhood','missing_street','missing_business_description','missing_public_place_description','possible_duplicate')),
  priority smallint not null check (priority between 1 and 4),
  status text not null default 'pending' check (status in ('pending','reviewing','resolved','dismissed')),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_seo_review_queue_one_issue unique (business_id,issue_code),
  constraint business_seo_review_queue_duplicate_pair check (
    (issue_code='possible_duplicate' and related_business_id is not null and business_id<>related_business_id)
    or (issue_code<>'possible_duplicate' and related_business_id is null)
  )
);
alter table public.business_seo_review_queue
  add column if not exists review_note text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id);
create index if not exists business_seo_review_queue_pending_idx on public.business_seo_review_queue (priority,issue_code,created_at,id) where status='pending';
create index if not exists business_seo_review_queue_business_idx on public.business_seo_review_queue(business_id);
alter table public.business_seo_review_queue enable row level security;
revoke all on public.business_seo_review_queue from public,anon,authenticated;
grant select on public.business_seo_review_queue to authenticated;
grant update(status,review_note,reviewed_at,reviewed_by,updated_at) on public.business_seo_review_queue to authenticated;
grant select,insert,update,delete on public.business_seo_review_queue to service_role;
revoke all on sequence public.business_seo_review_queue_id_seq from public,anon,authenticated;
grant usage,select on sequence public.business_seo_review_queue_id_seq to service_role;
drop policy if exists business_seo_admin_read on public.business_seo_review_queue;
drop policy if exists business_seo_admin_update on public.business_seo_review_queue;
create policy business_seo_admin_read on public.business_seo_review_queue for select to authenticated using ((select private.is_admin()));
create policy business_seo_admin_update on public.business_seo_review_queue for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
