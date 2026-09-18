create or replace function private.normalize_business_text(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    btrim(
      regexp_replace(
        regexp_replace(
          translate(
            lower(coalesce(p_value, '')),
            'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
            'aaaaaaeeeeiiiiooooouuuucnyy'
          ),
          '[^a-z0-9]+', ' ', 'g'
        ),
        '[[:space:]]+', ' ', 'g'
      )
    ),
    ''
  );
$$;

create or replace function private.normalize_postal_code(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(coalesce(p_value, ''), '[^0-9]+', '', 'g'), '');
$$;

create table public.business_networks (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  legal_name text,
  website_url text,
  logo_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_networks_slug_chk check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint business_networks_name_chk check (char_length(btrim(name)) between 2 and 160),
  constraint business_networks_legal_name_chk check (legal_name is null or char_length(btrim(legal_name)) between 2 and 240),
  constraint business_networks_website_url_chk check (website_url is null or char_length(website_url) <= 500),
  constraint business_networks_logo_path_chk check (logo_path is null or char_length(logo_path) <= 500)
);

create table public.business_network_aliases (
  id bigint generated always as identity primary key,
  network_id bigint not null references public.business_networks(id) on delete cascade,
  alias text not null,
  normalized_alias text generated always as (private.normalize_business_text(alias)) stored,
  created_at timestamptz not null default now(),
  constraint business_network_aliases_alias_chk check (char_length(btrim(alias)) between 1 and 160),
  constraint business_network_aliases_normalized_alias_chk check (normalized_alias is not null)
);

create unique index business_network_aliases_normalized_alias_uidx
  on public.business_network_aliases (normalized_alias);
create index business_network_aliases_network_id_idx
  on public.business_network_aliases (network_id);

create table public.business_network_units (
  id bigint generated always as identity primary key,
  network_id bigint not null references public.business_networks(id) on delete restrict,
  business_id bigint not null references public.businesses(id) on delete cascade,
  external_unit_code text,
  unit_key text,
  unit_name text,
  operational_status text not null default 'unknown',
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_network_units_business_unique unique (business_id),
  constraint business_network_units_external_unit_code_chk check (external_unit_code is null or char_length(btrim(external_unit_code)) between 1 and 160),
  constraint business_network_units_unit_key_chk check (unit_key is null or char_length(btrim(unit_key)) between 3 and 500),
  constraint business_network_units_unit_name_chk check (unit_name is null or char_length(btrim(unit_name)) between 1 and 200),
  constraint business_network_units_status_chk check (operational_status in ('active','temporarily_closed','closed','unknown'))
);

create unique index business_network_units_network_external_uidx
  on public.business_network_units (network_id, external_unit_code)
  where external_unit_code is not null;
create unique index business_network_units_network_unit_key_uidx
  on public.business_network_units (network_id, unit_key)
  where unit_key is not null;
create index business_network_units_network_id_idx
  on public.business_network_units (network_id);
create index business_network_units_status_idx
  on public.business_network_units (operational_status);

create table public.business_data_sources (
  id bigint generated always as identity primary key,
  code text not null unique,
  name text not null,
  source_type text not null,
  domain text,
  base_url text,
  priority smallint not null default 50,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_data_sources_code_chk check (code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  constraint business_data_sources_name_chk check (char_length(btrim(name)) between 2 and 160),
  constraint business_data_sources_type_chk check (source_type in ('official_site','official_api','google_places','openstreetmap','government','manual','partner','other')),
  constraint business_data_sources_domain_chk check (domain is null or char_length(btrim(domain)) between 3 and 255),
  constraint business_data_sources_base_url_chk check (base_url is null or char_length(base_url) <= 1000),
  constraint business_data_sources_priority_chk check (priority between 0 and 100)
);

create table public.business_data_imports (
  id bigint generated always as identity primary key,
  source_id bigint not null references public.business_data_sources(id) on delete restrict,
  network_id bigint references public.business_networks(id) on delete set null,
  started_by uuid references auth.users(id) on delete set null,
  status text not null default 'running',
  total_found integer not null default 0,
  total_created integer not null default 0,
  total_updated integer not null default 0,
  total_matched integer not null default 0,
  total_duplicate_candidates integer not null default 0,
  total_ignored integer not null default 0,
  total_errors integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  error_summary text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_data_imports_status_chk check (status in ('running','completed','partial','failed','cancelled')),
  constraint business_data_imports_totals_chk check (
    total_found >= 0 and total_created >= 0 and total_updated >= 0 and total_matched >= 0 and
    total_duplicate_candidates >= 0 and total_ignored >= 0 and total_errors >= 0
  ),
  constraint business_data_imports_finish_chk check (finished_at is null or finished_at >= started_at),
  constraint business_data_imports_error_summary_chk check (error_summary is null or char_length(error_summary) <= 4000)
);

create index business_data_imports_source_id_idx on public.business_data_imports (source_id, started_at desc);
create index business_data_imports_network_id_idx on public.business_data_imports (network_id, started_at desc) where network_id is not null;
create index business_data_imports_status_idx on public.business_data_imports (status, started_at desc);

create table public.business_source_records (
  id bigint generated always as identity primary key,
  source_id bigint not null references public.business_data_sources(id) on delete restrict,
  import_id bigint references public.business_data_imports(id) on delete set null,
  network_id bigint references public.business_networks(id) on delete set null,
  external_id text,
  external_unit_code text,
  name text,
  street text,
  address_number text,
  complement text,
  neighborhood text,
  postal_code text,
  city_name text,
  state_code text,
  city_id bigint references public.cities(id) on delete set null,
  latitude numeric(10,7),
  longitude numeric(10,7),
  source_url text,
  payload jsonb not null default '{}'::jsonb,
  normalized_name text generated always as (private.normalize_business_text(name)) stored,
  normalized_street text generated always as (private.normalize_business_text(street)) stored,
  normalized_postal_code text generated always as (private.normalize_postal_code(postal_code)) stored,
  dedupe_key text,
  processing_status text not null default 'pending',
  matched_business_id bigint references public.businesses(id) on delete set null,
  processing_note text,
  found_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_source_records_external_id_chk check (external_id is null or char_length(btrim(external_id)) between 1 and 300),
  constraint business_source_records_external_unit_code_chk check (external_unit_code is null or char_length(btrim(external_unit_code)) between 1 and 160),
  constraint business_source_records_state_code_chk check (state_code is null or state_code ~ '^[A-Z]{2}$'),
  constraint business_source_records_latitude_chk check (latitude is null or latitude between -90 and 90),
  constraint business_source_records_longitude_chk check (longitude is null or longitude between -180 and 180),
  constraint business_source_records_source_url_chk check (source_url is null or char_length(source_url) <= 1500),
  constraint business_source_records_dedupe_key_chk check (dedupe_key is null or char_length(btrim(dedupe_key)) between 3 and 700),
  constraint business_source_records_processing_status_chk check (processing_status in ('pending','matched','created','duplicate_candidate','ignored','error')),
  constraint business_source_records_processing_note_chk check (processing_note is null or char_length(processing_note) <= 4000),
  constraint business_source_records_processed_at_chk check (processed_at is null or processed_at >= found_at)
);

create unique index business_source_records_source_external_uidx
  on public.business_source_records (source_id, external_id) where external_id is not null;
create index business_source_records_import_id_idx on public.business_source_records (import_id);
create index business_source_records_network_id_idx on public.business_source_records (network_id) where network_id is not null;
create index business_source_records_city_id_idx on public.business_source_records (city_id) where city_id is not null;
create index business_source_records_processing_status_idx on public.business_source_records (processing_status, created_at);
create index business_source_records_match_name_city_idx on public.business_source_records (city_id, normalized_name) where normalized_name is not null;
create index business_source_records_match_postal_idx on public.business_source_records (normalized_postal_code) where normalized_postal_code is not null;
create index business_source_records_dedupe_key_idx on public.business_source_records (dedupe_key) where dedupe_key is not null;

create table public.business_source_links (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  source_record_id bigint not null references public.business_source_records(id) on delete cascade,
  confidence numeric(5,2),
  is_primary boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_source_links_unique unique (business_id, source_record_id),
  constraint business_source_links_confidence_chk check (confidence is null or confidence between 0 and 100),
  constraint business_source_links_seen_chk check (last_seen_at >= first_seen_at)
);

create unique index business_source_links_primary_uidx
  on public.business_source_links (business_id) where is_primary = true;
create index business_source_links_source_record_idx on public.business_source_links (source_record_id);

create table public.business_duplicate_candidates (
  id bigint generated always as identity primary key,
  business_a_id bigint not null references public.businesses(id) on delete cascade,
  business_b_id bigint references public.businesses(id) on delete cascade,
  source_record_id bigint references public.business_source_records(id) on delete cascade,
  score numeric(5,2) not null,
  reasons jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  detection_method text not null default 'automatic',
  resolved_by uuid references auth.users(id) on delete set null,
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_duplicate_candidates_score_chk check (score between 0 and 100),
  constraint business_duplicate_candidates_status_chk check (status in ('pending','confirmed','not_duplicate','merged','dismissed')),
  constraint business_duplicate_candidates_method_chk check (detection_method in ('automatic','manual','import')),
  constraint business_duplicate_candidates_resolution_note_chk check (resolution_note is null or char_length(resolution_note) <= 4000),
  constraint business_duplicate_candidates_target_chk check (
    (business_b_id is not null and source_record_id is null and business_a_id < business_b_id)
    or
    (business_b_id is null and source_record_id is not null)
  ),
  constraint business_duplicate_candidates_resolution_chk check (
    (status = 'pending' and resolved_at is null)
    or
    (status <> 'pending' and resolved_at is not null)
  )
);

create unique index business_duplicate_candidates_pair_uidx
  on public.business_duplicate_candidates (business_a_id, business_b_id) where business_b_id is not null;
create unique index business_duplicate_candidates_source_uidx
  on public.business_duplicate_candidates (business_a_id, source_record_id) where source_record_id is not null;
create index business_duplicate_candidates_pending_idx
  on public.business_duplicate_candidates (score desc, created_at) where status = 'pending';
create index business_duplicate_candidates_source_record_idx
  on public.business_duplicate_candidates (source_record_id) where source_record_id is not null;

create table public.business_merge_history (
  id bigint generated always as identity primary key,
  kept_business_id bigint not null,
  removed_business_id bigint not null,
  duplicate_candidate_id bigint references public.business_duplicate_candidates(id) on delete set null,
  reason text,
  kept_snapshot jsonb not null default '{}'::jsonb,
  removed_snapshot jsonb not null default '{}'::jsonb,
  moved_relations jsonb not null default '{}'::jsonb,
  executed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint business_merge_history_distinct_ids_chk check (kept_business_id <> removed_business_id),
  constraint business_merge_history_reason_chk check (reason is null or char_length(reason) <= 4000)
);

create index business_merge_history_kept_idx on public.business_merge_history (kept_business_id, created_at desc);
create index business_merge_history_removed_idx on public.business_merge_history (removed_business_id, created_at desc);

create index if not exists businesses_dedupe_name_city_idx
  on public.businesses (city_id, private.normalize_business_text(name));
create index if not exists businesses_dedupe_postal_idx
  on public.businesses (private.normalize_postal_code(postal_code)) where postal_code is not null;
create index if not exists businesses_dedupe_address_city_idx
  on public.businesses (city_id, private.normalize_business_text(street), private.normalize_business_text(address_number));

create trigger set_business_networks_updated_at
before update on public.business_networks for each row execute function private.set_updated_at();
create trigger set_business_network_units_updated_at
before update on public.business_network_units for each row execute function private.set_updated_at();
create trigger set_business_data_sources_updated_at
before update on public.business_data_sources for each row execute function private.set_updated_at();
create trigger set_business_data_imports_updated_at
before update on public.business_data_imports for each row execute function private.set_updated_at();
create trigger set_business_source_records_updated_at
before update on public.business_source_records for each row execute function private.set_updated_at();
create trigger set_business_source_links_updated_at
before update on public.business_source_links for each row execute function private.set_updated_at();
create trigger set_business_duplicate_candidates_updated_at
before update on public.business_duplicate_candidates for each row execute function private.set_updated_at();

alter table public.business_networks enable row level security;
alter table public.business_network_aliases enable row level security;
alter table public.business_network_units enable row level security;
alter table public.business_data_sources enable row level security;
alter table public.business_data_imports enable row level security;
alter table public.business_source_records enable row level security;
alter table public.business_source_links enable row level security;
alter table public.business_duplicate_candidates enable row level security;
alter table public.business_merge_history enable row level security;

revoke all on table public.business_networks from anon, authenticated;
revoke all on table public.business_network_aliases from anon, authenticated;
revoke all on table public.business_network_units from anon, authenticated;
revoke all on table public.business_data_sources from anon, authenticated;
revoke all on table public.business_data_imports from anon, authenticated;
revoke all on table public.business_source_records from anon, authenticated;
revoke all on table public.business_source_links from anon, authenticated;
revoke all on table public.business_duplicate_candidates from anon, authenticated;
revoke all on table public.business_merge_history from anon, authenticated;

grant select, insert, update, delete on table public.business_networks to authenticated;
grant select, insert, update, delete on table public.business_network_aliases to authenticated;
grant select, insert, update, delete on table public.business_network_units to authenticated;
grant select, insert, update, delete on table public.business_data_sources to authenticated;
grant select, insert, update, delete on table public.business_data_imports to authenticated;
grant select, insert, update, delete on table public.business_source_records to authenticated;
grant select, insert, update, delete on table public.business_source_links to authenticated;
grant select, insert, update, delete on table public.business_duplicate_candidates to authenticated;
grant select, insert on table public.business_merge_history to authenticated;

grant usage, select on sequence public.business_networks_id_seq to authenticated;
grant usage, select on sequence public.business_network_aliases_id_seq to authenticated;
grant usage, select on sequence public.business_network_units_id_seq to authenticated;
grant usage, select on sequence public.business_data_sources_id_seq to authenticated;
grant usage, select on sequence public.business_data_imports_id_seq to authenticated;
grant usage, select on sequence public.business_source_records_id_seq to authenticated;
grant usage, select on sequence public.business_source_links_id_seq to authenticated;
grant usage, select on sequence public.business_duplicate_candidates_id_seq to authenticated;
grant usage, select on sequence public.business_merge_history_id_seq to authenticated;

create policy business_networks_admin_select on public.business_networks for select to authenticated using ((select private.is_admin()));
create policy business_networks_admin_insert on public.business_networks for insert to authenticated with check ((select private.is_admin()));
create policy business_networks_admin_update on public.business_networks for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy business_networks_admin_delete on public.business_networks for delete to authenticated using ((select private.is_admin()));

create policy business_network_aliases_admin_select on public.business_network_aliases for select to authenticated using ((select private.is_admin()));
create policy business_network_aliases_admin_insert on public.business_network_aliases for insert to authenticated with check ((select private.is_admin()));
create policy business_network_aliases_admin_update on public.business_network_aliases for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy business_network_aliases_admin_delete on public.business_network_aliases for delete to authenticated using ((select private.is_admin()));

create policy business_network_units_admin_select on public.business_network_units for select to authenticated using ((select private.is_admin()));
create policy business_network_units_admin_insert on public.business_network_units for insert to authenticated with check ((select private.is_admin()));
create policy business_network_units_admin_update on public.business_network_units for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy business_network_units_admin_delete on public.business_network_units for delete to authenticated using ((select private.is_admin()));

create policy business_data_sources_admin_select on public.business_data_sources for select to authenticated using ((select private.is_admin()));
create policy business_data_sources_admin_insert on public.business_data_sources for insert to authenticated with check ((select private.is_admin()));
create policy business_data_sources_admin_update on public.business_data_sources for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy business_data_sources_admin_delete on public.business_data_sources for delete to authenticated using ((select private.is_admin()));

create policy business_data_imports_admin_select on public.business_data_imports for select to authenticated using ((select private.is_admin()));
create policy business_data_imports_admin_insert on public.business_data_imports for insert to authenticated with check ((select private.is_admin()));
create policy business_data_imports_admin_update on public.business_data_imports for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy business_data_imports_admin_delete on public.business_data_imports for delete to authenticated using ((select private.is_admin()));

create policy business_source_records_admin_select on public.business_source_records for select to authenticated using ((select private.is_admin()));
create policy business_source_records_admin_insert on public.business_source_records for insert to authenticated with check ((select private.is_admin()));
create policy business_source_records_admin_update on public.business_source_records for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy business_source_records_admin_delete on public.business_source_records for delete to authenticated using ((select private.is_admin()));

create policy business_source_links_admin_select on public.business_source_links for select to authenticated using ((select private.is_admin()));
create policy business_source_links_admin_insert on public.business_source_links for insert to authenticated with check ((select private.is_admin()));
create policy business_source_links_admin_update on public.business_source_links for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy business_source_links_admin_delete on public.business_source_links for delete to authenticated using ((select private.is_admin()));

create policy business_duplicate_candidates_admin_select on public.business_duplicate_candidates for select to authenticated using ((select private.is_admin()));
create policy business_duplicate_candidates_admin_insert on public.business_duplicate_candidates for insert to authenticated with check ((select private.is_admin()));
create policy business_duplicate_candidates_admin_update on public.business_duplicate_candidates for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy business_duplicate_candidates_admin_delete on public.business_duplicate_candidates for delete to authenticated using ((select private.is_admin()));

create policy business_merge_history_admin_select on public.business_merge_history for select to authenticated using ((select private.is_admin()));
create policy business_merge_history_admin_insert on public.business_merge_history for insert to authenticated with check ((select private.is_admin()));
