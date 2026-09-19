# O Calçadão — descoberta de comércios locais no Google

**Atualizado:** 19/09/2026
**Estratégia aprovada:** criar somente uma página pública adicional de conteúdo: /descobrir. Manter /buscar e vitrines individuais /loja/[slug]. Não gerar páginas por cidade nem combinações cidade/categoria.

## Entregas no código

- [x] Vitrines com título, município/UF, URL canônica e JSON-LD LocalBusiness quando há endereço disponível (etapa anterior).
- [x] Página nacional /descobrir com seletor de cidade, busca, categorias e links HTML para vitrines públicas reais de diferentes cidades.
- [x] Links de navegação para /descobrir na home, cabeçalho e rodapé.
- [x] Índice /sitemap.xml apontando para sitemap de páginas fixas e sitemaps paginados de lojas.
- [x] No máximo 1.000 vitrines por sitemap, somente publicadas, ativas e não suspensas; sem teto artificial de 49 mil.
- [x] /buscar continua com noindex e fica fora do sitemap por depender da cidade selecionada.
- [ ] Validar acessos públicos, dados reais e contagem de URLs no ambiente de produção após deploy.
- [ ] Submeter o índice de sitemaps no Google Search Console, acompanhar rastreamento e indexação.

## Arquitetura: só uma página nova de conteúdo

- / — home já existente.
- /descobrir — única página de conteúdo nova, indexável; exibe amostra de vitrines por cidade e navega para busca atual.
- /buscar — busca interna existente, com seleção de cidade salva em cookie/localStorage, não indexável.
- /loja/[slug] — vitrine individual existente.
- /sitemap.xml — índice técnico XML, sem conteúdo editorial.
- /sitemaps/paginas — XML contendo home, descobrir e planos.
- /sitemaps/lojas/1, /sitemaps/lojas/2, ... — XML com lotes sucessivos de no máximo 1.000 vitrines.

Os endpoints XML **não são páginas de conteúdo adicionais**. A escolha de cidade em /descobrir usa o seletor atual e abre /buscar, sem criar uma URL editorial separada. Uma amostra de vitrines é renderizada no servidor em /descobrir com links para páginas individuais que já existem. Com isso, a descoberta por cidade/categoria pode ocorrer dentro da plataforma, mas a presença orgânica para buscas genéricas por categoria + cidade **não é garantida** por uma única página nacional.

## Verificações necessárias

- [ ] CI: npm run lint e npm run build sem erros; sem novas páginas de cidade.
- [ ] Abrir /descobrir sem localização/cookie e validar que os links das vitrines aparecem no HTML inicial; clicar cidade, categoria, pesquisa e vitrine.
- [ ] Abrir /sitemap.xml e checar Content-Type application/xml e tag sitemapindex; abrir primeiro e último sitemap de lojas e conferir URL da vitrine, filtros e 200 HTTP.
- [ ] Simular falha de banco e conferir status 503 em vez de apresentar sitemap parcial com 200; abrir lote inexistente e verificar 404.
- [ ] Conferir dados estruturados das vitrines reais, cidade correta e perfil não reivindicado; não inventar endereço, telefone, horário, coordenada ou avaliações.
- [ ] Após deploy, enviar /sitemap.xml ao Search Console, medir páginas elegíveis/indexadas, cliques, impressões, consultas e erros por 28 dias.

## Escalabilidade e limites

O índice informa todos os lotes pela contagem dos estabelecimentos elegíveis. Cada lote tem 1.000 URLs, bem abaixo dos limites publicados pelo Google de 50.000 URLs e 50 MB por sitemap. Os lotes são ordenados por ID. Importações/remoções podem mover estabelecimentos entre lotes, mas a URL canônica da vitrine se mantém estável. Os sitemaps têm cache curto para o Google detectar atualizações; após importações nacionais, conferir a última página.

Links: https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps ; https://search.google.com/search-console/ .
