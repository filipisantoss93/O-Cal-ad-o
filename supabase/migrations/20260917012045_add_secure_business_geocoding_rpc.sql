create or replace function public.apply_business_geocoding(
  p_business_id bigint,
  p_latitude double precision,
  p_longitude double precision
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_city_id bigint;
  resolved_city_id bigint;
begin
  if p_latitude is null or p_longitude is null
     or p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180 then
    return false;
  end if;

  select b.city_id
    into expected_city_id
  from public.businesses b
  where b.id = p_business_id
    and b.listing_type = 'business'
    and b.latitude is null
    and b.longitude is null;

  if expected_city_id is null then
    return false;
  end if;

  select r.id
    into resolved_city_id
  from public.resolve_city_by_coordinates(p_latitude, p_longitude) r
  limit 1;

  if resolved_city_id is distinct from expected_city_id then
    return false;
  end if;

  update public.businesses
  set latitude = round(p_latitude::numeric, 6),
      longitude = round(p_longitude::numeric, 6)
  where id = p_business_id
    and listing_type = 'business'
    and latitude is null
    and longitude is null;

  return found;
end;
$$;

revoke all on function public.apply_business_geocoding(bigint, double precision, double precision) from public;
revoke all on function public.apply_business_geocoding(bigint, double precision, double precision) from anon;
revoke all on function public.apply_business_geocoding(bigint, double precision, double precision) from authenticated;
grant execute on function public.apply_business_geocoding(bigint, double precision, double precision) to service_role;