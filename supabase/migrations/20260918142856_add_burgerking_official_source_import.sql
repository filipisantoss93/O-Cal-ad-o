insert into public.business_networks(slug,name,website_url,is_active)
values ('burger-king','Burger King','https://www.burgerking.com.br',true)
on conflict (slug) do update
set name=excluded.name,website_url=excluded.website_url,is_active=true,updated_at=now();

insert into public.business_network_aliases(network_id,alias)
select n.id,v.alias
from public.business_networks n
cross join (values ('Burger King'),('BK')) as v(alias)
where n.slug='burger-king'
on conflict do nothing;

insert into public.business_data_sources(code,name,source_type,domain,base_url,priority,is_active)
values (
  'burger_king_delivery_v5_official',
  'Burger King Brasil - Lojas Participantes V5 - BK Delivery',
  'official_site',
  'bk-latam-prod.s3.amazonaws.com',
  'https://bk-latam-prod.s3.amazonaws.com/sites/burgerking.com.br/files/documents/Lojas%20Participantes%20V5%20-%20Delivery.pdf',
  100,
  true
)
on conflict (code) do update
set name=excluded.name,source_type=excluded.source_type,domain=excluded.domain,
    base_url=excluded.base_url,priority=excluded.priority,is_active=true,updated_at=now();

create or replace function private.import_burgerking_delivery_rows(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_group record;
  v_city_id bigint;
  v_units jsonb;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_unmatched jsonb := '[]'::jsonb;
  v_created int := 0;
  v_matched int := 0;
  v_duplicates int := 0;
  v_errors int := 0;
  v_found int := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows)=0 then
    raise exception 'p_rows deve ser um array JSON não vazio';
  end if;

  for v_group in
    select distinct upper(btrim(x.state)) as state,btrim(x.city) as city
    from jsonb_to_recordset(p_rows) as x(
      code text,name text,address text,postal_code text,city text,state text
    )
  loop
    select c.id into v_city_id
    from public.cities c
    where c.is_active=true
      and c.state_code=v_group.state
      and private.normalize_business_text(c.name)=private.normalize_business_text(v_group.city)
    limit 1;

    if v_city_id is null then
      v_unmatched := v_unmatched || jsonb_build_array(
        jsonb_build_object('city',v_group.city,'state',v_group.state)
      );
      continue;
    end if;

    select jsonb_agg(
      jsonb_build_object(
        'external_unit_code', btrim(x.code),
        'unit_name', left(btrim(x.name),200),
        'business_name', left('Burger King - '||btrim(x.name),120),
        'street',
          left(
            coalesce(
              nullif(
                btrim(
                  regexp_replace(
                    btrim(x.address),
                    '(?i)\s*(?:,|\s+-\s+)\s*(?:n[º°.]?\s*)?(?:[0-9]+|s/?n).*$',''
                  )
                ),''
              ),
              btrim(x.address)
            ),160
          ),
        'address_number',
          left(
            coalesce(
              nullif(
                (regexp_match(
                  btrim(x.address),
                  '(?i)(?:,|\s+-\s+)\s*(?:n[º°.]?\s*)?([0-9]+|s/?n)'
                ))[1],''
              ),
              'S/N'
            ),20
          ),
        'complement',null,
        'neighborhood','Não informado',
        'postal_code',regexp_replace(coalesce(x.postal_code,''),'\D','','g'),
        'latitude',null,
        'longitude',null,
        'source_url','https://bk-latam-prod.s3.amazonaws.com/sites/burgerking.com.br/files/documents/Lojas%20Participantes%20V5%20-%20Delivery.pdf',
        'operational_status','active'
      )
      order by btrim(x.code)
    )
    into v_units
    from jsonb_to_recordset(p_rows) as x(
      code text,name text,address text,postal_code text,city text,state text
    )
    where upper(btrim(x.state))=v_group.state
      and private.normalize_business_text(btrim(x.city))=private.normalize_business_text(v_group.city);

    select public.admin_import_network_units(
      'burger-king',
      'burger_king_delivery_v5_official',
      v_city_id,
      1,
      v_units,
      true
    ) into v_result;

    v_results := v_results || jsonb_build_array(
      jsonb_build_object('city',v_group.city,'state',v_group.state,'result',v_result)
    );
    v_found := v_found + coalesce((v_result->>'total_found')::int,0);
    v_created := v_created + coalesce((v_result->>'created')::int,0);
    v_matched := v_matched + coalesce((v_result->>'matched')::int,0);
    v_duplicates := v_duplicates + coalesce((v_result->>'duplicate_candidates')::int,0);
    v_errors := v_errors + coalesce(jsonb_array_length(coalesce(v_result->'errors','[]'::jsonb)),0);
  end loop;

  return jsonb_build_object(
    'totals',jsonb_build_object(
      'found',v_found,'created',v_created,'matched',v_matched,
      'duplicate_candidates',v_duplicates,'errors',v_errors
    ),
    'unmatched',v_unmatched,
    'groups',v_results
  );
end;
$$;

revoke all on function private.import_burgerking_delivery_rows(jsonb)
from public,anon,authenticated;

comment on function private.import_burgerking_delivery_rows(jsonb)
is 'Importa linhas auditadas de fontes oficiais do Burger King por cidade usando admin_import_network_units e a deduplicacao central.';

create or replace function private.dispatch_burgerking_network_sync(p_payload jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path=''
as $$
declare
  v_token text;
  v_request_id bigint;
begin
  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name='ocalcadao_business_geocoding_token'
  limit 1;

  if nullif(v_token,'') is null then
    raise exception 'Token interno indisponivel.';
  end if;

  select net.http_post(
    url:='https://mieekhdagjlzdbeklrxp.supabase.co/functions/v1/sync-burgerking-network',
    body:=coalesce(p_payload,'{}'::jsonb),
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'X-Network-Sync-Token',v_token
    ),
    timeout_milliseconds:=120000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.dispatch_burgerking_network_sync(jsonb)
from public,anon,authenticated;

comment on function private.dispatch_burgerking_network_sync(jsonb)
is 'Valida a fonte oficial e retorna o estado atual da ingestao Burger King sem contornar o WAF do site.';
