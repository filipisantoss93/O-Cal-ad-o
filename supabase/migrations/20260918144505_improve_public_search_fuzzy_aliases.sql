
create extension if not exists pg_trgm with schema extensions;

create or replace function public.search_compact(input text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select pg_catalog.regexp_replace(
    pg_catalog.lower(extensions.unaccent(input)),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

revoke all on function public.search_compact(text) from public;
grant execute on function public.search_compact(text) to anon, authenticated;

alter table public.businesses
  add column if not exists search_aliases text[] not null default array[]::text[];

comment on column public.businesses.search_aliases is
  'Aliases internos usados somente para descoberta/pesquisa tolerante; não alteram o nome público da vitrine.';

create index if not exists businesses_city_publication_search_idx
  on public.businesses (city_id, publication_status, is_active, billing_suspended);

create index if not exists businesses_search_name_compact_trgm_idx
  on public.businesses using gin (
    public.search_compact(name) extensions.gin_trgm_ops
  )
  where publication_status = 'published'
    and is_active = true
    and billing_suspended = false;

create or replace function private.refresh_business_search_aliases(p_business_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.businesses b
  set search_aliases = coalesce(
    (
      select pg_catalog.array_agg(distinct src.alias order by src.alias)
      from (
        select bn.name as alias
        from public.business_network_units u
        join public.business_networks bn
          on bn.id = u.network_id
         and bn.is_active = true
        where u.business_id = p_business_id

        union all

        select a.alias
        from public.business_network_units u
        join public.business_networks bn
          on bn.id = u.network_id
         and bn.is_active = true
        join public.business_network_aliases a
          on a.network_id = u.network_id
        where u.business_id = p_business_id
      ) src
      where nullif(pg_catalog.btrim(src.alias), '') is not null
    ),
    array[]::text[]
  ),
  updated_at = pg_catalog.now()
  where b.id = p_business_id;
end;
$$;

create or replace function private.refresh_search_aliases_from_unit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.refresh_business_search_aliases(old.business_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if tg_op <> 'UPDATE' or new.business_id is distinct from old.business_id then
      perform private.refresh_business_search_aliases(new.business_id);
    else
      perform private.refresh_business_search_aliases(new.business_id);
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists business_network_units_refresh_search_aliases
  on public.business_network_units;

create trigger business_network_units_refresh_search_aliases
after insert or update or delete on public.business_network_units
for each row execute function private.refresh_search_aliases_from_unit();

create or replace function private.refresh_search_aliases_from_alias()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_network_id bigint;
  v_business_id bigint;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_network_id := old.network_id;
    for v_business_id in
      select u.business_id
      from public.business_network_units u
      where u.network_id = v_network_id
    loop
      perform private.refresh_business_search_aliases(v_business_id);
    end loop;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    v_network_id := new.network_id;
    if tg_op <> 'UPDATE' or new.network_id is distinct from old.network_id then
      for v_business_id in
        select u.business_id
        from public.business_network_units u
        where u.network_id = v_network_id
      loop
        perform private.refresh_business_search_aliases(v_business_id);
      end loop;
    elsif tg_op = 'UPDATE' then
      for v_business_id in
        select u.business_id
        from public.business_network_units u
        where u.network_id = v_network_id
      loop
        perform private.refresh_business_search_aliases(v_business_id);
      end loop;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists business_network_aliases_refresh_search_aliases
  on public.business_network_aliases;

create trigger business_network_aliases_refresh_search_aliases
after insert or update or delete on public.business_network_aliases
for each row execute function private.refresh_search_aliases_from_alias();

create or replace function private.refresh_search_aliases_from_network()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_business_id bigint;
begin
  if new.name is distinct from old.name
     or new.is_active is distinct from old.is_active then
    for v_business_id in
      select u.business_id
      from public.business_network_units u
      where u.network_id = new.id
    loop
      perform private.refresh_business_search_aliases(v_business_id);
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists business_networks_refresh_search_aliases
  on public.business_networks;

create trigger business_networks_refresh_search_aliases
after update of name, is_active on public.business_networks
for each row execute function private.refresh_search_aliases_from_network();

do $$
declare
  v_business_id bigint;
begin
  for v_business_id in
    select distinct u.business_id
    from public.business_network_units u
  loop
    perform private.refresh_business_search_aliases(v_business_id);
  end loop;
end;
$$;

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
          else 0::real
        end,
        case
          when p.query_text is not null
           and p.query_length >= 3
           and extensions.word_similarity(p.normalized_query, p.normalized_name) >=
             case
               when p.query_length <= 3 then 0.65
               when p.query_length <= 5 then 0.50
               else 0.42
             end
          then (60 + extensions.word_similarity(p.normalized_query, p.normalized_name) * 35)::real
          else 0::real
        end,
        case
          when p.query_text is not null
           and p.query_length >= 4
           and extensions.word_similarity(p.normalized_query, p.normalized_document) >=
             case
               when p.query_length <= 5 then 0.55
               else 0.44
             end
          then (48 + extensions.word_similarity(p.normalized_query, p.normalized_document) * 32)::real
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
               when p.query_length <= 3 then 0.65
               when p.query_length <= 5 then 0.50
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
          when p.query_length >= 4
           and extensions.word_similarity(
             p.normalized_query,
             pg_catalog.lower(
               public.search_normalize(pg_catalog.concat_ws(' ', ci.name, ci.description))
             )
           ) >=
             case
               when p.query_length <= 5 then 0.58
               else 0.46
             end
          then (
            44 + extensions.word_similarity(
              p.normalized_query,
              pg_catalog.lower(
                public.search_normalize(pg_catalog.concat_ws(' ', ci.name, ci.description))
              )
            ) * 34
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
  'Busca pública tolerante a acentos, pontuação, espaços, ordem de palavras, aliases e erros de digitação, com ordenação por relevância.';
