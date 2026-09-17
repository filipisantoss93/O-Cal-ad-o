# Redesign da Home — Feed de Descoberta Local

## Objetivo

Transformar a tela inicial de O Calçadão em um feed de descoberta local escalável, orientado a mobile, capaz de trabalhar bem com centenas ou milhares de estabelecimentos por cidade sem carregar catálogos inteiros no cliente.

A home deve priorizar:

1. busca rápida;
2. categorias compactas;
3. inventário comercial pago (banner, destaques e promoções);
4. descoberta por proximidade;
5. produtos e serviços em destaque;
6. descoberta orgânica de novos estabelecimentos;
7. acesso ao catálogo completo em `/buscar`.

Este documento é a fonte de verdade da implementação. Itens só devem ser marcados como concluídos depois de implementados e validados.

---

## Problemas atuais

- O bloco `Perto de você` fica dentro do hero e pode exibir até 10 locais, criando uma primeira dobra excessivamente longa no mobile.
- Categorias ocupam muito espaço vertical para uma função de navegação rápida.
- Banner, destaques, promoções e produtos ficam separados por blocos grandes e acabam aparecendo tarde na navegação.
- A home ainda possui seções institucionais extensas que competem com o conteúdo real da cidade.
- Estados vazios comerciais ocupam espaço mesmo quando não há conteúdo disponível.
- O crescimento do banco exige limites rígidos por seção; a home não pode tentar representar o catálogo completo.

---

## Hierarquia final da Home

Ordem alvo:

1. `HomeHero`
   - seletor de cidade;
   - título curto;
   - busca;
   - sinais de confiança compactos.
2. `CompactCategories`
3. `RegionalPaidBanners`
4. `FeaturedBusinesses`
5. `CityPromotions`
6. `NearbyBusinesses`
7. `FeaturedCatalogItems`
8. `DiscoveryBusinesses`
9. CTA `Explorar todos`
10. `HomeMerchantCTA`
11. rodapé

Regras:

- Se uma seção comercial não tiver conteúdo, ela deve desaparecer sem deixar espaço vazio.
- A home mostra amostras; `/buscar` continua sendo o catálogo completo.
- Conteúdo patrocinado deve permanecer identificado de forma explícita.
- Conteúdo orgânico não deve parecer patrocinado.

---

## Arquitetura de Componentes

Novos componentes planejados em `src/components/home/`:

- `compact-categories.tsx`
  - categorias rápidas da home;
  - scroll horizontal no mobile;
  - linha/grid compacto no desktop.
- `home-feed-section.tsx`
  - título, subtítulo opcional, link de ação e espaçamento padrão.
- `discovery-businesses.tsx`
  - descoberta orgânica da cidade.
- `nearby-business-card.tsx` ou variante equivalente
  - card compacto para trilho de proximidade.
- `home-section-skeleton.tsx`
  - skeleton reutilizável para carregamento tardio.

Componentes existentes a adaptar:

- `src/app/page.tsx`
- `src/components/regional-paid-banners.tsx`
- `src/components/featured-businesses.tsx`
- `src/components/city-promotions.tsx`
- `src/components/nearby-businesses.tsx`
- `src/components/featured-catalog-items.tsx`

O `page.tsx` deve atuar principalmente como compositor de seções, sem concentrar regras de carregamento.

---

## Regras de Carregamento

### Acima da dobra

Carregar imediatamente:

- cidade selecionada;
- busca;
- categorias;
- banner regional.

### Conteúdo principal

Carregar logo após a seleção de cidade:

- destaques comerciais.

### Conteúdo abaixo da dobra

Planejar lazy loading por `IntersectionObserver`, iniciando o carregamento antes da entrada na viewport (aproximadamente 400–600 px).

Aplicar a:

- promoções;
- proximidade;
- produtos/serviços em destaque;
- descoberta orgânica.

### Limites da Home

- banner regional: 1 ativo visível por vez;
- comércios em destaque: 10 mobile / 20 desktop;
- promoções: 8–10;
- perto de você: 10;
- produtos/serviços em destaque: 10 mobile / 20 desktop;
- descoberta orgânica: 12.

Nenhuma seção da home deve buscar centenas de registros para filtrar no navegador.

---

## Regras de Banner

- Deve aparecer logo após categorias.
- Deve manter identificação `Patrocinado`.
- Deve manter rotação de campanhas existente.
- Se não houver banner para a cidade, retornar `null` sem reservar espaço.
- Métricas existentes de impressão e abertura devem ser preservadas.
- Evitar margens verticais excessivas para que pareça parte do feed.

---

## Regras de Destaques

- Manter regras comerciais atuais.
- Mobile: trilho horizontal com scroll e snap.
- Desktop: grid ou trilho amplo conforme melhor resultado visual.
- Não misturar conteúdo pago com descoberta orgânica.
- Preservar eventos de impressão e abertura.
- Evitar repetir o mesmo estabelecimento em descoberta orgânica quando ele já foi exibido como destaque na mesma composição.

---

## Regras de Categorias

- A home não deve usar os cards grandes de `CategoryGrid`.
- Exibir inicialmente 6–8 categorias relevantes.
- Incluir ação `Ver todas`.
- Mobile: uma faixa horizontal compacta.
- Desktop: linha ou grid de baixa altura.
- `CategoryGrid` pode continuar sendo usado em páginas específicas onde cards grandes façam sentido.

---

## Regras de Promoções e Itens em Destaque

- Se o resultado carregado for vazio, esconder a seção inteira.
- Não renderizar grandes placeholders vazios na home.
- Mobile: trilho horizontal.
- Desktop: grid/trilho de acordo com largura.
- O estado vazio continua permitido em páginas administrativas ou páginas específicas de catálogo.

---

## Regras de Proximidade

- `Perto de você` não deve permanecer dentro do hero.
- Exibir até 10 locais.
- Quando houver coordenadas, ordenar exclusivamente por distância, do mais próximo ao mais distante.
- Sem coordenadas, exibir locais da cidade sem afirmar ordenação por distância.
- Cadastro sem latitude/longitude continua permitido.
- Estabelecimentos sem coordenadas não podem bloquear o restante do feed.

---

## Descoberta Orgânica

Criar endpoint ou função pública específica para retornar aproximadamente 12 estabelecimentos elegíveis da cidade.

Critérios desejados:

- somente vitrines publicadas/ativas;
- diversidade de categorias;
- diversidade de estabelecimentos;
- mistura controlada entre perfis reivindicados e pré-cadastrados;
- evitar itens já exibidos como patrocinados na mesma composição;
- rotação estável por visitante + cidade + dia para não mudar a cada renderização;
- identificação visual neutra, sem selo de patrocinado.

A descoberta orgânica serve para distribuir visibilidade entre os centenas de cadastros sem transformar a home em uma listagem infinita.

---

## Estados e Resiliência

- Erro em uma seção não pode quebrar a home inteira.
- Skeleton deve ter o mesmo tamanho aproximado do conteúdo final.
- Seção comercial vazia deve desaparecer.
- Falha de banner não pode bloquear busca, destaques ou proximidade.
- Falha de promoções não pode bloquear as demais áreas.

---

## Performance

- Usar `next/image` com `sizes` adequado.
- Imagens abaixo da dobra não devem usar `priority`.
- Limitar quantidade de elementos no DOM.
- Filtragem, ordenação e limites devem ocorrer no servidor/banco.
- Categorias podem usar cache mais longo.
- Campanhas e banner devem manter cache compatível com rotação e métricas.
- Descoberta orgânica pode usar cache curto por cidade.
- Preservar scroll ao retornar de uma vitrine para a home será tratado em etapa posterior.

---

## Métricas Planejadas

Preservar métricas atuais de campanhas e adicionar, em fase posterior:

- `home_section_view`;
- `business_card_click`;
- `promotion_click`;
- `category_click`;
- `search_submit`;
- `view_all_click`.

Métricas orgânicas e métricas pagas devem permanecer separadas.

---

## Responsividade

### Mobile

- prioridade máxima de UX;
- trilhos horizontais para conteúdo repetitivo;
- categorias compactas;
- sem overflow horizontal global;
- somente o container do trilho pode rolar lateralmente.

### Tablet

- 2–3 cards visíveis quando aplicável.

### Desktop

- 4–5 cards simultâneos ou grid equivalente;
- maior densidade sem aumentar muito a altura das seções.

---

## Plano de Implementação

### P0 — Estrutura principal

- [x] Criar este documento de implementação.
- [ ] Compactar Hero.
- [ ] Remover `NearbyBusinesses` do Hero.
- [ ] Criar `CompactCategories`.
- [ ] Criar padrão de seção `HomeFeedSection`.
- [ ] Reposicionar banner regional logo após categorias.
- [ ] Transformar `FeaturedBusinesses` em trilho mobile.
- [ ] Remover blocos institucionais grandes da home.
- [ ] Ocultar seções comerciais vazias.
- [ ] Validar que regras comerciais existentes continuam intactas.

### P1 — Feed de descoberta

- [ ] Transformar `NearbyBusinesses` em trilho horizontal.
- [ ] Adaptar promoções para trilho.
- [ ] Adaptar produtos/serviços destacados para trilho.
- [ ] Criar `DiscoveryBusinesses`.
- [ ] Criar endpoint `/api/descobrir` ou função pública equivalente.
- [ ] Evitar duplicidade entre destaque pago e descoberta orgânica.
- [ ] Criar CTA forte para catálogo completo.

### P2 — Escala, métricas e performance

- [ ] Implementar lazy loading por viewport.
- [ ] Criar skeletons padronizados.
- [ ] Refinar cache por tipo de conteúdo.
- [ ] Preservar posição de scroll ao retornar da vitrine.
- [ ] Instrumentar métricas orgânicas.
- [ ] Validar Core Web Vitals/performance mobile.
- [ ] Revisar imagens e `sizes`.

---

## Critérios de Aceite

A nova home só pode ser considerada concluída quando:

- o hero não contiver listas extensas;
- categorias ocuparem uma única faixa compacta no mobile;
- banner e destaques estiverem visíveis cedo no fluxo;
- seções vazias não deixarem grandes espaços;
- nenhuma consulta da home carregar centenas de estabelecimentos;
- distância continuar correta quando houver coordenadas;
- cadastro sem coordenadas continuar permitido;
- inventário pago continuar identificado e mensurado;
- não houver overflow horizontal global;
- a home funcionar com localização permitida, negada e cidade manual;
- a navegação estiver validada em mobile, tablet e desktop;
- build e checks do projeto estiverem verdes antes do merge.

---

## Estratégia de Consolidação

- Trabalhar em uma única branch de feature enquanto este redesign estiver em andamento.
- Evitar criar soluções paralelas para a mesma seção.
- Reutilizar componentes existentes quando possível.
- Cada mudança deve atualizar este checklist.
- Abrir uma PR consolidada para revisão.
- Preferir squash no merge para manter `main` limpa.
- Não remover regras comerciais, métricas ou comportamentos existentes sem registrar a alteração neste documento.
