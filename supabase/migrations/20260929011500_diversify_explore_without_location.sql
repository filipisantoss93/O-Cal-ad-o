do $migration$
declare
  function_signature constant text :=
    'public.search_public_business_ids_by_location(bigint,text,text,double precision,double precision,integer,integer)';
  current_definition text;
  previous_final_query constant text := $old$
  from matched
  order by
    case
      when matched.has_coordinates and matched.query_text is null
      then matched.distance_km
    end asc nulls last,
    matched.relevance desc,
    case
      when matched.has_coordinates and matched.query_text is not null
      then matched.distance_km
    end asc nulls last,
    matched.name asc,
    matched.id asc
  limit greatest(1, least(coalesce(p_limit, 12), 48))
  offset greatest(0, coalesce(p_offset, 0));
$old$;
  diversified_final_query constant text := $new$
  from matched
  join public.businesses result_business on result_business.id = matched.id
  order by
    case
      when matched.has_coordinates and matched.query_text is null
      then matched.distance_km
    end asc nulls last,
    matched.relevance desc,
    case
      when matched.has_coordinates and matched.query_text is not null
      then matched.distance_km
    end asc nulls last,
    case
      when not matched.has_coordinates and matched.query_text is null
      then row_number() over (
        partition by result_business.category_id
        order by
          (
            case when result_business.logo_path is not null then 3 else 0 end
            + case when result_business.cover_path is not null then 2 else 0 end
            + case when nullif(pg_catalog.btrim(result_business.description), '') is not null then 2 else 0 end
            + case
                when result_business.whatsapp_e164 is not null
                  or result_business.phone_e164 is not null
                  or result_business.website_url is not null
                then 2 else 0
              end
            + case
                when nullif(pg_catalog.btrim(result_business.street), '') is not null
                  and nullif(pg_catalog.btrim(result_business.neighborhood), '') is not null
                then 1 else 0
              end
          ) desc,
          result_business.id asc
      )
    end asc nulls last,
    case
      when not matched.has_coordinates and matched.query_text is null
      then (
        case when result_business.logo_path is not null then 3 else 0 end
        + case when result_business.cover_path is not null then 2 else 0 end
        + case when nullif(pg_catalog.btrim(result_business.description), '') is not null then 2 else 0 end
        + case
            when result_business.whatsapp_e164 is not null
              or result_business.phone_e164 is not null
              or result_business.website_url is not null
            then 2 else 0
          end
        + case
            when nullif(pg_catalog.btrim(result_business.street), '') is not null
              and nullif(pg_catalog.btrim(result_business.neighborhood), '') is not null
            then 1 else 0
          end
      )
    end desc nulls last,
    case
      when not matched.has_coordinates and matched.query_text is null
      then pg_catalog.hashtextextended(result_business.category_id::text, p_city_id)
    end asc nulls last,
    matched.name asc,
    matched.id asc
  limit greatest(1, least(coalesce(p_limit, 12), 48))
  offset greatest(0, coalesce(p_offset, 0));
$new$;
begin
  select pg_catalog.pg_get_functiondef(function_signature::pg_catalog.regprocedure)
  into current_definition;

  if pg_catalog.strpos(current_definition, previous_final_query) = 0 then
    raise exception 'Unexpected definition for %', function_signature;
  end if;

  execute pg_catalog.replace(
    current_definition,
    previous_final_query,
    diversified_final_query
  );
end;
$migration$;

comment on function public.search_public_business_ids_by_location(
  bigint,
  text,
  text,
  double precision,
  double precision,
  integer,
  integer
) is
  'Busca pública paginada: ordena por distância com coordenadas; sem coordenadas e sem termo, intercala categorias e prioriza cadastros completos antes do desempate alfabético.';
