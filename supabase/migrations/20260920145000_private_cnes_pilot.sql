-- Piloto restrito a Assis/SP. Nenhuma execução agendada até validar a deduplicação.
-- A fonte CNES cobre somente estabelecimentos de saúde; empresas de outros setores
-- demandam fontes e importadores independentes, sem reutilizar a etiqueta public_place.
insert into public.business_data_sources
(code,name,source_type,domain,base_url,priority,is_active,
 is_official,reliability,allows_import,terms_url,notes,last_verified_at)
values
('cnes_private_health',
 'CNES - estabelecimentos privados de saúde (pessoa jurídica)',
 'government','apidadosabertos.saude.gov.br',
 'https://apidadosabertos.saude.gov.br/cnes/estabelecimentos',
 90,true,true,90,true,'https://dadosabertos.saude.gov.br/',
 'Somente estabelecimentos ativos com natureza jurídica 2xxx ou 3xxx; não importa pessoas físicas 4xxx, telefones, emails, CPF ou CNPJ. Pré-cadastro sem proprietário.',
 now())
on conflict (code) do update set
 name=excluded.name,
 notes=excluded.notes,
 last_verified_at=now();

-- O mesmo modelo de fila existente admite outras fontes, mas o piloto NÃO agenda
-- automaticamente os 5.571 municípios. Expandir após verificar amostra e métricas.
insert into public.public_place_import_jobs (source_id,city_id,status,priority,next_run_at)
select s.id,c.id,'pending',100,now()
from public.business_data_sources s
join public.cities c on c.name='Assis' and c.state_code='SP' and c.is_active=true
where s.code='cnes_private_health'
on conflict (source_id,city_id) do nothing;
