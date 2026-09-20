-- A URL antiga /dados/cnpj/dados_abertos_cnpj/ retorna HTTP 404.
-- O compartilhamento público oficial do CNPJ foi verificado em 20/09/2026:
-- /2026-08/{Municipios,Empresas0,Empresas9,Estabelecimentos0}.zip respondem HTTP 206 application/zip.
update public.business_data_sources
set base_url='https://arquivos.receitafederal.gov.br/public.php/dav/files/YggdBLfdninEJX9/',
    notes=coalesce(notes,'')||' Download validado no compartilhamento público RFB/SERPRO+ em 20/09/2026; competência 2026-08.',
    last_verified_at=now()
where code='rfb_cnpj_open_data'
  and base_url<>'https://arquivos.receitafederal.gov.br/public.php/dav/files/YggdBLfdninEJX9/';
