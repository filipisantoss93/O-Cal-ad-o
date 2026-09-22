-- Keep suspicious geocoding points visible to internal review without changing map coordinates.
create table if not exists private.business_coordinate_review (
 business_id bigint primary key references public.businesses(id) on delete cascade,
 city_id bigint not null references public.cities(id),
 reason_codes text[] not null default array[]::text[],
 original_latitude numeric not null,
 original_longitude numeric not null,
 status text not null default 'pending' check (status in ('pending','needs_source','verified','corrected','dismissed')),
 proposed_latitude numeric,
 proposed_longitude numeric,
 evidence_source text,
 evidence_url text,
 review_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 reviewed_at timestamptz,
 constraint business_coordinate_review_proposal_pair check ((proposed_latitude is null) = (proposed_longitude is null))
);
create index if not exists business_coordinate_review_city_status_idx on private.business_coordinate_review(city_id,status,updated_at);
revoke all on private.business_coordinate_review from public,anon,authenticated;
grant select,insert,update,delete on private.business_coordinate_review to service_role;
comment on table private.business_coordinate_review is 'Auditoria interna de coordenadas suspeitas. Coordenadas originais preservadas; não aplicar sugestões automaticamente sem conferência do endereço e fonte.';
