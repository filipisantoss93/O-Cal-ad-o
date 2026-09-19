# O Calçadão — plano para descoberta de comércios locais no Google

**Atualização:** 19/09/2026  
**Objetivo:** permitir que buscas pelo nome do comércio, categoria e cidade encontrem páginas públicas úteis do O Calçadão. Aumentar a descoberta orgânica sem prometer posição ou indexação automática.

## Diagnóstico inicial (código em `main` em 19/09/2026)

- [x] Metadados globais em `src/app/layout.tsx` e títulos específicos em `src/app/loja/[slug]/page.tsx`.
- [x] `src/app/robots.ts` aponta para `/sitemap.xml`; `src/app/sitemap.ts` inclui algumas URLs fixas e vitrines públicas.
- [ ] A consulta ao sitemap não está paginada; limites do PostgREST podem omitir lojas à medida que a base cresce.
- [ ] Metadados das vitrines não usam sistematicamente nome + categoria + cidade/UF, nem URL canônica explícita.
- [ ] Vitrines não expõem JSON-LD individual do estabelecimento.
- [ ] `/buscar` depende de cidade em cookie; parâmetros de busca não são uma página pública estável de destino do Google.
- [ ] Não há páginas indexáveis, úteis e permanentes por cidade e categoria.
- [ ] Não há comprovação, nesta análise de código, da indexação efetiva, do acesso do Googlebot, ou da configuração do Search Console. **Confirmar em produção**.

## Fase 1 — fundação técnica (iniciada)

- [x] Paginar a leitura de lojas publicadas, ativas e não suspensas no sitemap; não incluir prévias, contas ou páginas administrativas.
- [ ] Respeitar o limite de 50.000 URLs/50 MB por sitemap; particionar em índice + arquivos por lote **antes** que o site alcance esse limite. Para grandes importações nacionais, definir estratégia de atualização e paginação estável por ID.
- [x] Gerar título, descrição e canonical por vitrine com nome do estabelecimento, município e UF. Manter prévias administrativas com `noindex`.
- [x] Gerar JSON-LD `LocalBusiness` para comércio físico, somente com dados reais que aparecem na página: nome, URL, endereço e campos opcionais confirmados. Para locais públicos, avaliar o tipo de esquema apropriado; nunca apresentar um órgão público como estabelecimento comercial.
- [x] Proibir indexação de resultados de busca internos dependentes de cookie ou parâmetros; não listar `/buscar` como destino de SEO no sitemap.
- [ ] Revisar `robots.txt` e proteção do painel isolado; **robots não substitui autenticação**.
- [ ] Testar sitemap, canonical e JSON-LD em ambiente de homologação e após deploy.

**Implementação inicial:** branch `feat/seo-descoberta-local-20260919`. Os itens marcados acima representam mudanças no código; o comportamento em produção e a indexação ainda exigem testes e publicação. O sitemap atual para em 49 mil vitrines: **antes do próximo patamar, substituir o limite pela partição em múltiplos sitemaps**, com verificação do limite de tamanho de 50 MB.

## Fase 2 — páginas locais permanentes

- [ ] Criar rotas públicas com cidade e UF explícitas e legíveis, por exemplo `/cidades/assis-sp` e `/cidades/assis-sp/automotivo`, a partir dos IDs oficiais de cidades/categorias. Tratar homônimos e redirecionar aliases para um único canonical.
- [ ] Renderizar conteúdo significativo no servidor para o Googlebot, sem exigir geolocalização, login, cookie ou JavaScript do visitante para ler as empresas.
- [ ] Mostrar lista paginada de lojas e lugares **publicados e ativos**, nome, categoria, bairro/endereço quando disponível e links HTML diretos às vitrines. Evitar páginas vazias, duplicadas, sem negócios ou com mera troca do nome da cidade.
- [ ] Criar navegação interna entre home → cidades → categorias → vitrines; oferecer seleção manual de localidade para usuários sem GPS.
- [ ] Implementar breadcrumbs visíveis e `BreadcrumbList` correspondente; noindex em filtros combinatórios sem valor próprio, canonicals apropriadas e tratamento de páginas paginadas.
- [ ] Adicionar rotas de cidade/categoria ao sitemap apenas quando houver conteúdo real suficiente, verificando paginação, alterações e remoções.

## Fase 3 — qualidade, confiança e desempenho

- [ ] Priorizar perfis completos com informações verificáveis: nome, endereço correto, município/UF, categoria, site/telefone/WhatsApp apenas quando fornecidos/confirmados, fotos autorizadas e produtos reais.
- [ ] Em perfis não reivindicados, sinalizar claramente o status, oferecer correção/remoção e não inventar horário, foto, avaliações, descrição, coordenadas ou vínculo oficial.
- [ ] Deduplicar redes/unidades e corrigir erros de cidade/lat-long antes de publicar dados de localização; não emitir `geo` estruturado para coordenadas incertas.
- [ ] Evitar texto repetitivo e páginas feitas exclusivamente para capturar consultas; atualizar ou retirar URLs que deixaram de ter conteúdo útil.
- [ ] Verificar HTML inicial, cache, status HTTP correto (200/404/410), estabilidade mobile e Core Web Vitals; compactar imagens sem alterar conteúdo factual.
- [ ] Construir presença da marca com links/editoriais legítimos de comerciantes e canais sociais; não comprar links ou criar avaliações falsas.

## Fase 4 — Google Search Console e validação

1. Confirmar a propriedade de domínio `ocalcadao.com.br` no [Search Console](https://search.google.com/search-console/), com o responsável pelo DNS.
2. Validar `https://ocalcadao.com.br/robots.txt`, `/sitemap.xml`, home, vitrines reais e futuras páginas de cidade com ferramenta de inspeção de URL. Confirmar que retornam 200 e não estão bloqueadas.
3. Enviar sitemap; comparar URLs declaradas com amostra de registros publicados elegíveis, inclusive páginas além da primeira faixa da consulta.
4. Testar vitrines públicas no [Teste de resultados avançados](https://search.google.com/test/rich-results) e no [validador Schema.org](https://validator.schema.org/); conferir se JSON-LD coincide com texto visível.
5. Confirmar `<link rel="canonical">`, meta robots, título, descrição, status de indexação, variantes com `?item=` e `?preview=admin`, e ausência de vitrine suspensa no sitemap.
6. Medir por **28 dias**, depois mensalmente: páginas indexadas / elegíveis, erros de rastreamento, impressões e cliques orgânicos por cidade/categoria/vitrine, CTR, consultas e conversões WhatsApp (sem atribuir tráfego orgânico automaticamente a qualquer clique).
7. Não tratar `site:ocalcadao.com.br` como auditoria completa; usar cobertura e inspeção de URLs no Search Console.

## Publicação / critérios de aceite

- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run build` verdes com env de build configurada.
- [ ] Testes de integração e amostras reais comprovam filtros de publicação, paginação, ausência de dados falsos e status HTTP.
- [ ] Revisão de deploy e do Search Console realizada; sem promessas de ranking ou indexação.

## Documentação oficial

- [Google: criação e envio de sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google: dados estruturados de empresas locais](https://developers.google.com/search/docs/appearance/structured-data/local-business?hl=pt-br)
- [Google: diretrizes gerais de dados estruturados](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Google: uso de noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
