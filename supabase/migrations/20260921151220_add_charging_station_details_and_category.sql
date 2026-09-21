-- Categoria específica e detalhes técnicos verificáveis dos pontos de recarga.
create table if not exists public.charging_station_details (
  business_id bigint primary key references public.businesses(id) on delete cascade,
  power_kw numeric(7,2) check (power_kw > 0 and power_kw <= 1000),
  power_type text check (power_type in ('AC','DC','AC/DC')),
  connectors text[] not null default '{}',
  opening_hours_text text check (opening_hours_text is null or char_length(opening_hours_text) <= 180),
  access_type text not null default 'unknown' check (access_type in ('public','customers','restricted','unknown')),
  source_url text not null check (source_url ~ '^https://[^[:space:]]+$'),
  source_external_id text unique,
  source_license text,
  source_checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.charging_station_details enable row level security;
revoke all on public.charging_station_details from anon, authenticated;
grant select on public.charging_station_details to anon, authenticated;
grant all on public.charging_station_details to service_role;
drop policy if exists charging_station_details_public_read on public.charging_station_details;
create policy charging_station_details_public_read on public.charging_station_details for select to anon, authenticated
using (
  exists (
    select 1 from public.businesses b
    join public.categories c on c.id = b.category_id
    where b.id = charging_station_details.business_id
      and c.slug = 'eletropostos'
      and b.is_active
      and b.publication_status = 'published'
      and not b.billing_suspended
  )
);

insert into public.categories (slug,name,description,icon,display_order,is_active)
values (
  'eletropostos','Eletropostos',
  'Pontos de recarga de veículos elétricos; potência, conectores e horários conforme fontes verificadas.',
  '⚡',25,true
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  display_order = excluded.display_order,
  is_active = true;
