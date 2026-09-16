begin;

create index if not exists business_claim_requests_requester_id_idx
  on public.business_claim_requests (requester_id);
create index if not exists business_claim_requests_reviewed_by_idx
  on public.business_claim_requests (reviewed_by)
  where reviewed_by is not null;

create index if not exists business_listing_requests_business_id_idx
  on public.business_listing_requests (business_id);
create index if not exists business_listing_requests_requester_id_idx
  on public.business_listing_requests (requester_id)
  where requester_id is not null;
create index if not exists business_listing_requests_reviewed_by_idx
  on public.business_listing_requests (reviewed_by)
  where reviewed_by is not null;

drop policy if exists business_claim_requests_owner_read on public.business_claim_requests;
drop policy if exists business_claim_requests_admin_read on public.business_claim_requests;
create policy business_claim_requests_read
  on public.business_claim_requests for select
  to authenticated
  using (
    (select auth.uid()) = requester_id
    or (select private.is_admin())
  );

drop policy if exists business_listing_requests_owner_read on public.business_listing_requests;
drop policy if exists business_listing_requests_admin_read on public.business_listing_requests;
create policy business_listing_requests_read
  on public.business_listing_requests for select
  to authenticated
  using (
    (select auth.uid()) = requester_id
    or (select private.is_admin())
  );

commit;
