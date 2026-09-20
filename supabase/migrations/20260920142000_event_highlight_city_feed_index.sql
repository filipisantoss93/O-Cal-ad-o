-- Filtrar patrocínios por município ANTES do LIMIT: 200 destaques nacionais
-- não podem ocultar destaques pagos de uma cidade específica.
alter table public.event_highlights
 add column if not exists city_id bigint references public.cities(id);
update public.event_highlights eh set city_id=e.city_id
 from public.events e where e.id=eh.event_id and eh.city_id is distinct from e.city_id;
create or replace function private.event_highlight_set_city()
returns trigger language plpgsql set search_path='' as $$
begin
 select e.city_id into new.city_id from public.events e where e.id=new.event_id;
 if new.city_id is null then raise exception 'Evento inexistente para destaque.'; end if;
 return new;
end; $$;
drop trigger if exists event_highlights_city_sync on public.event_highlights;
create trigger event_highlights_city_sync before insert or update of event_id,city_id
 on public.event_highlights for each row execute function private.event_highlight_set_city();
create index if not exists event_highlights_feed_city_idx on public.event_highlights
 (city_id,status,starts_at,ends_at,event_id);
grant select(city_id) on public.event_highlights to anon,authenticated;
