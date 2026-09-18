create or replace function public.get_public_business_logo_paths(p_business_ids bigint[])
returns table (
  business_id bigint,
  resolved_logo_path text,
  logo_origin text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_business_ids is null
     or cardinality(p_business_ids) = 0
     or cardinality(p_business_ids) > 100
     or exists (
       select 1
       from unnest(p_business_ids) as requested_id
       where requested_id is null or requested_id <= 0
     )
  then
    raise exception 'invalid business id list';
  end if;

  return query
  select
    b.id,
    case
      when bnu.business_id is not null
       and bnu.use_own_logo = true
       and nullif(btrim(b.logo_path), '') is not null
        then b.logo_path
      when bnu.business_id is not null
       and nullif(btrim(bn.logo_path), '') is not null
        then bn.logo_path
      when nullif(btrim(b.logo_path), '') is not null
        then b.logo_path
      else null
    end as resolved_logo_path,
    case
      when bnu.business_id is not null
       and bnu.use_own_logo = true
       and nullif(btrim(b.logo_path), '') is not null
        then 'unit'
      when bnu.business_id is not null
       and nullif(btrim(bn.logo_path), '') is not null
        then 'network'
      when nullif(btrim(b.logo_path), '') is not null
        then 'business'
      else 'missing'
    end as logo_origin
  from public.businesses b
  left join public.business_network_units bnu
    on bnu.business_id = b.id
  left join public.business_networks bn
    on bn.id = bnu.network_id
   and bn.is_active = true
  where b.id = any(p_business_ids)
    and b.publication_status = 'published'
    and b.is_active = true
    and b.billing_suspended = false;
end;
$$;

revoke all on function public.get_public_business_logo_paths(bigint[]) from public;
grant execute on function public.get_public_business_logo_paths(bigint[]) to anon;
grant execute on function public.get_public_business_logo_paths(bigint[]) to authenticated;
grant execute on function public.get_public_business_logo_paths(bigint[]) to service_role;

comment on function public.get_public_business_logo_paths(bigint[]) is
'Retorna apenas o caminho público da logo resolvida: logo própria habilitada -> logo da rede -> logo do estabelecimento -> ausente.';
