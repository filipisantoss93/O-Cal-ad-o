
create or replace function public.search_public_business_ids(
  p_city_id bigint,
  p_query text default '',
  p_category_slug text default null,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  business_id bigint,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      nullif(pg_catalog.btrim(p_query), '') as query_text,
      pg_catalog.lower(public.search_normalize(nullif(pg_catalog.btrim(p_query), ''))) as normalized_query,
      public.search_compact(nullif(pg_catalog.btrim(p_query), '')) as compact_query
  ),
  prepared as (
    select
      b.id,
      b.name,
      b.search_aliases,
      params.query_text,
      params.normalized_query,
      params.compact_query,
      pg_catalog.char_length(coalesce(params.compact_query, '')) as query_length,
      pg_catalog.lower(public.search_normalize(b.name)) as normalized_name,
      public.search_compact(b.name) as compact_name,
      pg_catalog.lower(
        public.search_normalize(
          pg_catalog.concat_ws(
            ' ',
            b.name,
            b.description,
            b.neighborhood,
            c.name,
            pg_catalog.array_to_string(b.tags, ' '),
            pg_catalog.array_to_string(b.search_aliases, ' ')
          )
        )
      ) as normalized_document,
      public.search_compact(
        pg_catalog.concat_ws(
          ' ',
          b.name,
          b.description,
          b.neighborhood,
          c.name,
          pg_catalog.array_to_string(b.tags, ' '),
          pg_catalog.array_to_string(b.search_aliases, ' ')
        )
      ) as compact_document
    from public.businesses b
    join public.categories c on c.id = b.category_id
    cross join params
    where b.city_id = p_city_id
      and b.publication_status = 'published'
      and b.is_active = true
      and b.billing_suspended = false
      and c.is_active = true
      and (p_category_slug is null or c.slug = p_category_slug)
  ),
  scored as (
    select
      p.id,
      p.name,
      greatest(
        case
          when p.query_text is null then 1::real
          when p.compact_name = p.compact_query then 120::real
          when p.compact_name like p.compact_query || '%' then 112::real
          when p.compact_document like '%' || p.compact_query || '%' then 104::real
          when p.normalized_document ilike '%' || p.normalized_query || '%' then 100::real
          when not exists (
            select 1
            from pg_catalog.regexp_split_to_table(p.normalized_query, '[^a-z0-9]+') token
            where pg_catalog.char_length(token) >= 2
              and p.normalized_document not ilike '%' || token || '%'
          ) then 96::real
          else 0::real
        end,
        case
          when p.query_text is not null
           and p.query_length >= 3
           and extensions.similarity(p.compact_query, p.compact_name) >= 0.24
           and extensions.word_similarity(p.normalized_query, p.normalized_name) >=
             case
               when p.query_length <= 3 then 0.68
               when p.query_length <= 5 then 0.54
               else 0.42
             end
          then (
            58
            + extensions.word_similarity(p.normalized_query, p.normalized_name) * 24
            + extensions.similarity(p.compact_query, p.compact_name) * 18
          )::real
          else 0::real
        end,
        case
          when p.query_text is not null
           and p.query_length >= 4
           and extensions.similarity(p.compact_query, p.compact_document) >= 0.24
           and extensions.word_similarity(p.normalized_query, p.normalized_document) >=
             case
               when p.query_length <= 5 then 0.58
               else 0.45
             end
          then (
            46
            + extensions.word_similarity(p.normalized_query, p.normalized_document) * 24
            + extensions.similarity(p.compact_query, p.compact_document) * 14
          )::real
          else 0::real
        end,
        coalesce(alias_rank.score, 0::real),
        coalesce(item_rank.score, 0::real)
      ) as relevance
    from prepared p
    left join lateral (
      select max(
        case
          when public.search_compact(a.alias) = p.compact_query then 118::real
          when public.search_compact(a.alias) like p.compact_query || '%' then 110::real
          when p.compact_query like public.search_compact(a.alias) || '%' then 108::real
          when p.query_length >= 3
           and extensions.similarity(public.search_compact(a.alias), p.compact_query) >=
             case
               when p.query_length <= 3 then 0.68
               when p.query_length <= 5 then 0.54
               else 0.40
             end
          then (62 + extensions.similarity(public.search_compact(a.alias), p.compact_query) * 36)::real
          else 0::real
        end
      ) as score
      from pg_catalog.unnest(coalesce(p.search_aliases, array[]::text[])) as a(alias)
      where p.query_text is not null
    ) alias_rank on true
    left join lateral (
      select max(
        case
          when public.search_compact(
            pg_catalog.concat_ws(' ', ci.name, ci.description)
          ) like '%' || p.compact_query || '%'
          then 86::real
          when not exists (
            select 1
            from pg_catalog.regexp_split_to_table(p.normalized_query, '[^a-z0-9]+') token
            where pg_catalog.char_length(token) >= 2
              and pg_catalog.lower(
                public.search_normalize(pg_catalog.concat_ws(' ', ci.name, ci.description))
              ) not ilike '%' || token || '%'
          )
          then 82::real
          when p.query_length >= 4
           and extensions.similarity(
             p.compact_query,
             public.search_compact(pg_catalog.concat_ws(' ', ci.name, ci.description))
           ) >= 0.26
           and extensions.word_similarity(
             p.normalized_query,
             pg_catalog.lower(
               public.search_normalize(pg_catalog.concat_ws(' ', ci.name, ci.description))
             )
           ) >=
             case
               when p.query_length <= 5 then 0.60
               else 0.47
             end
          then (
            42
            + extensions.word_similarity(
              p.normalized_query,
              pg_catalog.lower(
                public.search_normalize(pg_catalog.concat_ws(' ', ci.name, ci.description))
              )
            ) * 30
          )::real
          else 0::real
        end
      ) as score
      from public.catalog_items ci
      where ci.business_id = p.id
        and ci.is_active = true
        and p.query_text is not null
    ) item_rank on true
  ),
  matched as (
    select s.id, s.name, s.relevance
    from scored s
    where s.relevance > 0
  )
  select
    matched.id as business_id,
    pg_catalog.count(*) over() as total_count
  from matched
  order by matched.relevance desc, matched.name asc, matched.id asc
  limit greatest(1, least(coalesce(p_limit, 12), 48))
  offset greatest(0, coalesce(p_offset, 0));
$$;

revoke all on function public.search_public_business_ids(bigint, text, text, integer, integer) from public;
grant execute on function public.search_public_business_ids(bigint, text, text, integer, integer) to anon, authenticated;

comment on function public.search_public_business_ids(bigint, text, text, integer, integer) is
  'Busca pública tolerante a acentos, pontuação, espaços, ordem de palavras, aliases e erros de digitação, com precisão reforçada por similaridade compacta.';
