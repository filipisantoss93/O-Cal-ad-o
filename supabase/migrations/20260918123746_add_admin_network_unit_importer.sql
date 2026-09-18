create or replace function public.admin_import_network_units(
  p_network_slug text,
  p_source_code text,
  p_city_id bigint,
  p_category_id bigint,
  p_units jsonb,
  p_publish boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_network_id bigint;
  v_network_name text;
  v_network_website text;
  v_source_id bigint;
  v_source_type text;
  v_source_url_base text;
  v_city_name text;
  v_city_slug text;
  v_state_code text;
  v_category_name text;
  v_import_id bigint;
  v_actor uuid := (select auth.uid());
  v_total integer;
  v_created integer := 0;
  v_matched integer := 0;
  v_duplicates integer := 0;
  v_errors_count integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_item jsonb;
  v_code text;
  v_unit_name text;
  v_business_name text;
  v_street text;
  v_number text;
  v_complement text;
  v_neighborhood text;
  v_postal_digits text;
  v_postal text;
  v_source_url text;
  v_slug text;
  v_record_id bigint;
  v_business_id bigint;
  v_candidate_id bigint;
  v_candidate_count integer;
  v_existing boolean;
  v_error text;
begin
  if current_user::text not in ('postgres','service_role','supabase_admin')
     and not (select private.is_admin()) then
    raise exception using errcode='42501', message='Acesso administrativo necessário.';
  end if;

  if jsonb_typeof(p_units) <> 'array' then
    raise exception using errcode='22023', message='p_units deve ser um array JSON.';
  end if;

  v_total := jsonb_array_length(p_units);
  if v_total < 1 or v_total > 500 then
    raise exception using errcode='22023', message='Envie entre 1 e 500 unidades por lote.';
  end if;

  select id, name, website_url
    into v_network_id, v_network_name, v_network_website
  from public.business_networks
  where slug = btrim(p_network_slug) and is_active = true;
  if v_network_id is null then
    raise exception using errcode='22023', message='Rede não encontrada ou inativa.';
  end if;

  select id, source_type, base_url
    into v_source_id, v_source_type, v_source_url_base
  from public.business_data_sources
  where code = btrim(p_source_code) and is_active = true;
  if v_source_id is null then
    raise exception using errcode='22023', message='Fonte não encontrada ou inativa.';
  end if;

  select name, slug, state_code
    into v_city_name, v_city_slug, v_state_code
  from public.cities
  where id = p_city_id and is_active = true;
  if v_city_name is null then
    raise exception using errcode='22023', message='Cidade não encontrada ou inativa.';
  end if;

  select name into v_category_name
  from public.categories
  where id = p_category_id and is_active = true and slug <> 'locais-publicos';
  if v_category_name is null then
    raise exception using errcode='22023', message='Categoria não encontrada ou inativa.';
  end if;

  insert into public.business_data_imports(
    source_id, network_id, started_by, status, metadata
  ) values (
    v_source_id, v_network_id, v_actor, 'running',
    jsonb_build_object(
      'city_id',p_city_id,'city',v_city_name,'state',v_state_code,
      'network_slug',p_network_slug,'source_code',p_source_code,
      'publish',p_publish,'method','admin_import_network_units'
    )
  ) returning id into v_import_id;

  for v_item in select value from jsonb_array_elements(p_units)
  loop
    v_record_id := null;
    v_business_id := null;
    v_candidate_id := null;
    v_existing := false;

    begin
      v_code := upper(btrim(coalesce(v_item->>'external_unit_code',v_item->>'external_id','')));
      if v_code = '' or char_length(v_code) > 160 then
        raise exception 'external_unit_code obrigatório (máx. 160 caracteres)';
      end if;

      v_unit_name := nullif(btrim(coalesce(v_item->>'unit_name',v_item->>'name','')),'');
      if v_unit_name is null then v_unit_name := v_code; end if;
      if char_length(v_unit_name) > 200 then
        raise exception 'unit_name excede 200 caracteres';
      end if;

      v_business_name := nullif(btrim(v_item->>'business_name'),'');
      if v_business_name is null then
        v_business_name := left(v_network_name || ' - ' || v_unit_name,120);
      end if;

      v_street := nullif(btrim(v_item->>'street'),'');
      v_number := nullif(btrim(v_item->>'address_number'),'');
      v_neighborhood := nullif(btrim(v_item->>'neighborhood'),'');
      v_complement := nullif(btrim(v_item->>'complement'),'');

      if v_street is null or char_length(v_street) > 160 then
        raise exception 'street obrigatório (máx. 160 caracteres)';
      end if;
      if v_number is null or char_length(v_number) > 20 then
        raise exception 'address_number obrigatório (máx. 20 caracteres)';
      end if;
      if v_neighborhood is null or char_length(v_neighborhood) > 120 then
        raise exception 'neighborhood obrigatório (máx. 120 caracteres)';
      end if;
      if v_complement is not null and char_length(v_complement) > 120 then
        raise exception 'complement excede 120 caracteres';
      end if;

      v_postal_digits := nullif(regexp_replace(coalesce(v_item->>'postal_code',''),'[^0-9]+','','g'),'');
      v_postal := case when char_length(coalesce(v_postal_digits,'')) = 8
        then substr(v_postal_digits,1,5)||'-'||substr(v_postal_digits,6,3)
        else null end;

      v_source_url := coalesce(nullif(btrim(v_item->>'source_url'),''),v_source_url_base);
      if v_source_url is not null and char_length(v_source_url) > 1500 then
        raise exception 'source_url excede 1500 caracteres';
      end if;

      insert into public.business_source_records(
        source_id, import_id, network_id, external_id, external_unit_code,
        name, street, address_number, complement, neighborhood, postal_code,
        city_name, state_code, city_id, source_url, payload, dedupe_key,
        processing_status
      ) values (
        v_source_id, v_import_id, v_network_id, v_code, v_code,
        v_business_name, v_street, v_number, v_complement, v_neighborhood, v_postal,
        v_city_name, v_state_code, p_city_id, v_source_url, v_item,
        btrim(p_network_slug)||'|'||lower(v_state_code)||'|'||v_city_slug||'|'||lower(v_code),
        'pending'
      )
      on conflict (source_id,external_id) where external_id is not null
      do update set
        import_id=excluded.import_id,
        network_id=excluded.network_id,
        external_unit_code=excluded.external_unit_code,
        name=excluded.name,
        street=excluded.street,
        address_number=excluded.address_number,
        complement=excluded.complement,
        neighborhood=excluded.neighborhood,
        postal_code=excluded.postal_code,
        city_name=excluded.city_name,
        state_code=excluded.state_code,
        city_id=excluded.city_id,
        source_url=excluded.source_url,
        payload=excluded.payload,
        dedupe_key=excluded.dedupe_key,
        found_at=now(),
        updated_at=now()
      returning id,matched_business_id into v_record_id,v_business_id;

      if v_business_id is not null then
        v_existing := true;
      else
        select business_id into v_business_id
        from public.business_network_units
        where network_id=v_network_id and external_unit_code=v_code
        limit 1;
        v_existing := v_business_id is not null;
      end if;

      if v_business_id is null then
        select count(*),min(b.id)
          into v_candidate_count,v_candidate_id
        from public.businesses b
        where b.city_id=p_city_id
          and b.listing_type='business'
          and private.normalize_business_text(b.street)=private.normalize_business_text(v_street)
          and private.normalize_business_text(b.address_number)=private.normalize_business_text(v_number)
          and private.normalize_business_text(coalesce(b.complement,''))=
              private.normalize_business_text(coalesce(v_complement,''))
          and exists (
            select 1 from public.business_network_aliases a
            where a.network_id=v_network_id
              and (
                private.normalize_business_text(b.name)=a.normalized_alias
                or private.normalize_business_text(b.name) like a.normalized_alias||' %'
              )
          );

        if v_candidate_count = 1 then
          v_business_id := v_candidate_id;
          v_existing := true;
        elsif v_candidate_count > 1 then
          insert into public.business_duplicate_candidates(
            business_a_id,source_record_id,score,reasons,status,detection_method
          ) values (
            v_candidate_id,v_record_id,92,
            jsonb_build_object(
              'same_network',true,'same_address',true,'same_complement',true,
              'candidate_count',v_candidate_count,'external_unit_code',v_code
            ),
            'pending','import'
          )
          on conflict (business_a_id,source_record_id) where source_record_id is not null
          do update set score=excluded.score,reasons=excluded.reasons,status='pending',
            resolved_by=null,resolution_note=null,resolved_at=null,updated_at=now();

          update public.business_source_records
          set processing_status='duplicate_candidate',
              processing_note='Mais de um perfil corresponde ao endereço e complemento.',
              processed_at=now(),updated_at=now()
          where id=v_record_id;
          v_duplicates := v_duplicates+1;
          continue;
        end if;
      end if;

      if v_business_id is null then
        select count(*),min(b.id)
          into v_candidate_count,v_candidate_id
        from public.businesses b
        where b.city_id=p_city_id
          and b.listing_type='business'
          and private.normalize_business_text(b.street)=private.normalize_business_text(v_street)
          and private.normalize_business_text(b.address_number)=private.normalize_business_text(v_number)
          and exists (
            select 1 from public.business_network_aliases a
            where a.network_id=v_network_id
              and (
                private.normalize_business_text(b.name)=a.normalized_alias
                or private.normalize_business_text(b.name) like a.normalized_alias||' %'
              )
          )
          and (
            nullif(private.normalize_business_text(b.complement),'') is null
            or nullif(private.normalize_business_text(v_complement),'') is null
          );

        if v_candidate_count > 0 then
          insert into public.business_duplicate_candidates(
            business_a_id,source_record_id,score,reasons,status,detection_method
          ) values (
            v_candidate_id,v_record_id,82,
            jsonb_build_object(
              'same_network',true,'same_address',true,'complement_incomplete',true,
              'candidate_count',v_candidate_count,'external_unit_code',v_code
            ),
            'pending','import'
          )
          on conflict (business_a_id,source_record_id) where source_record_id is not null
          do update set score=excluded.score,reasons=excluded.reasons,status='pending',
            resolved_by=null,resolution_note=null,resolved_at=null,updated_at=now();

          update public.business_source_records
          set processing_status='duplicate_candidate',
              processing_note='Endereço coincide, mas o complemento não confirma a unidade.',
              processed_at=now(),updated_at=now()
          where id=v_record_id;
          v_duplicates := v_duplicates+1;
          continue;
        end if;
      end if;

      if v_business_id is null then
        v_slug := left(
          btrim(p_network_slug)||'-'||v_city_slug||'-'||
          regexp_replace(private.normalize_business_text(v_code),' ','-','g'),
          160
        );

        insert into public.businesses(
          owner_id,pre_registered,city_id,category_id,listing_type,public_place_kind,
          official_source_url,slug,name,description,tags,
          whatsapp_e164,phone_e164,public_email,website_url,instagram_url,facebook_url,
          street,address_number,complement,neighborhood,postal_code,
          latitude,longitude,logo_path,cover_path,status,publication_status,
          moderated_at,moderated_by,plan,featured_until,billing_suspended,
          billing_suspension_reason,is_active,data_source_url,data_source_checked_at,
          google_place_id
        ) values (
          null,true,p_city_id,p_category_id,'business',null,
          case when v_source_type in ('official_site','official_api') then v_source_url else null end,
          v_slug,v_business_name,
          v_category_name||' localizado em '||v_city_name||'/'||v_state_code||
            '. Perfil informativo ainda não reivindicado pelo responsável.',
          array[v_category_name,v_network_name,v_neighborhood],
          null,null,null,v_network_website,null,null,
          v_street,v_number,v_complement,v_neighborhood,v_postal,
          nullif(v_item->>'latitude','')::numeric,
          nullif(v_item->>'longitude','')::numeric,
          null,null,'approved',
          case when p_publish then 'published' else 'unpublished' end,
          now(),v_actor,'free',null,false,null,true,v_source_url,now(),
          nullif(btrim(v_item->>'google_place_id'),'')
        ) returning id into v_business_id;

        v_created := v_created+1;
      else
        v_matched := v_matched+1;
        update public.businesses
        set data_source_url=coalesce(v_source_url,data_source_url),
            data_source_checked_at=now(),
            official_source_url=case
              when v_source_type in ('official_site','official_api')
                then coalesce(v_source_url,official_source_url)
              else official_source_url end,
            updated_at=now()
        where id=v_business_id;
      end if;

      insert into public.business_network_units(
        network_id,business_id,external_unit_code,unit_key,unit_name,
        operational_status,last_verified_at
      ) values (
        v_network_id,v_business_id,v_code,
        btrim(p_network_slug)||':'||lower(v_state_code)||':'||v_city_slug||':'||lower(v_code),
        v_unit_name,coalesce(nullif(v_item->>'operational_status',''),'active'),now()
      )
      on conflict (network_id,external_unit_code) where external_unit_code is not null
      do update set
        business_id=excluded.business_id,
        unit_key=excluded.unit_key,
        unit_name=excluded.unit_name,
        operational_status=excluded.operational_status,
        last_verified_at=excluded.last_verified_at,
        updated_at=now();

      insert into public.business_source_links(
        business_id,source_record_id,confidence,is_primary,first_seen_at,last_seen_at
      ) values (
        v_business_id,v_record_id,
        case when v_source_type in ('official_site','official_api') then 100 else 85 end,
        not exists (
          select 1 from public.business_source_links
          where business_id=v_business_id and is_primary=true
        ),
        now(),now()
      )
      on conflict (business_id,source_record_id)
      do update set confidence=excluded.confidence,last_seen_at=now(),updated_at=now();

      update public.business_source_records
      set processing_status=case when v_existing then 'matched' else 'created' end,
          matched_business_id=v_business_id,
          processing_note=case when v_existing
            then 'Unidade vinculada a perfil existente.'
            else 'Perfil não reivindicado criado pelo importador de redes.' end,
          processed_at=now(),updated_at=now()
      where id=v_record_id;

    exception when others then
      v_errors_count := v_errors_count+1;
      v_error := left(sqlerrm,500);
      v_errors := v_errors || jsonb_build_array(
        jsonb_build_object(
          'external_unit_code',coalesce(v_code,v_item->>'external_unit_code'),
          'error',v_error
        )
      );
      if v_record_id is not null then
        update public.business_source_records
        set processing_status='error',processing_note=v_error,
            processed_at=now(),updated_at=now()
        where id=v_record_id;
      end if;
    end;
  end loop;

  update public.business_data_imports
  set status=case when v_errors_count=0 then 'completed' else 'partial' end,
      total_found=v_total,total_created=v_created,total_matched=v_matched,
      total_duplicate_candidates=v_duplicates,total_errors=v_errors_count,
      error_summary=case when v_errors_count>0 then left(v_errors::text,4000) else null end,
      metadata=metadata||jsonb_build_object('errors',v_errors),
      finished_at=now(),updated_at=now()
  where id=v_import_id;

  return jsonb_build_object(
    'import_id',v_import_id,
    'status',case when v_errors_count=0 then 'completed' else 'partial' end,
    'total_found',v_total,'created',v_created,'matched',v_matched,
    'duplicate_candidates',v_duplicates,'errors',v_errors
  );
end;
$$;

revoke all on function public.admin_import_network_units(text,text,bigint,bigint,jsonb,boolean)
from public, anon;

grant execute on function public.admin_import_network_units(text,text,bigint,bigint,jsonb,boolean)
to authenticated, service_role;

comment on function public.admin_import_network_units(text,text,bigint,bigint,jsonb,boolean)
is 'Importa unidades de redes em lote, registra fonte, deduplica, cria perfis não reivindicados e vincula rede/unidade.';
