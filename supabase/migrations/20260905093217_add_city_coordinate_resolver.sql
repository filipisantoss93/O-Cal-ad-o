-- Identificação do município a partir das coordenadas do dispositivo.
begin;

create or replace function public.resolve_city_by_coordinates(
  input_latitude double precision,
  input_longitude double precision
)
returns table (
  id bigint,
  ibge_code integer,
  name text,
  state_code text
)
language sql
stable
security definer
set search_path = ''
as $$
  with current_point as (
    select extensions.st_setsrid(
      extensions.st_point(input_longitude, input_latitude),
      4326
    ) as value
    where input_latitude between -90 and 90
      and input_longitude between -180 and 180
  )
  select city.id, city.ibge_code, city.name, city.state_code
  from private.city_boundaries as city_boundary
  join public.cities as city on city.id = city_boundary.city_id
  cross join current_point
  where city.is_active = true
    and city_boundary.boundary operator(extensions.&&) current_point.value
    and extensions.st_covers(city_boundary.boundary, current_point.value)
  order by extensions.st_area(city_boundary.boundary) asc
  limit 1;
$$;

revoke all on function public.resolve_city_by_coordinates(
  double precision, double precision
) from public, anon, authenticated;
grant execute on function public.resolve_city_by_coordinates(
  double precision, double precision
) to anon, authenticated;

comment on function public.resolve_city_by_coordinates(
  double precision, double precision
) is 'Retorna somente a cidade pública correspondente às coordenadas; não persiste a localização recebida.';

analyze public.states;
analyze public.cities;
analyze private.city_boundaries;

commit;
