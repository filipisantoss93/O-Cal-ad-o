-- CNPJ aberto RFB: importação de pré-cadastros privados com revisão pré-publicação.
-- NÃO armazenar/publicar sócios, CPF, telefone, email, CNPJ ou endereços residenciais
-- no perfil público. Somente naturezas empresariais 2xxx exceto empresário individual.
insert into public.business_data_sources (
  code,name,source_type,domain,base_url,priority,is_active,
  is_official,reliability,allows_import,terms_url,notes,last_verified_at
) values (
  'rfb_cnpj_open_data','Receita Federal - dados públicos CNPJ (estabelecimentos)',
  'government','arquivos.receitafederal.gov.br',
  'https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj/',
  90,true,true,95,true,
  'https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/dados-abertos/cadastros',
  'Pré-cadastro privado não publicado: atividade cadastral 02; natureza empresarial 2xxx exceto empresário individual; nome fantasia, endereço comercial e CNAE. Sem sócios, CPF, telefone ou email. Fonte cadastral não comprova operação ou visitação presencial.',
  now()
) on conflict (code) do update set
  name=excluded.name,base_url=excluded.base_url,
  notes=excluded.notes,last_verified_at=now();

create or replace function public.import_rfb_cnpj_batch(p_rows jsonb, p_snapshot text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  rec jsonb;
  src_id bigint;
  v_cnpj text;
  v_name text;
  v_street text;
  v_number text;
  v_complement text;
  v_neighborhood text;
  v_state text;
  v_city_name text;
  v_city_id bigint;
  v_cnae text;
  v_kind text;
  v_category bigint;
  v_source_record_id bigint;
  v_matched_id bigint;
  v_existing_id bigint;
  v_candidate_count int;
  v_slug text;
  v_added int:=0;
  v_matched int:=0;
  v_duplicate int:=0;
  v_ignored int:=0;
  v_errors int:=0;
  v_total int:=0;
  v_postal text;
  v_source_url text;
begin
  if current_user::text not in ('service_role','postgres','supabase_admin') then
    raise exception 'Importação reservada ao serviço' using errcode='42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array'
     or jsonb_array_length(p_rows) not between 1 and 100 then
    raise exception 'Lote RFB inválido (1..100 linhas)' using errcode='22023';
  end if;
  if p_snapshot !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' then
    raise exception 'Competência inválida' using errcode='22023';
  end if;
  select id into src_id from public.business_data_sources
  where code='rfb_cnpj_open_data' and is_active and allows_import;
  if src_id is null then raise exception 'Fonte RFB não configurada'; end if;
  v_source_url := 'https://arquivos.receitafederal.gov.br/public.php/dav/files/YggdBLfdninEJX9/'||p_snapshot||'/';
  for rec in select value from jsonb_array_elements(p_rows)
  loop
    v_total:=v_total+1;
    v_cnpj := rec->>'cnpj';
    v_name := left(btrim(coalesce(rec->>'fantasia','')),120);
    v_street := left(btrim(coalesce(rec->>'logradouro','')),160);
    v_number := left(btrim(coalesce(rec->>'numero','')),20);
    v_complement := nullif(left(btrim(coalesce(rec->>'complemento','')),120),'');
    v_neighborhood := left(btrim(coalesce(rec->>'bairro','')),120);
    v_state := upper(btrim(coalesce(rec->>'uf','')));
    v_city_name := btrim(coalesce(rec->>'municipio',''));
    v_postal:=nullif(regexp_replace(coalesce(rec->>'cep',''),'[^0-9]','','g'),'');
    v_cnae:=regexp_replace(coalesce(rec->>'cnae',''),'[^0-9]','','g');
    v_kind:=regexp_replace(coalesce(rec->>'natureza_juridica',''),'[^0-9]','','g');

    if v_cnpj !~ '^[0-9]{14}$'
      or rec->>'situacao' <> '02'
      or v_kind !~ '^2[0-9]{3}$' or v_kind='2135'
      or v_name='' or v_street='' or v_number='' or v_neighborhood=''
      or v_state !~ '^[A-Z]{2}$' or v_city_name=''
      or v_cnae !~ '^[0-9]{7}$'
      or (v_postal is not null and length(v_postal)<>8)
    then v_ignored:=v_ignored+1;continue;end if;

    -- Setor validado por CNAE principal; nunca inventar categoria específica.
    v_category:=case
      when left(v_cnae,4) in ('4711','4712') then 1 -- mercados
      when left(v_cnae,4) in ('4721','4722','4723','4724','4729') then 1
      when left(v_cnae,2)='56' then 1 -- restaurantes
      when left(v_cnae,4) in ('4520','4530','4541') then 2
      when left(v_cnae,4)='4771' then 6 -- farmácias
      when left(v_cnae,4)='4772' then 5 -- cosméticos
      when left(v_cnae,2)='86' then 6
      when left(v_cnae,4) in ('4781','4782','4783') then 4
      when left(v_cnae,4) in ('4751','4752') then 8
      when left(v_cnae,4) in ('4741','4742','4743') then 7
      when left(v_cnae,4) in ('4754','4755','4759') then 9
      when left(v_cnae,4)='9602' then 5
      when left(v_cnae,2)='85' then 11
      when left(v_cnae,2)='55' then 16
      when left(v_cnae,2)='49' then 19
      else null end;
    if v_category is null then v_ignored:=v_ignored+1;continue;end if;

    select c.id into v_city_id
    from public.cities c
    where c.state_code=v_state and c.is_active
      and private.normalize_business_text(c.name)=private.normalize_business_text(v_city_name)
    order by c.id limit 1;
    if v_city_id is null then v_ignored:=v_ignored+1;continue;end if;

    -- Serializar lotes concorrentes sobre um CNPJ.
    perform pg_advisory_xact_lock(hashtextextended(v_cnpj, 9031));
    select sr.id,sr.matched_business_id into v_source_record_id,v_matched_id
      from public.business_source_records sr
      where sr.source_id=src_id and sr.external_id='cnpj:'||v_cnpj
      for update;
    if v_matched_id is not null then
      v_matched:=v_matched+1;continue;
    end if;
    if v_source_record_id is null then
      insert into public.business_source_records (
        source_id,external_id,external_unit_code,name,street,address_number,
        complement,neighborhood,postal_code,city_name,state_code,city_id,
        source_url,payload,dedupe_key,processing_status,processing_note
      ) values (
        src_id,'cnpj:'||v_cnpj,v_cnpj,v_name,v_street,v_number,v_complement,
        v_neighborhood,v_postal,v_city_name,v_state,v_city_id,v_source_url,
        jsonb_build_object('snapshot',p_snapshot,'cnae',v_cnae,'situacao','02',
          'natureza_juridica',v_kind),
        'cnpj|'||v_cnpj,'pending','Dados cadastrais: não comprova estabelecimento aberto.'
      ) returning id into v_source_record_id;
    end if;

    -- Mesmo nome e número podem ser salas diferentes: nunca mesclar por endereço.
    select count(*),min(b.id) into v_candidate_count,v_existing_id
    from public.businesses b
    where b.city_id=v_city_id
      and private.normalize_business_text(b.name)=private.normalize_business_text(v_name)
      and private.normalize_business_text(b.street)=private.normalize_business_text(v_street)
      and private.normalize_business_text(b.address_number)=private.normalize_business_text(v_number)
      and (
        private.normalize_business_text(coalesce(b.complement,''))=
          private.normalize_business_text(coalesce(v_complement,''))
        or nullif(private.normalize_business_text(coalesce(b.complement,'')),'') is null
        or nullif(private.normalize_business_text(coalesce(v_complement,'')),'') is null
      );
    if v_candidate_count>0 then
      insert into public.business_duplicate_candidates (
        business_a_id,source_record_id,score,reasons,status,detection_method
      ) values (
        v_existing_id,v_source_record_id,85,
        jsonb_build_object('same_name',true,'same_address',true,
          'complement_requires_review',true,'cnpj_source',true),
        'pending','import'
      ) on conflict (business_a_id,source_record_id)
        where source_record_id is not null
      do update set reasons=excluded.reasons,updated_at=now();
      update public.business_source_records
      set processing_status='duplicate_candidate',
          processing_note='Revisão manual de nome, endereço e complemento.',updated_at=now()
      where id=v_source_record_id;
      v_duplicate:=v_duplicate+1;continue;
    end if;

    v_slug:='rfb-'||md5(v_cnpj);
    insert into public.businesses (
      owner_id,pre_registered,city_id,category_id,listing_type,public_place_kind,
      slug,name,street,address_number,complement,neighborhood,postal_code,
      plan,status,is_active,publication_status,whatsapp_e164,
      data_source_url,data_source_checked_at,tags
    ) values (
      null,true,v_city_id,v_category,'business',null,
      v_slug,v_name,v_street,v_number,v_complement,v_neighborhood,v_postal,
      'free','approved',true,'unpublished',null,
      v_source_url,now(),array['receita-federal','cnpj-pre-cadastro']
    ) returning id into v_matched_id;

    update public.business_source_records
    set matched_business_id=v_matched_id,processing_status='created',
        processing_note='Pré-cadastro sem publicação; aguarda validação.',processed_at=now(),
        updated_at=now()
    where id=v_source_record_id;
    insert into public.business_source_links (
      business_id,source_record_id,confidence,is_primary
    ) values (v_matched_id,v_source_record_id,90,true)
      on conflict do nothing;
    v_added:=v_added+1;
  end loop;
  return jsonb_build_object('read',v_total,'created',v_added,'matched',v_matched,
    'duplicate_candidates',v_duplicate,'ignored',v_ignored,'errors',v_errors,
    'snapshot',p_snapshot);
end;
$function$;

revoke all on function public.import_rfb_cnpj_batch(jsonb,text) from public,anon,authenticated;
grant execute on function public.import_rfb_cnpj_batch(jsonb,text) to service_role;
