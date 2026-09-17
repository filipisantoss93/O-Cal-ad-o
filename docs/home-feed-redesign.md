# Redesign da Home — Feed de Descoberta Local

## Objetivo

Transformar a tela inicial de O Calçadão em um feed de descoberta local escalável, mobile-first e adequado para cidades com centenas ou milhares de estabelecimentos, sem carregar o catálogo inteiro no cliente.

A home deve priorizar, nesta ordem:

1. busca rápida;
2. categorias compactas;
3. inventário comercial pago (banner, destaques e promoções);
4. descoberta por proximidade;
5. produtos e serviços em destaque;
6. descoberta orgânica;
7. acesso ao catálogo completo em `/buscar`.

Este documento é a fonte de verdade da implementação. A reformulação está sendo mantida na branch `feat/home-feed-redesign` e na PR consolidada #25.

---

## Problemas que motivaram a mudança

- `Perto de você` ficava dentro do hero e podia renderizar 10 locais antes do restante do feed.
- Categorias ocupavam altura excessiva.
- Banner, destaques e promoções apareciam tarde na rolagem.
- Blocos institucionais grandes competiam com o conteúdo real da cidade.
- Estados vazios comerciais ocupavam espaço sem entregar valor.
- A home ainda se comportava como landing page, não como feed de descoberta.
- O crescimento do banco exige limites rígidos por seção e consultas server-side.

---

## Hierarquia alvo

1. `HomeHero`
   - cidade;
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
10. CTA para comerciantes
11. rodapé

### Regras gerais

- Se uma seção comercial não tiver conteúdo, ela deve desaparecer.
- A home exibe amostras; `/buscar` é o catálogo completo.
- Conteúdo pago deve permanecer identificado.
- Conteúdo orgânico não deve parecer patrocinado.
- Nenhuma seção pode carregar centenas de registros para filtrar no browser.

---

## Arquitetura

### Componentes criados

- `src/components/home/compact-categories.tsx`
  - navegação compacta de categorias;
  - scroll horizontal no mobile;
  - grid compacto em telas maiores.
- `src/components/home/home-feed-section.tsx`
  - padrão de título, descrição, ação, espaçamento e fundo das seções.

### Componentes adaptados

- `src/app/page.tsx`
- `src/components/regional-paid-banners.tsx`
- `src/components/featured-businesses.tsx`
- `src/components/city-promotions.tsx`
- `src/components/nearby-businesses.tsx`
- `src/components/featured-catalog-items.tsx`

### Componentes ainda planejados

- `src/components/home/discovery-businesses.tsx`
- `src/components/home/home-section-skeleton.tsx`
- helpers de lazy loading/viewport, se necessários.

O `page.tsx` deve permanecer como compositor; regras de carregamento devem ficar encapsuladas nos componentes responsáveis.

---

## Regras de carregamento

### Imediato

- cidade selecionada;
- busca;
- categorias;
- banner regional;
- destaques pagos.

### Abaixo da dobra

Planejado para etapa posterior:

- promoções;
- proximidade;
- produtos/serviços em destaque;
- descoberta orgânica.

Esses blocos devem evoluir para lazy loading com `IntersectionObserver`, iniciando a consulta aproximadamente 400–600 px antes de entrar na viewport.

### Limites

- banner: 1 campanha visível por vez;
- comércios em destaque: 10 mobile / 20 desktop;
- promoções: até 10 na home;
- perto de você: 10;
- produtos/serviços destacados: 10 mobile / 20 desktop;
- descoberta orgânica: 12.

---

## Banner regional

- aparece imediatamente depois das categorias;
- mantém o selo `Patrocinado`;
- mantém rotação existente;
- mantém métricas de impressão e abertura;
- se não houver banner, retorna `null`;
- usa espaçamento externo menor para se integrar ao feed.

---

## Comércios em destaque

- regras comerciais e endpoint existentes permanecem;
- mobile usa trilho horizontal com snap;
- desktop usa grid;
- seção inteira desaparece quando não houver campanha elegível;
- métricas existentes continuam sendo registradas;
- descoberta orgânica futura não deve duplicar estabelecimentos já exibidos como patrocinados.

---

## Categorias

- a home não utiliza mais os cards altos do `CategoryGrid`;
- exibe 7 atalhos + `Ver todas`;
- mobile usa scroll horizontal;
- desktop usa linha/grid compacto;
- `CategoryGrid` permanece disponível em outras páginas.

---

## Promoções

- resultado vazio não gera placeholder na home;
- seção desaparece quando não houver promoções;
- mobile usa trilho horizontal;
- desktop usa grid;
- limite visual da home: até 10 promoções.

---

## Perto de você

- foi removido do hero;
- agora possui seção própria;
- mobile usa trilho horizontal;
- desktop usa grid;
- continua limitado a 10 locais;
- com coordenadas, mantém ordenação por distância;
- sem coordenadas, informa que são locais da cidade sem afirmar ordenação por distância;
- estabelecimentos sem latitude/longitude continuam permitidos no sistema;
- itens patrocinados continuam identificados e medidos.

---

## Produtos e serviços destacados

- seção vazia desaparece;
- mobile usa trilho horizontal;
- desktop usa grid;
- continua respeitando `useFeaturedLimit()`.

---

## Descoberta orgânica — pendente

Criar endpoint/função pública para retornar aproximadamente 12 estabelecimentos elegíveis da cidade.

Critérios:

- somente vitrines públicas e ativas;
- diversidade de categorias;
- diversidade de estabelecimentos;
- permitir pré-cadastrados publicados;
- evitar repetição de negócios já exibidos em posições pagas;
- rotação estável por visitante + cidade + dia;
- nenhum selo de patrocinado;
- não depender de carregar o catálogo completo no cliente.

---

## Estados e resiliência

- erro de uma seção não pode quebrar a home;
- seções vazias não devem criar grandes espaços;
- falha de banner não pode bloquear os demais blocos;
- falha de promoções não pode bloquear proximidade/destaques;
- skeleton padronizado ainda será implementado.

---

## Performance

- usar `next/image` com `sizes` adequados;
- imagens abaixo da dobra não devem receber `priority`;
- limitar o DOM ao conteúdo realmente exibido;
- filtros, limites e ordenação ficam no servidor/banco;
- categorias podem usar cache mais longo;
- campanhas precisam continuar compatíveis com rotação e métricas;
- descoberta orgânica poderá usar cache curto por cidade;
- restauração de scroll ao voltar de uma vitrine será tratada em P2.

---

## Métricas futuras

Preservar as métricas pagas existentes e adicionar posteriormente:

- `home_section_view`;
- `business_card_click`;
- `promotion_click`;
- `category_click`;
- `search_submit`;
- `view_all_click`.

Métricas orgânicas e pagas devem permanecer separadas.

---

## Responsividade

### Mobile

- prioridade máxima;
- trilhos horizontais para conteúdo repetitivo;
- categorias compactas;
- sem overflow horizontal global;
- apenas os trilhos podem rolar lateralmente.

### Tablet

- aproximadamente 2–3 cards visíveis quando aplicável.

### Desktop

- grid de 4–5 cards conforme o bloco;
- maior densidade sem aumentar excessivamente a altura das seções.

---

## Checklist

### P0 — Estrutura principal

- [x] Criar documento mestre.
- [x] Compactar Hero.
- [x] Remover `NearbyBusinesses` do Hero.
- [x] Criar `CompactCategories`.
- [x] Criar `HomeFeedSection`.
- [x] Reposicionar banner logo após categorias.
- [x] Transformar `FeaturedBusinesses` em trilho mobile.
- [x] Remover blocos institucionais grandes.
- [x] Ocultar seções comerciais vazias.
- [ ] Validar lint/build da PR.
- [ ] Validar regras comerciais em preview.

### P1 — Feed de descoberta

- [x] Transformar `NearbyBusinesses` em trilho horizontal.
- [x] Adaptar promoções para trilho.
- [x] Adaptar produtos/serviços destacados para trilho.
- [ ] Criar `DiscoveryBusinesses`.
- [ ] Criar `/api/descobrir` ou função equivalente.
- [ ] Evitar duplicidade entre conteúdo pago e descoberta orgânica.
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

## Critérios de aceite

A reformulação só deve sair de draft quando:

- hero não contiver listas extensas;
- categorias ocuparem uma faixa compacta;
- banner e destaques aparecerem cedo;
- seções vazias não deixarem buracos;
- consultas da home tiverem limites explícitos;
- distância continuar correta quando houver coordenadas;
- cadastro sem coordenadas continuar permitido;
- conteúdo patrocinado continuar identificado e mensurado;
- não houver overflow horizontal global;
- localização permitida, negada e seleção manual funcionarem;
- mobile, tablet e desktop forem validados visualmente;
- lint e build estiverem verdes.

---

## Estratégia de consolidação

- Uma única branch para o redesign: `feat/home-feed-redesign`.
- Uma única PR consolidada: #25.
- Evitar componentes paralelos com a mesma responsabilidade.
- Atualizar este checklist conforme cada etapa é implementada.
- Manter a PR em draft enquanto houver itens estruturais pendentes.
- Preferir squash ao concluir para manter `main` limpa.
- Não remover regras comerciais, métricas ou comportamentos existentes sem registrar a mudança aqui.
