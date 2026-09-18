insert into public.business_data_sources (
  code,name,source_type,domain,base_url,priority,is_active,
  is_official,reliability,allows_import,terms_url,notes,last_verified_at
)
values (
  'inep_censo_escolar_2025',
  'INEP - Censo Escolar 2025',
  'government',
  'gov.br',
  'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar',
  98,true,true,98,true,
  'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos',
  'Microdados oficiais do Censo Escolar 2025. Importação restrita a escolas ativas com TP_DEPENDENCIA 1, 2 ou 3 (federal, estadual ou municipal).',
  now()
)
on conflict (code) do update set
  name=excluded.name,
  source_type=excluded.source_type,
  domain=excluded.domain,
  base_url=excluded.base_url,
  priority=excluded.priority,
  is_active=true,
  is_official=true,
  reliability=excluded.reliability,
  allows_import=true,
  terms_url=excluded.terms_url,
  notes=excluded.notes,
  last_verified_at=now();

create or replace function public.import_inep_public_school_batch(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  row_data jsonb;
  source_row public.business_data_sources%rowtype;
  city_row public.cities%rowtype;
  source_record_id bigint;
  business_id bigint;
  existing_business_id bigint;
  school_code text;
  school_name text;
  street_name text;
  address_no text;
  complement_text text;
  neighborhood_name text;
  postal text;
  source_url text := 'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar';
  dependency integer;
  city_code integer;
  lat double precision;
  lon double precision;
  valid_coordinates boolean;
  slug_value text;
  tags_value text[];
  created_count integer := 0;
  matched_count integer := 0;
  ignored_count integer := 0;
  error_count integer := 0;
  geocoded_count integer := 0;
  processed_count integer := 0;
  error_items jsonb := '[]'::jsonb;
begin
  if current_user::text not in ('service_role','postgres','supabase_admin') then
    raise exception using errcode='42501', message='Acesso negado.';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception using errcode='22023', message='Payload deve ser um array JSON.';
  end if;

  if jsonb_array_length(p_rows) > 500 then
    raise exception using errcode='22023', message='Lote máximo: 500 escolas.';
  end if;

  select *
  into source_row
  from public.business_data_sources
  where code='inep_censo_escolar_2025'
    and is_active=true
    and allows_import=true
  limit 1;

  if source_row.id is null then
    raise exception using errcode='22023', message='Fonte INEP não configurada.';
  end if;

  for row_data in select value from jsonb_array_elements(p_rows)
  loop
    processed_count := processed_count + 1;

    begin
      school_code := nullif(btrim(row_data->>'CO_ENTIDADE'),'');
      school_name := nullif(btrim(row_data->>'NO_ENTIDADE'),'');
      dependency := nullif(row_data->>'TP_DEPENDENCIA','')::integer;
      city_code := nullif(row_data->>'CO_MUNICIPIO','')::integer;

      if school_code is null
         or school_name is null
         or dependency not in (1,2,3)
         or coalesce(row_data->>'TP_SITUACAO_FUNCIONAMENTO','') <> '1'
         or city_code is null
      then
        ignored_count := ignored_count + 1;
        continue;
      end if;

      select *
      into city_row
      from public.cities
      where ibge_code=city_code
        and is_active=true
      limit 1;

      if city_row.id is null then
        ignored_count := ignored_count + 1;
        error_items := error_items || jsonb_build_array(
          jsonb_build_object('school_code',school_code,'reason','city_not_found','city_code',city_code)
        );
        continue;
      end if;

      street_name := nullif(btrim(row_data->>'DS_ENDERECO'),'');
      address_no := nullif(btrim(row_data->>'NU_ENDERECO'),'');
      complement_text := nullif(btrim(row_data->>'DS_COMPLEMENTO'),'');
      neighborhood_name := nullif(btrim(row_data->>'NO_BAIRRO'),'');
      postal := regexp_replace(coalesce(row_data->>'CO_CEP',''),'[^0-9]','','g');

      if postal = '' or length(postal) <> 8 then
        postal := null;
      end if;

      if street_name is null or length(street_name) < 2
         or address_no is null or length(address_no) < 1
         or neighborhood_name is null or length(neighborhood_name) < 2
      then
        ignored_count := ignored_count + 1;
        error_items := error_items || jsonb_build_array(
          jsonb_build_object('school_code',school_code,'reason','incomplete_address')
        );
        continue;
      end if;

      street_name := left(street_name,160);
      address_no := left(address_no,20);
      complement_text := case when complement_text is null then null else left(complement_text,120) end;
      neighborhood_name := left(neighborhood_name,120);
      school_name := left(school_name,120);

      lat := null;
      lon := null;
      valid_coordinates := false;

      begin
        lat := nullif(row_data->>'LATITUDE','')::double precision;
        lon := nullif(row_data->>'LONGITUDE','')::double precision;
      exception when others then
        lat := null;
        lon := null;
      end;

      if lat between -90 and 90 and lon between -180 and 180 then
        select exists(
          select 1
          from public.resolve_city_by_coordinates(lat,lon) r
          where r.id=city_row.id
        )
        into valid_coordinates;
      end if;

      if not valid_coordinates then
        lat := null;
        lon := null;
      else
        lat := round(lat::numeric,6)::double precision;
        lon := round(lon::numeric,6)::double precision;
      end if;

      insert into public.business_source_records (
        source_id,external_id,external_unit_code,name,street,address_number,complement,
        neighborhood,postal_code,city_name,state_code,city_id,latitude,longitude,
        source_url,payload,dedupe_key,processing_status,processing_note,found_at,updated_at
      )
      values (
        source_row.id,
        'inep-school:' || school_code,
        school_code,
        school_name,
        street_name,
        address_no,
        complement_text,
        neighborhood_name,
        postal,
        city_row.name,
        city_row.state_code,
        city_row.id,
        lat,
        lon,
        source_url,
        row_data,
        'inep-school:' || school_code,
        'pending',
        'Importação nacional Censo Escolar 2025',
        now(),
        now()
      )
      on conflict (source_id,external_id) where external_id is not null
      do update set
        name=excluded.name,
        street=excluded.street,
        address_number=excluded.address_number,
        complement=excluded.complement,
        neighborhood=excluded.neighborhood,
        postal_code=excluded.postal_code,
        city_name=excluded.city_name,
        state_code=excluded.state_code,
        city_id=excluded.city_id,
        latitude=excluded.latitude,
        longitude=excluded.longitude,
        source_url=excluded.source_url,
        payload=excluded.payload,
        dedupe_key=excluded.dedupe_key,
        found_at=now(),
        updated_at=now()
      returning id,matched_business_id
      into source_record_id,business_id;

      if business_id is not null then
        update public.businesses
        set latitude=coalesce(latitude,lat),
            longitude=coalesce(longitude,lon),
            official_source_url=source_url,
            data_source_url=source_url,
            data_source_checked_at=now(),
            updated_at=now()
        where id=business_id
          and listing_type='public_place';

        update public.business_source_records
        set processing_status='matched',
            processed_at=now(),
            updated_at=now()
        where id=source_record_id;

        matched_count := matched_count + 1;
        if lat is not null and lon is not null then
          geocoded_count := geocoded_count + 1;
        end if;
        continue;
      end if;

      select b.id
      into existing_business_id
      from public.businesses b
      where b.city_id=city_row.id
        and b.listing_type='public_place'
        and private.normalize_business_text(b.name)=private.normalize_business_text(school_name)
      order by b.id
      limit 1;

      if existing_business_id is not null then
        business_id := existing_business_id;

        update public.businesses
        set latitude=coalesce(latitude,lat),
            longitude=coalesce(longitude,lon),
            official_source_url=coalesce(official_source_url,source_url),
            data_source_url=coalesce(data_source_url,source_url),
            data_source_checked_at=now(),
            updated_at=now()
        where id=business_id;

        update public.business_source_records
        set matched_business_id=business_id,
            processing_status='matched',
            processed_at=now(),
            updated_at=now()
        where id=source_record_id;

        matched_count := matched_count + 1;
      else
        slug_value :=
          trim(both '-' from regexp_replace(lower(extensions.unaccent(school_name)),'[^a-z0-9]+','-','g'))
          || '-inep-' || lower(regexp_replace(school_code,'[^a-zA-Z0-9]','','g'));

        tags_value := array[
          'inep',
          'escola-publica',
          case dependency
            when 1 then 'federal'
            when 2 then 'estadual'
            when 3 then 'municipal'
          end
        ];

        insert into public.businesses (
          owner_id,city_id,category_id,slug,name,street,address_number,complement,
          neighborhood,postal_code,latitude,longitude,status,plan,is_active,
          publication_status,listing_type,public_place_kind,official_source_url,
          pre_registered,data_source_url,data_source_checked_at,tags
        )
        values (
          null,city_row.id,27,slug_value,school_name,street_name,address_no,complement_text,
          neighborhood_name,postal,lat,lon,'approved','free',true,
          'published','public_place','education',source_url,
          false,source_url,now(),tags_value
        )
        on conflict (city_id,slug) do update set
          street=excluded.street,
          address_number=excluded.address_number,
          complement=excluded.complement,
          neighborhood=excluded.neighborhood,
          postal_code=excluded.postal_code,
          latitude=coalesce(public.businesses.latitude,excluded.latitude),
          longitude=coalesce(public.businesses.longitude,excluded.longitude),
          official_source_url=excluded.official_source_url,
          data_source_url=excluded.data_source_url,
          data_source_checked_at=now(),
          updated_at=now()
        returning id into business_id;

        update public.business_source_records
        set matched_business_id=business_id,
            processing_status='created',
            processed_at=now(),
            updated_at=now()
        where id=source_record_id;

        created_count := created_count + 1;
      end if;

      insert into public.business_source_links (
        business_id,source_record_id,confidence,is_primary,first_seen_at,last_seen_at
      )
      values (business_id,source_record_id,99,false,now(),now())
      on conflict (business_id,source_record_id)
      do update set confidence=99,last_seen_at=now(),updated_at=now();

      if lat is not null and lon is not null then
        geocoded_count := geocoded_count + 1;
      end if;

    exception when others then
      error_count := error_count + 1;
      error_items := error_items || jsonb_build_array(
        jsonb_build_object(
          'school_code',coalesce(school_code,row_data->>'CO_ENTIDADE'),
          'reason','exception',
          'message',left(sqlerrm,500)
        )
      );
    end;
  end loop;

  return jsonb_build_object(
    'processed',processed_count,
    'created',created_count,
    'matched',matched_count,
    'ignored',ignored_count,
    'errors',error_count,
    'geocoded',geocoded_count,
    'error_items',error_items
  );
end;
$function$;

revoke all on function public.import_inep_public_school_batch(jsonb)
from public, anon, authenticated;
grant execute on function public.import_inep_public_school_batch(jsonb)
to service_role;
