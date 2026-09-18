with official_site as (
  insert into public.business_data_sources
    (code, name, source_type, domain, base_url, priority, is_active,
     is_official, reliability, allows_import, last_verified_at, notes)
  values
    ('burger_king_br_official',
     'Burger King Brasil - site oficial',
     'official_site',
     'burgerking.com.br',
     'https://www.burgerking.com.br',
     100, true, true, 100, true, now(),
     'Fonte oficial principal da marca Burger King no Brasil.')
  on conflict (code) do update set
     name=excluded.name,
     source_type=excluded.source_type,
     domain=excluded.domain,
     base_url=excluded.base_url,
     priority=excluded.priority,
     is_active=true,
     is_official=true,
     reliability=100,
     allows_import=true,
     last_verified_at=now(),
     notes=excluded.notes
  returning id
),
legal_source as (
  insert into public.business_data_sources
    (code, name, source_type, domain, base_url, priority, is_active,
     is_official, reliability, allows_import, terms_url, last_verified_at, notes)
  values
    ('burger_king_br_trademark_terms',
     'Burger King Brasil - termos de marcas e logotipos',
     'brand_center',
     'burgerking.com.br',
     'https://www.burgerking.com.br/informacoes-legais',
     100, true, true, 100, false,
     'https://www.burgerking.com.br/informacoes-legais',
     now(),
     'Fonte oficial que identifica os logotipos como marcas registradas e proíbe copiar, reproduzir, distribuir, modificar ou usar as marcas sem autorização.')
  on conflict (code) do update set
     name=excluded.name,
     source_type=excluded.source_type,
     domain=excluded.domain,
     base_url=excluded.base_url,
     priority=excluded.priority,
     is_active=true,
     is_official=true,
     reliability=100,
     allows_import=false,
     terms_url=excluded.terms_url,
     last_verified_at=now(),
     notes=excluded.notes
  returning id
),
network as (
  select id
  from public.business_networks
  where slug='burger-king'
  limit 1
),
ids as (
  select
    (select id from network) as network_id,
    (select id from official_site) as official_id,
    (select id from legal_source) as legal_id
)
update public.business_networks bn
set
  official_domain='burgerking.com.br',
  official_source_id=ids.official_id,
  logo_source_id=ids.legal_id,
  logo_source_url='https://www.burgerking.com.br/informacoes-legais',
  updated_at=now()
from ids
where bn.id=ids.network_id;

update public.business_data_sources
set
  is_official=true,
  reliability=100,
  last_verified_at=now(),
  notes=coalesce(notes,'') ||
    case when coalesce(notes,'')='' then '' else ' ' end ||
    'Documento hospedado pela infraestrutura oficial do Burger King Brasil e utilizado como fonte factual de unidades.'
where code='burger_king_delivery_v5_official';

insert into public.business_network_sources
  (network_id, source_id, purpose, specific_url, priority,
   is_verified, first_verified_at, last_verified_at, notes)
select
  bn.id, s.id, 'network_data'::public.business_network_source_purpose,
  'https://www.burgerking.com.br', 100, true, now(), now(),
  'Site oficial brasileiro.'
from public.business_networks bn
join public.business_data_sources s on s.code='burger_king_br_official'
where bn.slug='burger-king'
on conflict do nothing;

insert into public.business_network_sources
  (network_id, source_id, purpose, specific_url, priority,
   is_verified, first_verified_at, last_verified_at, notes)
select
  bn.id, s.id, 'logo'::public.business_network_source_purpose,
  'https://www.burgerking.com.br/informacoes-legais',
  100, true, now(), now(),
  'Logo oficial identificado, mas o arquivo não é importado porque os termos oficiais proíbem reutilização sem autorização.'
from public.business_networks bn
join public.business_data_sources s on s.code='burger_king_br_trademark_terms'
where bn.slug='burger-king'
on conflict do nothing;

insert into public.business_data_evidence
  (entity_type, entity_id, field_name, field_value, source_id, source_url,
   confidence, status, collected_at, confirmed_at, metadata)
select
  'network'::public.business_evidence_entity_type,
  bn.id,
  'official_logo_source',
  jsonb_build_object(
    'source','Burger King Brasil - Informações Legais',
    'import_allowed',false,
    'reason','official terms prohibit copying or commercial use of trademarks and logos without authorization'
  ),
  s.id,
  'https://www.burgerking.com.br/informacoes-legais',
  100,
  'current'::public.business_evidence_status,
  now(),
  now(),
  jsonb_build_object(
    'terms_url','https://www.burgerking.com.br/informacoes-legais'
  )
from public.business_networks bn
join public.business_data_sources s on s.code='burger_king_br_trademark_terms'
where bn.slug='burger-king'
and not exists (
  select 1
  from public.business_data_evidence e
  where e.entity_type='network'
    and e.entity_id=bn.id
    and e.field_name='official_logo_source'
    and e.source_id=s.id
    and e.status='current'
);
