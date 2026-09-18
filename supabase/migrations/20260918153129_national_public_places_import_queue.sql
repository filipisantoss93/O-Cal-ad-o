insert into public.business_data_sources (
  code,name,source_type,domain,base_url,priority,is_active,
  is_official,reliability,allows_import,terms_url,notes,last_verified_at
)
values (
  'cnes_public_health',
  'CNES - estabelecimentos públicos de saúde',
  'government',
  'apidadosabertos.saude.gov.br',
  'https://apidadosabertos.saude.gov.br/cnes/estabelecimentos',
  95,true,true,95,true,
  'https://dadosabertos.saude.gov.br/',
  'Importação nacional somente de estabelecimentos cuja natureza jurídica pertence à categoria Administração Pública (grupo 1xxx).',
  now()
)
on conflict (code) do update set
  name=excluded.name,
  source_type=excluded.source_type,
  domain=excluded.domain,
  base_url=excluded.base_url,
  priority=excluded.priority,
  is_active=true,
  is_official=true,
  reliability=excluded.reliability,
  allows_import=true,
  terms_url=excluded.terms_url,
  notes=excluded.notes,
  last_verified_at=now();

create table if not exists public.public_place_import_jobs (
  id bigint generated always as identity primary key,
  source_id bigint not null references public.business_data_sources(id) on delete restrict,
  city_id bigint not null references public.cities(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','processing','completed','partial','failed','paused')),
  priority smallint not null default 50 check (priority between 0 and 100),
  cursor_offset integer not null default 0 check (cursor_offset >= 0),
  attempts integer not null default 0 check (attempts >= 0),
  total_found integer not null default 0 check (total_found >= 0),
  total_created integer not null default 0 check (total_created >= 0),
  total_matched integer not null default 0 check (total_matched >= 0),
  total_ignored integer not null default 0 check (total_ignored >= 0),
  total_errors integer not null default 0 check (total_errors >= 0),
  last_error text,
  next_run_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, city_id)
);

alter table public.public_place_import_jobs enable row level security;
revoke all on table public.public_place_import_jobs from anon, authenticated;
grant select,insert,update,delete on table public.public_place_import_jobs to service_role;
grant usage,select on sequence public.public_place_import_jobs_id_seq to service_role;

create index if not exists public_place_import_jobs_dispatch_idx
  on public.public_place_import_jobs(status,next_run_at,priority desc,id)
  where status in ('pending','partial','failed');

insert into public.public_place_import_jobs (source_id,city_id,status,priority,next_run_at)
select s.id,c.id,'pending',
       case
         when (c.state_code,c.name) in (
           ('AC','Rio Branco'),('AL','Maceió'),('AP','Macapá'),('AM','Manaus'),
           ('BA','Salvador'),('CE','Fortaleza'),('DF','Brasília'),('ES','Vitória'),
           ('GO','Goiânia'),('MA','São Luís'),('MT','Cuiabá'),('MS','Campo Grande'),
           ('MG','Belo Horizonte'),('PA','Belém'),('PB','João Pessoa'),('PR','Curitiba'),
           ('PE','Recife'),('PI','Teresina'),('RJ','Rio de Janeiro'),('RN','Natal'),
           ('RS','Porto Alegre'),('RO','Porto Velho'),('RR','Boa Vista'),
           ('SC','Florianópolis'),('SP','São Paulo'),('SE','Aracaju'),('TO','Palmas')
         ) then 100
         when exists (
           select 1 from public.businesses b
           where b.city_id=c.id and b.is_active=true
           group by b.city_id
           having count(*) >= 100
         ) then 80
         else 50
       end,
       now()
from public.business_data_sources s
cross join public.cities c
where s.code='cnes_public_health'
  and c.is_active=true
on conflict (source_id,city_id) do nothing;

comment on table public.public_place_import_jobs is
  'Fila nacional de importação de locais públicos por município e fonte; sem acesso de anon/authenticated.';
