drop index if exists public.business_network_units_network_idx;
drop index if exists public.business_network_units_network_external_code_uidx;

create index if not exists business_network_units_own_logo_source_id_idx
  on public.business_network_units(own_logo_source_id);

create index if not exists business_network_units_logo_resolution_idx
  on public.business_network_units(network_id, business_id, use_own_logo);
