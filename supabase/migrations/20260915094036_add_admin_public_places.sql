begin;

alter table public.businesses
  add column listing_type text not null default 'business',
  add column public_place_kind text,
  add column official_source_url text;

alter table public.businesses
  alter column owner_id drop not null,
  alter column whatsapp_e164 drop not null;

alter table public.businesses
  add constraint businesses_listing_type_check
    check (listing_type in ('business', 'public_place')),
  add constraint businesses_public_place_kind_check
    check (
      public_place_kind is null
      or public_place_kind in (
        'government', 'health', 'education', 'transport', 'safety',
        'culture', 'leisure', 'social_service', 'other'
      )
    ),
  add constraint businesses_official_source_url_check
    check (
      official_source_url is null
      or (
        char_length(official_source_url) <= 500
        and official_source_url ~* '^https://[^[:space:]]+$'
      )
    ),
  add constraint businesses_listing_integrity_check
    check (
      (
        listing_type = 'business'
        and owner_id is not null
        and whatsapp_e164 is not null
        and public_place_kind is null
      )
      or
      (
        listing_type = 'public_place'
        and owner_id is null
        and public_place_kind is not null
        and plan = 'free'
        and featured_until is null
      )
    );

comment on column public.businesses.listing_type is
  'Discrimina vitrines comerciais de equipamentos e serviços públicos.';
comment on column public.businesses.public_place_kind is
  'Tipo do local público; obrigatório apenas quando listing_type = public_place.';
comment on column public.businesses.official_source_url is
  'Página oficial usada para conferir as informações do local público.';

drop policy if exists businesses_owner_insert on public.businesses;
create policy businesses_owner_insert
on public.businesses
for insert
to authenticated
with check (
  (select auth.uid()) = owner_id
  and listing_type = 'business'
  and public_place_kind is null
  and exists (
    select 1 from public.categories category
    where category.id = businesses.category_id
      and category.slug <> 'locais-publicos'
  )
  and status = 'pending'
  and publication_status = 'published'
  and plan = 'free'
  and featured_until is null
  and moderation_note is null
  and moderated_at is null
  and moderated_by is null
);

drop policy if exists businesses_owner_update on public.businesses;
create policy businesses_owner_update
on public.businesses
for update
to authenticated
using ((select auth.uid()) = owner_id and listing_type = 'business')
with check (
  (select auth.uid()) = owner_id
  and listing_type = 'business'
  and exists (
    select 1 from public.categories category
    where category.id = businesses.category_id
      and category.slug <> 'locais-publicos'
  )
);

create or replace function private.guard_business_moderation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  privileged_actor boolean;
  privileged_fields_changed boolean;
  moderated_content_changed boolean;
begin
  privileged_actor :=
    current_user::text in ('postgres', 'service_role', 'supabase_admin')
    or private.is_admin();

  privileged_fields_changed :=
    new.owner_id is distinct from old.owner_id
    or new.listing_type is distinct from old.listing_type
    or new.public_place_kind is distinct from old.public_place_kind
    or new.official_source_url is distinct from old.official_source_url
    or new.status is distinct from old.status
    or new.publication_status is distinct from old.publication_status
    or new.plan is distinct from old.plan
    or new.featured_until is distinct from old.featured_until
    or new.moderation_note is distinct from old.moderation_note
    or new.moderated_at is distinct from old.moderated_at
    or new.moderated_by is distinct from old.moderated_by;

  if not privileged_actor and privileged_fields_changed then
    raise exception using
      errcode = '42501',
      message = 'Campos administrativos do cadastro são exclusivos da administração.';
  end if;

  if privileged_actor then
    if new.status is distinct from old.status then
      if new.status = 'pending' then
        new.moderation_note := null;
        new.moderated_at := null;
        new.moderated_by := null;
      else
        new.moderated_at := coalesce(new.moderated_at, now());
        new.moderated_by := coalesce(new.moderated_by, (select auth.uid()));
      end if;
    end if;
    return new;
  end if;

  moderated_content_changed :=
    new.city_id is distinct from old.city_id
    or new.category_id is distinct from old.category_id
    or new.slug is distinct from old.slug
    or new.name is distinct from old.name
    or new.description is distinct from old.description
    or new.whatsapp_e164 is distinct from old.whatsapp_e164
    or new.phone_e164 is distinct from old.phone_e164
    or new.public_email is distinct from old.public_email
    or new.website_url is distinct from old.website_url
    or new.instagram_url is distinct from old.instagram_url
    or new.facebook_url is distinct from old.facebook_url
    or new.street is distinct from old.street
    or new.address_number is distinct from old.address_number
    or new.complement is distinct from old.complement
    or new.neighborhood is distinct from old.neighborhood
    or new.postal_code is distinct from old.postal_code
    or new.latitude is distinct from old.latitude
    or new.longitude is distinct from old.longitude
    or new.logo_path is distinct from old.logo_path
    or new.cover_path is distinct from old.cover_path;

  if moderated_content_changed and old.status in ('approved', 'rejected') then
    new.status := 'pending';
    new.moderation_note := null;
    new.moderated_at := null;
    new.moderated_by := null;

    if old.status = 'rejected' then
      new.publication_status := 'published';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_business_moderation()
from public, anon, authenticated;

insert into public.categories (slug, name, description, icon, display_order, is_active)
values (
  'locais-publicos',
  'Locais Públicos',
  'Saúde, atendimento ao cidadão, transporte, cultura e lazer',
  '🏛️',
  55,
  true
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  is_active = true;

with assis as (
  select id as city_id
  from public.cities
  where slug = 'assis-sp'
  limit 1
), public_category as (
  select id as category_id
  from public.categories
  where slug = 'locais-publicos'
), places (
  slug, name, description, public_place_kind, tags, whatsapp_e164, phone_e164,
  public_email, website_url, street, address_number, complement, neighborhood,
  postal_code, latitude, longitude, official_source_url
) as (
  values
    ('paco-municipal-de-assis', 'Paço Municipal de Assis', 'Sede da Prefeitura de Assis e ponto de atendimento da administração municipal.', 'government', array['prefeitura','paço municipal','administração pública']::text[], null, '+551833026000', null, 'https://www.assis.sp.gov.br/', 'Avenida Rui Barbosa', '926', null, 'Centro', '19814900', -22.661300, -50.411220, 'https://www.assis.sp.gov.br/portal/sic'),
    ('secretaria-municipal-de-saude-de-assis', 'Secretaria Municipal de Saúde', 'Órgão municipal responsável pela gestão e orientação dos serviços públicos de saúde de Assis.', 'health', array['secretaria de saúde','saúde pública','atendimento municipal']::text[], null, '+551833025555', null, 'https://www.assis.sp.gov.br/portal/secretarias/39/secretaria-municipal-de-saude-sms/', 'Rua Cândido Mota', '48', null, 'Centro', '19806250', -22.661467, -50.424265, 'https://www.assis.sp.gov.br/portal/secretarias/39/secretaria-municipal-de-saude-sms/'),
    ('upa-24h-de-assis', 'UPA 24h de Assis', 'Unidade de Pronto Atendimento para casos de urgência e emergência, com funcionamento ininterrupto.', 'health', array['upa','pronto atendimento','urgência','emergência','24 horas']::text[], null, '+551833021380', null, null, 'Rua Osmar Luchini', '670', null, 'Parque das Acácias', null, -22.646236, -50.403013, 'https://www.assis.sp.gov.br/portal/secretarias-paginas/25/media-complexidade/'),
    ('pami-pronto-atendimento-maria-isabel', 'PAMI — Pronto Atendimento Maria Isabel', 'Pronto atendimento municipal com funcionamento 24 horas.', 'health', array['pami','pronto atendimento','saúde','24 horas']::text[], null, '+551833024511', null, null, 'Rua Pedro Álvares Cabral', '444', null, 'Vila Maria Isabel', '19804440', -22.666921, -50.440109, 'https://www.assis.sp.gov.br/portal/secretarias-paginas/25/media-complexidade/'),
    ('hospital-regional-de-assis', 'Hospital Regional de Assis', 'Hospital público estadual de referência regional em Assis.', 'health', array['hospital regional','hospital público','saúde','emergência']::text[], null, '+551833021800', null, 'https://www.hra.famema.br/', 'Praça Doutor Symphrônio Alves dos Santos', 'S/N', null, 'Centro', null, -22.660223, -50.409941, 'https://www.assis.sp.gov.br/portal/secretarias-paginas/28/telefones-uteis/'),
    ('ame-assis', 'AME Assis', 'Ambulatório Médico de Especialidades para consultas, exames e atendimento especializado.', 'health', array['ame','ambulatório','especialidades médicas','exames']::text[], null, '+551833248900', null, null, 'Rua Elias Machado de Pádua', '540', null, 'Jardim Paulista', null, -22.645311, -50.427884, 'https://www.assis.sp.gov.br/portal/secretarias-paginas/28/telefones-uteis/'),
    ('poupatempo-assis', 'Poupatempo Assis', 'Atendimento presencial de serviços públicos estaduais mediante os procedimentos informados pelo Poupatempo.', 'government', array['poupatempo','documentos','serviços estaduais','atendimento ao cidadão']::text[], null, null, null, 'https://www.poupatempo.sp.gov.br/', 'Rua José Vieira da Cunha e Silva', '1915', null, 'Vila São Jorge', null, null, null, 'https://www.poupatempo.sp.gov.br/carta/69698E1C-FED7-4DD3-A48A-7910BD543AC3'),
    ('terminal-rodoviario-de-assis', 'Terminal Rodoviário de Assis', 'Terminal rodoviário para embarque, desembarque e informações de viagens intermunicipais.', 'transport', array['rodoviária','terminal rodoviário','ônibus','viagem']::text[], null, '+551833226283', null, null, 'Avenida Getúlio Vargas', '1001', null, 'Vila Nova Santana', null, -22.645125, -50.417919, 'https://www.assis.sp.gov.br/portal/servicos/1017/telefones-uteis/'),
    ('terminal-urbano-de-assis', 'Terminal Urbano de Assis', 'Ponto central de integração e atendimento do transporte coletivo urbano.', 'transport', array['terminal urbano','ônibus urbano','transporte coletivo']::text[], null, '+551833224145', null, null, 'Avenida Rui Barbosa', 'S/N', 'Antiga estação ferroviária', 'Centro', null, null, null, 'https://www.assis.sp.gov.br/portal/servicos/1017/telefones-uteis/'),
    ('biblioteca-municipal-nina-silva', 'Biblioteca Municipal Nina Silva', 'Biblioteca pública municipal com acervo e atendimento à população.', 'culture', array['biblioteca','livros','leitura','cultura']::text[], null, '+551833221736', null, null, 'Rua Doutor Luiz Pizza', '19', null, 'Centro', null, null, null, 'https://www.assis.sp.gov.br/portal/servicos/1017/telefones-uteis/'),
    ('conselho-tutelar-de-assis', 'Conselho Tutelar de Assis', 'Atendimento para proteção e garantia dos direitos de crianças e adolescentes.', 'social_service', array['conselho tutelar','criança','adolescente','proteção social']::text[], null, '+551833224141', null, null, 'Avenida Félix de Castro', '901', null, 'Vila Tênis Clube', null, null, null, 'https://www.assis.sp.gov.br/portal/secretarias-paginas/28/telefones-uteis/'),
    ('corpo-de-bombeiros-de-assis', 'Corpo de Bombeiros de Assis', 'Unidade de atendimento a emergências, salvamentos e prevenção de incêndios. Em emergências, ligue 193.', 'safety', array['bombeiros','emergência','salvamento','incêndio','193']::text[], null, '+551833225821', null, null, 'Avenida Antônio Zuardi', '1160', null, 'Vila Operária', null, null, null, 'https://www.assis.sp.gov.br/portal/secretarias-paginas/28/telefones-uteis/'),
    ('pat-e-banco-do-povo-de-assis', 'PAT e Banco do Povo de Assis', 'Atendimento do Posto de Atendimento ao Trabalhador e do Banco do Povo Paulista.', 'social_service', array['pat','emprego','vagas','banco do povo','microcrédito']::text[], null, null, null, null, 'Rua General Osório', '431', null, 'Centro', null, null, null, 'https://www.assis.sp.gov.br/portal/noticias/0/3/9596/pat-e-banco-do-povo-passam-a-atender-em-novo-endereco-a-partir-de-segunda-feira-13/'),
    ('cemiterio-municipal-de-assis', 'Cemitério Municipal de Assis', 'Cemitério público municipal e atendimento de serviços funerários municipais.', 'other', array['cemitério municipal','serviço funerário','administração municipal']::text[], null, '+551833222865', null, null, 'Rua José Nogueira Marmontel', 'S/N', null, 'Centro', '19814361', null, null, 'https://www.assis.sp.gov.br/portal/servicos/1017/telefones-uteis/'),
    ('secretaria-municipal-da-educacao-de-assis', 'Secretaria Municipal da Educação', 'Órgão responsável pela rede municipal de ensino e pelo atendimento administrativo da educação.', 'education', array['secretaria de educação','educação municipal','escolas municipais']::text[], null, '+551833024444', 'educacao@edu.assis.sp.gov.br', 'https://educacao.assis.sp.gov.br/', 'Avenida Getúlio Vargas', '740', null, 'Vila Nova Santana', null, -22.647570, -50.418590, 'https://educacao.assis.sp.gov.br/'),
    ('parque-joao-domingos-coelho-buracao', 'Parque João Domingos Coelho — Buracão', 'Parque público municipal conhecido como Buracão, espaço de lazer e convivência.', 'leisure', array['parque buracão','parque público','lazer','área verde']::text[], null, null, null, null, 'Rua Doutor Geraldo Nogueira Leite', '360', 'Em frente ao número 360', 'Vila Nova Santana', null, -22.658164, -50.427592, 'https://www.assis.sp.gov.br/portal/noticias/0/3/9511/comecou-hoje-o-mutirao-do-cadastro-unico-no-parque-buracao'),
    ('parque-das-aguas-de-assis', 'Parque das Águas de Assis', 'Parque público para lazer, caminhada e convivência.', 'leisure', array['parque das águas','parque público','lazer','caminhada']::text[], null, null, null, null, 'Avenida Getúlio Vargas', 'S/N', 'Próximo ao Terminal Rodoviário', 'Vila Nova Santana', null, -22.640814, -50.418067, 'https://www.assis.sp.gov.br/portal/paginas-dinamicas-categoria/16/assis-ao-vivo-links'),
    ('ubs-bonfim', 'UBS Bonfim', 'Unidade Básica de Saúde da rede municipal de Assis.', 'health', array['ubs','posto de saúde','atenção básica','bonfim']::text[], null, '+551833244586', null, null, 'Rua Senhor do Bonfim', '481', null, 'Vila Glória', null, null, null, 'https://www.assis.sp.gov.br/portal/secretarias-paginas/17/atencao-basica/'),
    ('ubs-fiuza', 'UBS Fiúza', 'Unidade Básica de Saúde da rede municipal de Assis.', 'health', array['ubs','posto de saúde','atenção básica','fiúza']::text[], null, '+551833242740', null, null, 'Rua Dionísio Dias Paião', '315', null, 'Jardim Paraná', null, -22.651520, -50.408792, 'https://www.assis.sp.gov.br/portal/secretarias-paginas/17/atencao-basica/'),
    ('ubs-jardim-parana', 'UBS Jardim Paraná', 'Unidade Básica de Saúde da rede municipal de Assis.', 'health', array['ubs','posto de saúde','atenção básica','jardim paraná']::text[], null, '+551833233286', null, null, 'Rua Ponta Grossa', '245', null, 'Jardim Paraná', null, null, null, 'https://www.assis.sp.gov.br/portal/secretarias-paginas/17/atencao-basica/'),
    ('ubs-maria-isabel', 'UBS Maria Isabel', 'Unidade Básica de Saúde da rede municipal de Assis.', 'health', array['ubs','posto de saúde','atenção básica','maria isabel']::text[], null, '+551833233281', null, null, 'Rua Santa Isabel', '450', null, 'Vila Maria Isabel', null, null, null, 'https://www.assis.sp.gov.br/portal/secretarias-paginas/17/atencao-basica/'),
    ('ubs-ribeiro', 'UBS Ribeiro', 'Unidade Básica de Saúde da rede municipal de Assis.', 'health', array['ubs','posto de saúde','atenção básica','ribeiro']::text[], null, '+551833244348', null, null, 'Rua Viriato Corrêa', '555', null, 'Vila Ribeiro', null, -22.672384, -50.427699, 'https://www.assis.sp.gov.br/portal/secretarias-paginas/17/atencao-basica/'),
    ('ubs-vila-operaria', 'UBS Vila Operária', 'Unidade Básica de Saúde da rede municipal de Assis.', 'health', array['ubs','posto de saúde','atenção básica','vila operária']::text[], null, '+551833249158', null, null, 'Avenida Antônio Zuardi', '180', null, 'Vila Operária', null, -22.659918, -50.427382, 'https://www.assis.sp.gov.br/portal/secretarias-paginas/17/atencao-basica/')
)
insert into public.businesses (
  owner_id, city_id, category_id, listing_type, public_place_kind,
  slug, name, description, tags, whatsapp_e164, phone_e164, public_email,
  website_url, street, address_number, complement, neighborhood, postal_code,
  latitude, longitude, official_source_url, status, publication_status,
  plan, is_active, billing_suspended
)
select
  null, assis.city_id, public_category.category_id, 'public_place',
  places.public_place_kind, places.slug, places.name, places.description,
  places.tags, places.whatsapp_e164, places.phone_e164, places.public_email,
  places.website_url, places.street, places.address_number, places.complement,
  places.neighborhood, places.postal_code, places.latitude, places.longitude,
  places.official_source_url, 'approved', 'published', 'free', true, false
from assis
cross join public_category
cross join places
on conflict (city_id, slug) do update set
  category_id = excluded.category_id,
  listing_type = excluded.listing_type,
  public_place_kind = excluded.public_place_kind,
  name = excluded.name,
  description = excluded.description,
  tags = excluded.tags,
  whatsapp_e164 = excluded.whatsapp_e164,
  phone_e164 = excluded.phone_e164,
  public_email = excluded.public_email,
  website_url = excluded.website_url,
  street = excluded.street,
  address_number = excluded.address_number,
  complement = excluded.complement,
  neighborhood = excluded.neighborhood,
  postal_code = excluded.postal_code,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  official_source_url = excluded.official_source_url,
  status = 'approved',
  publication_status = 'published',
  plan = 'free',
  is_active = true,
  billing_suspended = false
where businesses.listing_type = 'public_place';

with schedules(slug, weekday, opens_at, closes_at, is_closed) as (
  values
    ('paco-municipal-de-assis', 0, null::time, null::time, true),
    ('paco-municipal-de-assis', 1, '09:00'::time, '15:00'::time, false),
    ('paco-municipal-de-assis', 2, '09:00'::time, '15:00'::time, false),
    ('paco-municipal-de-assis', 3, '09:00'::time, '15:00'::time, false),
    ('paco-municipal-de-assis', 4, '09:00'::time, '15:00'::time, false),
    ('paco-municipal-de-assis', 5, '09:00'::time, '15:00'::time, false),
    ('paco-municipal-de-assis', 6, null::time, null::time, true),
    ('biblioteca-municipal-nina-silva', 0, null::time, null::time, true),
    ('biblioteca-municipal-nina-silva', 1, '08:00'::time, '17:30'::time, false),
    ('biblioteca-municipal-nina-silva', 2, '08:00'::time, '17:30'::time, false),
    ('biblioteca-municipal-nina-silva', 3, '08:00'::time, '17:30'::time, false),
    ('biblioteca-municipal-nina-silva', 4, '08:00'::time, '17:30'::time, false),
    ('biblioteca-municipal-nina-silva', 5, '08:00'::time, '17:30'::time, false),
    ('biblioteca-municipal-nina-silva', 6, null::time, null::time, true),
    ('secretaria-municipal-da-educacao-de-assis', 0, null::time, null::time, true),
    ('secretaria-municipal-da-educacao-de-assis', 1, '08:00'::time, '17:00'::time, false),
    ('secretaria-municipal-da-educacao-de-assis', 2, '08:00'::time, '17:00'::time, false),
    ('secretaria-municipal-da-educacao-de-assis', 3, '08:00'::time, '17:00'::time, false),
    ('secretaria-municipal-da-educacao-de-assis', 4, '08:00'::time, '17:00'::time, false),
    ('secretaria-municipal-da-educacao-de-assis', 5, '08:00'::time, '17:00'::time, false),
    ('secretaria-municipal-da-educacao-de-assis', 6, null::time, null::time, true),
    ('poupatempo-assis', 0, null::time, null::time, true),
    ('poupatempo-assis', 1, '09:00'::time, '17:00'::time, false),
    ('poupatempo-assis', 2, '09:00'::time, '17:00'::time, false),
    ('poupatempo-assis', 3, '09:00'::time, '17:00'::time, false),
    ('poupatempo-assis', 4, '09:00'::time, '17:00'::time, false),
    ('poupatempo-assis', 5, '09:00'::time, '17:00'::time, false),
    ('poupatempo-assis', 6, '09:00'::time, '13:00'::time, false)
), always_open_places(slug) as (
  values ('upa-24h-de-assis'), ('pami-pronto-atendimento-maria-isabel'),
    ('hospital-regional-de-assis'), ('corpo-de-bombeiros-de-assis')
), all_schedules as (
  select * from schedules
  union all
  select place.slug, weekday, '00:00'::time, '23:59:59'::time, false
  from always_open_places place
  cross join generate_series(0, 6) as weekday
)
insert into public.business_hours (
  business_id, weekday, opens_at, closes_at, is_closed, display_order
)
select b.id, schedule.weekday, schedule.opens_at, schedule.closes_at,
  schedule.is_closed, 0
from all_schedules schedule
join public.businesses b on b.slug = schedule.slug
join public.cities c on c.id = b.city_id and c.slug = 'assis-sp'
where b.listing_type = 'public_place'
on conflict (business_id, weekday, display_order) do update set
  opens_at = excluded.opens_at,
  closes_at = excluded.closes_at,
  is_closed = excluded.is_closed;

create index businesses_public_places_admin_idx
on public.businesses (city_id, public_place_kind, name)
where listing_type = 'public_place';

create or replace function public.admin_dashboard_metrics(p_days integer default 30)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_since timestamptz;
  v_result jsonb;
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then
    raise exception 'Acesso restrito à administração' using errcode = '42501';
  end if;
  if p_days not in (7, 30, 90) then
    raise exception 'Período inválido' using errcode = '22023';
  end if;

  v_since := now() - make_interval(days => p_days);

  with accounts as (
    select count(*) as total,
      count(*) filter (where created_at >= v_since) as recent
    from public.profiles
  ), stores as (
    select count(*) as total,
      count(*) filter (where created_at >= v_since) as recent,
      count(*) filter (where status = 'pending') as pending,
      count(*) filter (where status = 'approved') as approved,
      count(*) filter (where status = 'rejected') as rejected,
      count(*) filter (where status = 'suspended') as suspended,
      count(*) filter (where publication_status = 'published' and is_active and not billing_suspended) as published,
      count(*) filter (where billing_suspended) as billing_suspended
    from public.businesses
    where listing_type = 'business'
  ), public_places as (
    select count(*) as total,
      count(*) filter (where publication_status = 'published' and is_active) as published
    from public.businesses
    where listing_type = 'public_place'
  ), offers as (
    select count(*) as total,
      count(*) filter (where p.created_at >= v_since) as recent,
      count(*) filter (where p.is_active and not p.billing_suspended
        and p.starts_at <= now() and p.ends_at > now()
        and b.publication_status = 'published' and b.is_active and not b.billing_suspended) as visible
    from public.promotions p join public.businesses b on b.id = p.business_id
  ), pro as (
    select count(distinct user_id) as active
    from public.subscriptions
    where status = 'active' and current_period_start <= now() and current_period_end > now()
  ), ads as (
    select count(*) as total,
      count(*) filter (where provider = 'efi' and status in ('scheduled', 'active', 'paused', 'completed')) as paid,
      count(*) filter (where status = 'active') as active,
      count(*) filter (where status = 'pending') as awaiting_payment,
      count(*) filter (where placement = 'banner' and creative_status = 'pending') as banners_to_review,
      coalesce(sum(charged_price_cents) filter
        (where provider = 'efi' and status in ('scheduled', 'active', 'paused', 'completed')), 0) as confirmed_cents,
      coalesce(sum(charged_price_cents) filter
        (where provider = 'efi' and status in ('scheduled', 'active', 'paused', 'completed') and created_at >= v_since), 0) as recent_confirmed_cents,
      coalesce(sum(charged_price_cents) filter
        (where provider = 'efi' and status = 'pending'), 0) as awaiting_payment_cents
    from public.highlight_campaigns
  ), inbox as (
    select
      (select count(*) from public.support_messages where status = 'open') as support_open,
      (select count(*) from public.business_reports where status = 'open') as reports_open,
      (select count(*) from public.admin_notifications
       where recipient_id = (select auth.uid()) and read_at is null) as unread
  ), monthly as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'month', to_char(m.month_start, 'YYYY-MM'),
      'accounts', (select count(*) from public.profiles p
        where p.created_at >= m.month_start and p.created_at < m.month_start + interval '1 month'),
      'stores', (select count(*) from public.businesses b
        where b.listing_type = 'business'
          and b.created_at >= m.month_start and b.created_at < m.month_start + interval '1 month')
    ) order by m.month_start), '[]'::jsonb) as points
    from generate_series(
      date_trunc('month', now()) - interval '5 months',
      date_trunc('month', now()), interval '1 month'
    ) as m(month_start)
  )
  select jsonb_build_object(
    'accounts', jsonb_build_object('total', accounts.total, 'recent', accounts.recent, 'pro', pro.active),
    'stores', to_jsonb(stores),
    'public_places', to_jsonb(public_places),
    'offers', to_jsonb(offers),
    'ads', to_jsonb(ads),
    'inbox', to_jsonb(inbox),
    'monthly', monthly.points
  ) into v_result
  from accounts cross join stores cross join public_places cross join offers
    cross join pro cross join ads cross join inbox cross join monthly;

  return v_result;
end;
$$;

revoke all on function public.admin_dashboard_metrics(integer)
from public, anon, authenticated;
grant execute on function public.admin_dashboard_metrics(integer) to authenticated;

commit;
