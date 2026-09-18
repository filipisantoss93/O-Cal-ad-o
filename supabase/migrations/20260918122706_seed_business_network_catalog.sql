insert into public.business_data_sources (code, name, source_type, priority, is_active)
values
  ('official_brand_site', 'Site oficial da marca', 'official_site', 100, true),
  ('google_places_reference', 'Google Places - referência', 'google_places', 80, true),
  ('openstreetmap_reference', 'OpenStreetMap - referência', 'openstreetmap', 65, true),
  ('admin_manual', 'Cadastro manual administrativo', 'manual', 60, true)
on conflict (code) do update
set name = excluded.name,
    source_type = excluded.source_type,
    priority = excluded.priority,
    is_active = excluded.is_active,
    updated_at = now();

insert into public.business_networks (slug, name, website_url, is_active)
values
  ('mcdonalds', 'McDonald''s', 'https://www.mcdonalds.com.br', true),
  ('burger-king', 'Burger King', 'https://www.burgerking.com.br', true),
  ('habibs', 'Habib''s', 'https://www.habibs.com.br', true),
  ('bobs', 'Bob''s', 'https://bobs.com.br', true),
  ('giraffas', 'Giraffas', 'https://www.giraffas.com.br', true),
  ('subway', 'Subway', null, true),
  ('popeyes', 'Popeyes', null, true),
  ('kfc', 'KFC', null, true),
  ('cacau-show', 'Cacau Show', null, true),
  ('o-boticario', 'O Boticário', null, true),
  ('drogasil', 'Drogasil', null, true),
  ('droga-raia', 'Droga Raia', null, true),
  ('drogaria-sao-paulo', 'Drogaria São Paulo', null, true),
  ('pague-menos', 'Pague Menos', null, true),
  ('magazine-luiza', 'Magazine Luiza', null, true),
  ('casas-bahia', 'Casas Bahia', null, true),
  ('havan', 'Havan', null, true),
  ('pernambucanas', 'Pernambucanas', null, true),
  ('riachuelo', 'Riachuelo', null, true),
  ('renner', 'Renner', null, true),
  ('smart-fit', 'Smart Fit', null, true),
  ('bluefit', 'Bluefit', null, true),
  ('petz', 'Petz', null, true),
  ('cobasi', 'Cobasi', null, true),
  ('localiza', 'Localiza', null, true),
  ('movida', 'Movida', null, true),
  ('unidas', 'Unidas', null, true),
  ('kalunga', 'Kalunga', null, true),
  ('centauro', 'Centauro', null, true),
  ('chilli-beans', 'Chilli Beans', null, true)
on conflict (slug) do update
set name = excluded.name,
    website_url = coalesce(excluded.website_url, public.business_networks.website_url),
    is_active = true,
    updated_at = now();

with alias_seed(slug, alias) as (
  values
    ('mcdonalds', 'McDonald''s'),
    ('mcdonalds', 'McDonalds'),
    ('mcdonalds', 'Mc Donalds'),
    ('mcdonalds', 'Méqui'),
    ('burger-king', 'Burger King'),
    ('burger-king', 'BK'),
    ('habibs', 'Habib''s'),
    ('habibs', 'Habibs'),
    ('bobs', 'Bob''s'),
    ('bobs', 'Bobs'),
    ('giraffas', 'Giraffas'),
    ('subway', 'Subway'),
    ('popeyes', 'Popeyes'),
    ('kfc', 'KFC'),
    ('cacau-show', 'Cacau Show'),
    ('o-boticario', 'O Boticário'),
    ('o-boticario', 'O Boticario'),
    ('drogasil', 'Drogasil'),
    ('droga-raia', 'Droga Raia'),
    ('droga-raia', 'Raia'),
    ('drogaria-sao-paulo', 'Drogaria São Paulo'),
    ('drogaria-sao-paulo', 'Drogaria Sao Paulo'),
    ('pague-menos', 'Pague Menos'),
    ('magazine-luiza', 'Magazine Luiza'),
    ('magazine-luiza', 'Magalu'),
    ('casas-bahia', 'Casas Bahia'),
    ('havan', 'Havan'),
    ('pernambucanas', 'Pernambucanas'),
    ('riachuelo', 'Riachuelo'),
    ('renner', 'Renner'),
    ('smart-fit', 'Smart Fit'),
    ('smart-fit', 'Smartfit'),
    ('bluefit', 'Bluefit'),
    ('bluefit', 'Blue Fit'),
    ('petz', 'Petz'),
    ('cobasi', 'Cobasi'),
    ('localiza', 'Localiza'),
    ('movida', 'Movida'),
    ('unidas', 'Unidas'),
    ('kalunga', 'Kalunga'),
    ('centauro', 'Centauro'),
    ('chilli-beans', 'Chilli Beans'),
    ('chilli-beans', 'ChilliBeans')
)
insert into public.business_network_aliases (network_id, alias)
select n.id, s.alias
from alias_seed s
join public.business_networks n on n.slug = s.slug
on conflict (normalized_alias) do nothing;

insert into public.business_network_units (network_id, business_id, unit_name, operational_status)
select a.network_id, b.id, b.name, 'unknown'
from public.businesses b
join public.business_network_aliases a
  on a.normalized_alias = private.normalize_business_text(b.name)
where b.listing_type = 'business'
on conflict (business_id) do nothing;
