begin;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname='business_network_asset_type'
  ) then
    create type public.business_network_asset_type as enum
      ('logo','logo_horizontal','logo_square','icon','banner','other');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname='business_network_source_purpose'
  ) then
    create type public.business_network_source_purpose as enum
      ('network_data','logo','units','hours','contacts','coordinates','addresses','other');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname='business_evidence_entity_type'
  ) then
    create type public.business_evidence_entity_type as enum
      ('network','network_unit','business','network_asset','data_source');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname='business_evidence_status'
  ) then
    create type public.business_evidence_status as enum
      ('current','superseded','contested','rejected');
  end if;
end $$;

alter table public.business_data_sources
  add column if not exists is_official boolean not null default false,
  add column if not exists reliability smallint not null default 50,
  add column if not exists allows_import boolean not null default true,
  add column if not exists terms_url text,
  add column if not exists notes text,
  add column if not exists last_verified_at timestamptz;

alter table public.business_data_sources
  drop constraint if exists business_data_sources_reliability_chk;
alter table public.business_data_sources
  add constraint business_data_sources_reliability_chk
  check (reliability between 0 and 100);

alter table public.business_data_sources
  drop constraint if exists business_data_sources_terms_url_chk;
alter table public.business_data_sources
  add constraint business_data_sources_terms_url_chk
  check (
    terms_url is null or
    (char_length(terms_url) <= 1000 and terms_url ~* '^https://[^[:space:]]+$')
  );

alter table public.business_data_sources
  drop constraint if exists business_data_sources_type_chk;
alter table public.business_data_sources
  add constraint business_data_sources_type_chk
  check (source_type = any(array[
    'official_site','official_api','store_locator','brand_center','press_kit',
    'official_social','google_places','openstreetmap','government','geocoder',
    'manual','partner','other'
  ]::text[]));

alter table public.business_networks
  add column if not exists description text,
  add column if not exists official_domain text,
  add column if not exists country_code text not null default 'BR',
  add column if not exists official_source_id bigint,
  add column if not exists logo_source_id bigint,
  add column if not exists logo_source_url text,
  add column if not exists logo_verified_at timestamptz;

alter table public.business_networks
  drop constraint if exists business_networks_official_source_id_fkey;
alter table public.business_networks
  add constraint business_networks_official_source_id_fkey
  foreign key (official_source_id)
  references public.business_data_sources(id)
  on delete set null;

alter table public.business_networks
  drop constraint if exists business_networks_logo_source_id_fkey;
alter table public.business_networks
  add constraint business_networks_logo_source_id_fkey
  foreign key (logo_source_id)
  references public.business_data_sources(id)
  on delete set null;

alter table public.business_networks
  drop constraint if exists business_networks_country_code_chk;
alter table public.business_networks
  add constraint business_networks_country_code_chk
  check (country_code ~ '^[A-Z]{2}$');

alter table public.business_networks
  drop constraint if exists business_networks_official_domain_chk;
alter table public.business_networks
  add constraint business_networks_official_domain_chk
  check (
    official_domain is null or
    char_length(btrim(official_domain)) between 3 and 255
  );

alter table public.business_networks
  drop constraint if exists business_networks_logo_source_url_chk;
alter table public.business_networks
  add constraint business_networks_logo_source_url_chk
  check (
    logo_source_url is null or
    (char_length(logo_source_url) <= 1500 and logo_source_url ~* '^https://[^[:space:]]+$')
  );

alter table public.business_networks
  drop constraint if exists business_networks_verified_logo_chk;
alter table public.business_networks
  add constraint business_networks_verified_logo_chk
  check (
    logo_verified_at is null or
    (
      nullif(btrim(logo_path), '') is not null
      and (
        logo_source_id is not null
        or nullif(btrim(logo_source_url), '') is not null
      )
    )
  );

alter table public.business_network_units
  add column if not exists use_own_logo boolean not null default false,
  add column if not exists own_logo_source_id bigint,
  add column if not exists own_logo_source_url text,
  add column if not exists own_logo_verified_at timestamptz;

alter table public.business_network_units
  drop constraint if exists business_network_units_own_logo_source_id_fkey;
alter table public.business_network_units
  add constraint business_network_units_own_logo_source_id_fkey
  foreign key (own_logo_source_id)
  references public.business_data_sources(id)
  on delete set null;

alter table public.business_network_units
  drop constraint if exists business_network_units_own_logo_source_url_chk;
alter table public.business_network_units
  add constraint business_network_units_own_logo_source_url_chk
  check (
    own_logo_source_url is null or
    (char_length(own_logo_source_url) <= 1500 and own_logo_source_url ~* '^https://[^[:space:]]+$')
  );

create table if not exists public.business_network_assets (
  id bigint generated by default as identity primary key,
  network_id bigint not null
    references public.business_networks(id) on delete cascade,
  asset_type public.business_network_asset_type not null,
  storage_path text,
  public_url text,
  mime_type text,
  width integer,
  height integer,
  file_hash text,
  source_id bigint
    references public.business_data_sources(id) on delete restrict,
  source_url text,
  is_official boolean not null default false,
  is_primary boolean not null default false,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_network_assets_location_chk check (
    nullif(btrim(storage_path),'') is not null
    or nullif(btrim(public_url),'') is not null
  ),
  constraint business_network_assets_dimensions_chk check (
    (width is null and height is null)
    or (width is not null and height is not null)
  ),
  constraint business_network_assets_width_chk check (width is null or width > 0),
  constraint business_network_assets_height_chk check (height is null or height > 0),
  constraint business_network_assets_public_url_chk check (
    public_url is null or
    (char_length(public_url) <= 1500 and public_url ~* '^https://[^[:space:]]+$')
  ),
  constraint business_network_assets_source_url_chk check (
    source_url is null or
    (char_length(source_url) <= 1500 and source_url ~* '^https://[^[:space:]]+$')
  )
);

create unique index if not exists business_network_assets_one_primary_per_type_idx
  on public.business_network_assets(network_id, asset_type)
  where is_primary = true;
create unique index if not exists business_network_assets_network_hash_uidx
  on public.business_network_assets(network_id, file_hash)
  where file_hash is not null;
create index if not exists business_network_assets_network_idx
  on public.business_network_assets(network_id);
create index if not exists business_network_assets_source_idx
  on public.business_network_assets(source_id);

create table if not exists public.business_network_sources (
  id bigint generated by default as identity primary key,
  network_id bigint not null
    references public.business_networks(id) on delete cascade,
  source_id bigint not null
    references public.business_data_sources(id) on delete restrict,
  purpose public.business_network_source_purpose not null default 'network_data',
  specific_url text,
  priority smallint not null default 50,
  is_verified boolean not null default false,
  first_verified_at timestamptz,
  last_verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_network_sources_priority_chk check (priority between 0 and 100),
  constraint business_network_sources_specific_url_chk check (
    specific_url is null or
    (char_length(specific_url) <= 1500 and specific_url ~* '^https://[^[:space:]]+$')
  ),
  constraint business_network_sources_verified_dates_chk check (
    last_verified_at is null or first_verified_at is null
    or last_verified_at >= first_verified_at
  )
);

create unique index if not exists business_network_sources_unique_idx
  on public.business_network_sources(
    network_id, source_id, purpose, coalesce(specific_url,'')
  );
create index if not exists business_network_sources_network_idx
  on public.business_network_sources(network_id);
create index if not exists business_network_sources_source_idx
  on public.business_network_sources(source_id);

create table if not exists public.business_network_unit_sources (
  id bigint generated by default as identity primary key,
  network_unit_id bigint not null
    references public.business_network_units(id) on delete cascade,
  source_id bigint not null
    references public.business_data_sources(id) on delete restrict,
  external_unit_code text,
  record_url text,
  raw_payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_confirmed_at timestamptz,
  is_active_at_source boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_network_unit_sources_external_code_chk check (
    external_unit_code is null or
    char_length(btrim(external_unit_code)) between 1 and 300
  ),
  constraint business_network_unit_sources_record_url_chk check (
    record_url is null or
    (char_length(record_url) <= 1500 and record_url ~* '^https://[^[:space:]]+$')
  ),
  constraint business_network_unit_sources_seen_dates_chk check (
    last_seen_at >= first_seen_at
  ),
  constraint business_network_unit_sources_confirmed_date_chk check (
    last_confirmed_at is null or last_confirmed_at >= first_seen_at
  )
);

create unique index if not exists business_network_unit_sources_external_uidx
  on public.business_network_unit_sources(source_id, external_unit_code)
  where external_unit_code is not null;
create unique index if not exists business_network_unit_sources_url_uidx
  on public.business_network_unit_sources(source_id, record_url)
  where record_url is not null;
create index if not exists business_network_unit_sources_unit_idx
  on public.business_network_unit_sources(network_unit_id);
create index if not exists business_network_unit_sources_source_idx
  on public.business_network_unit_sources(source_id);

create table if not exists public.business_data_evidence (
  id bigint generated by default as identity primary key,
  entity_type public.business_evidence_entity_type not null,
  entity_id bigint not null,
  field_name text not null,
  field_value jsonb not null,
  source_id bigint not null
    references public.business_data_sources(id) on delete restrict,
  source_url text,
  confidence numeric(5,2),
  status public.business_evidence_status not null default 'current',
  collected_at timestamptz not null default now(),
  confirmed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_data_evidence_field_name_chk check (
    char_length(btrim(field_name)) between 1 and 160
  ),
  constraint business_data_evidence_confidence_chk check (
    confidence is null or confidence between 0 and 100
  ),
  constraint business_data_evidence_source_url_chk check (
    source_url is null or
    (char_length(source_url) <= 1500 and source_url ~* '^https://[^[:space:]]+$')
  ),
  constraint business_data_evidence_confirmed_at_chk check (
    confirmed_at is null or confirmed_at >= collected_at
  )
);

create index if not exists business_data_evidence_entity_idx
  on public.business_data_evidence(entity_type, entity_id);
create index if not exists business_data_evidence_entity_field_idx
  on public.business_data_evidence(entity_type, entity_id, field_name);
create index if not exists business_data_evidence_source_idx
  on public.business_data_evidence(source_id);
create index if not exists business_data_evidence_current_idx
  on public.business_data_evidence(entity_type, entity_id, field_name)
  where status='current';

create index if not exists business_networks_name_lower_idx
  on public.business_networks(lower(name));
create index if not exists business_networks_official_source_idx
  on public.business_networks(official_source_id);
create index if not exists business_networks_logo_source_idx
  on public.business_networks(logo_source_id);
create index if not exists business_network_units_network_idx
  on public.business_network_units(network_id);
create index if not exists business_network_units_own_logo_idx
  on public.business_network_units(business_id)
  where use_own_logo=true;
create unique index if not exists business_network_units_network_external_code_uidx
  on public.business_network_units(network_id, external_unit_code)
  where external_unit_code is not null;
create index if not exists business_data_sources_official_idx
  on public.business_data_sources(is_official)
  where is_official=true;

create or replace function private.validate_business_data_evidence_entity()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare
  entity_exists boolean := false;
begin
  case new.entity_type::text
    when 'network' then
      select exists(select 1 from public.business_networks where id=new.entity_id)
        into entity_exists;
    when 'network_unit' then
      select exists(select 1 from public.business_network_units where id=new.entity_id)
        into entity_exists;
    when 'business' then
      select exists(select 1 from public.businesses where id=new.entity_id)
        into entity_exists;
    when 'network_asset' then
      select exists(select 1 from public.business_network_assets where id=new.entity_id)
        into entity_exists;
    when 'data_source' then
      select exists(select 1 from public.business_data_sources where id=new.entity_id)
        into entity_exists;
  end case;

  if not entity_exists then
    raise exception 'invalid evidence entity type=%, id=%',
      new.entity_type, new.entity_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_business_data_evidence_entity
  on public.business_data_evidence;
create trigger trg_validate_business_data_evidence_entity
before insert or update of entity_type, entity_id
on public.business_data_evidence
for each row execute function private.validate_business_data_evidence_entity();

create or replace function private.touch_network_metadata_updated_at()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_business_network_assets_updated_at
  on public.business_network_assets;
create trigger trg_business_network_assets_updated_at
before update on public.business_network_assets
for each row execute function private.touch_network_metadata_updated_at();

drop trigger if exists trg_business_network_sources_updated_at
  on public.business_network_sources;
create trigger trg_business_network_sources_updated_at
before update on public.business_network_sources
for each row execute function private.touch_network_metadata_updated_at();

drop trigger if exists trg_business_network_unit_sources_updated_at
  on public.business_network_unit_sources;
create trigger trg_business_network_unit_sources_updated_at
before update on public.business_network_unit_sources
for each row execute function private.touch_network_metadata_updated_at();

drop trigger if exists trg_business_data_evidence_updated_at
  on public.business_data_evidence;
create trigger trg_business_data_evidence_updated_at
before update on public.business_data_evidence
for each row execute function private.touch_network_metadata_updated_at();

alter table public.business_network_assets enable row level security;
alter table public.business_network_sources enable row level security;
alter table public.business_network_unit_sources enable row level security;
alter table public.business_data_evidence enable row level security;

revoke all on table public.business_network_assets from anon, authenticated;
revoke all on table public.business_network_sources from anon, authenticated;
revoke all on table public.business_network_unit_sources from anon, authenticated;
revoke all on table public.business_data_evidence from anon, authenticated;

grant select,insert,update,delete on table public.business_network_assets to service_role;
grant select,insert,update,delete on table public.business_network_sources to service_role;
grant select,insert,update,delete on table public.business_network_unit_sources to service_role;
grant select,insert,update,delete on table public.business_data_evidence to service_role;

grant usage,select on sequence public.business_network_assets_id_seq to service_role;
grant usage,select on sequence public.business_network_sources_id_seq to service_role;
grant usage,select on sequence public.business_network_unit_sources_id_seq to service_role;
grant usage,select on sequence public.business_data_evidence_id_seq to service_role;

comment on table public.business_network_assets is
  'Assets compartilhados de redes nacionais, incluindo logos oficiais.';
comment on table public.business_network_sources is
  'Fontes oficiais ou auxiliares associadas a uma rede.';
comment on table public.business_network_unit_sources is
  'Rastreabilidade das fontes usadas para cada unidade da rede.';
comment on table public.business_data_evidence is
  'Evidências por campo com origem, confiança e histórico.';
comment on column public.business_network_units.use_own_logo is
  'true: usa businesses.logo_path da unidade; false: herda business_networks.logo_path.';

commit;
