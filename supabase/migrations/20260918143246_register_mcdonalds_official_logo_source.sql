with official_site as (
  insert into public.business_data_sources
    (code, name, source_type, domain, base_url, priority, is_active,
     is_official, reliability, allows_import, last_verified_at, notes)
  values
    ('mcdonalds_br_official',
     'McDonald''s Brasil - site oficial',
     'official_site',
     'mcdonalds.com.br',
     'https://www.mcdonalds.com.br',
     100, true, true, 100, true, now(),
     'Fonte oficial principal da marca no Brasil.')
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
media_source as (
  insert into public.business_data_sources
    (code, name, source_type, domain, base_url, priority, is_active,
     is_official, reliability, allows_import, terms_url, last_verified_at, notes)
  values
    ('mcdonalds_corporate_media_assets',
     'McDonald''s Corporate Media Assets',
     'brand_center',
     'corporate.mcdonalds.com',
     'https://corporate.mcdonalds.com/corpmcd/our-stories/media-assets-library.html',
     100, true, true, 100, false,
     'https://corporate.mcdonalds.com/corpmcd/en-us/CorpNewsroom/Media/media-assets/terms-and-conditions.html',
     now(),
     'Fonte oficial de logos. Os termos consultados restringem os materiais da biblioteca a uso editorial; não importar o arquivo para uso comercial sem autorização.')
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
  where slug='mcdonalds'
  limit 1
),
ids as (
  select
    (select id from network) as network_id,
    (select id from official_site) as official_id,
    (select id from media_source) as media_id
)
update public.business_networks bn
set
  official_domain='mcdonalds.com.br',
  official_source_id=ids.official_id,
  logo_source_id=ids.media_id,
  logo_source_url='https://corporate.mcdonalds.com/corpmcd/our-stories/media-assets-library/logos.html',
  updated_at=now()
from ids
where bn.id=ids.network_id;

insert into public.business_network_sources
  (network_id, source_id, purpose, specific_url, priority,
   is_verified, first_verified_at, last_verified_at, notes)
select
  bn.id, s.id, 'network_data'::public.business_network_source_purpose,
  'https://www.mcdonalds.com.br', 100, true, now(), now(),
  'Site oficial brasileiro.'
from public.business_networks bn
join public.business_data_sources s on s.code='mcdonalds_br_official'
where bn.slug='mcdonalds'
on conflict do nothing;

insert into public.business_network_sources
  (network_id, source_id, purpose, specific_url, priority,
   is_verified, first_verified_at, last_verified_at, notes)
select
  bn.id, s.id, 'logo'::public.business_network_source_purpose,
  'https://corporate.mcdonalds.com/corpmcd/our-stories/media-assets-library/logos.html',
  100, true, now(), now(),
  'Fonte oficial identificada; arquivo não importado porque os termos publicados limitam o material a uso editorial.'
from public.business_networks bn
join public.business_data_sources s on s.code='mcdonalds_corporate_media_assets'
where bn.slug='mcdonalds'
on conflict do nothing;

insert into public.business_data_evidence
  (entity_type, entity_id, field_name, field_value, source_id, source_url,
   confidence, status, collected_at, confirmed_at, metadata)
select
  'network'::public.business_evidence_entity_type,
  bn.id,
  'official_logo_source',
  jsonb_build_object(
    'source','McDonald''s Corporate Media Assets',
    'import_allowed',false,
    'reason','official terms restrict media assets to editorial use'
  ),
  s.id,
  'https://corporate.mcdonalds.com/corpmcd/our-stories/media-assets-library/logos.html',
  100,
  'current'::public.business_evidence_status,
  now(),
  now(),
  jsonb_build_object(
    'terms_url','https://corporate.mcdonalds.com/corpmcd/en-us/CorpNewsroom/Media/media-assets/terms-and-conditions.html'
  )
from public.business_networks bn
join public.business_data_sources s on s.code='mcdonalds_corporate_media_assets'
where bn.slug='mcdonalds'
and not exists (
  select 1
  from public.business_data_evidence e
  where e.entity_type='network'
    and e.entity_id=bn.id
    and e.field_name='official_logo_source'
    and e.source_id=s.id
    and e.status='current'
);
