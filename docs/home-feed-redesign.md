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
- `src/components/home/discovery-businesses.tsx`
  - descoberta orgânica da cidade;
  - trilho mobile e grid desktop;
  - CTA para o catálogo completo.
- `src/components/home/home-section-skeleton.tsx`
  - skeleton reutilizável para as seções do feed;
  - variantes para cards normais e blocos compactos.
- `src/components/home/use-home-section-visibility.ts`
  - lazy loading com `IntersectionObserver`;
  - inicia o carregamento aproximadamente 500 px antes da viewport;
  - fallback seguro quando `IntersectionObserver` não estiver disponível.
- `src/components/home/home-scroll-restoration.tsx`
  - preserva a posição vertical da home ao abrir um destino interno;
  - restaura a posição ao retornar durante a mesma sessão.
- `src/app/api/descobrir/route.ts`
  - seleção limitada a 12 vitrines;
  - rotação estável por visitante + cidade + dia;
  - exclusão de negócios com campanha paga ativa;
  - priorização de variedade de categorias.

### Componentes adaptados

- `src/app/page.tsx`
- `src/components/business-card.tsx`
- `src/components/promotion-card.tsx`
- `src/components/featured-item-card.tsx`
- `src/components/regional-paid-banners.tsx`
- `src/components/featured-businesses.tsx`
- `src/components/city-promotions.tsx`
- `src/components/nearby-businesses.tsx`
- `src/components/featured-catalog-items.tsx`

O `page.tsx` permanece como compositor; regras de carregamento ficam encapsuladas nos componentes responsáveis.

---

## Regras de carregamento

### Imediato

- cidade selecionada;
- busca;
- categorias;
- banner regional;
- destaques pagos.

### Abaixo da dobra

Implementado com `IntersectionObserver` e margem antecipada de aproximadamente 500 px:

- promoções;
- proximidade;
- produtos/serviços em destaque;
- descoberta orgânica.

Enquanto a seção ainda não concluiu a consulta, é exibido um skeleton padronizado. Uma falha isolada encerra o estado de carregamento daquela seção sem bloquear o restante do feed.

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
- descoberta orgânica exclui negócios com campanha ativa de cidade/combo.

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
- limite visual da home: até 10 promoções;
- consulta adiada até a seção se aproximar da viewport.

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
- itens patrocinados continuam identificados e medidos;
- consulta adiada até a seção se aproximar da viewport.

---

## Produtos e serviços destacados

- seção vazia desaparece;
- mobile usa trilho horizontal;
- desktop usa grid;
- continua respeitando `useFeaturedLimit()`;
- consulta adiada até a seção se aproximar da viewport.

---

## Descoberta orgânica

Implementada por `DiscoveryBusinesses` + `/api/descobrir`.

Regras atuais:

- somente resultados públicos retornados pela busca pública existente;
- apenas `listingType = business`;
- exclusão de negócios com campanha ativa em posições de cidade/combo;
- até 12 vitrines;
- busca no máximo algumas páginas candidatas, nunca o catálogo inteiro;
- ordenação variável porém estável por visitante + cidade + dia;
- primeira passagem prioriza categorias diferentes;
- segunda passagem completa os espaços restantes;
- conteúdo não recebe selo de patrocinado;
- CTA leva para `/buscar`;
- consulta adiada até a seção se aproximar da viewport.

---

## Estados e resiliência

- erro de uma seção não pode quebrar a home;
- seções vazias não devem criar grandes espaços;
- falha de banner não pode bloquear os demais blocos;
- falha de promoções não pode bloquear proximidade/destaques;
- skeleton padronizado implementado para blocos carregados sob demanda;
- falhas de consulta abaixo da dobra encerram o loading local e não prendem o usuário em skeleton infinito.

---

## Performance

- `next/image` usa `sizes` compatíveis com a largura real dos trilhos mobile/tablet e com os grids desktop;
- `BusinessCard` permite `imageSizes` específico na home sem alterar o dimensionamento padrão das demais páginas;
- imagens abaixo da dobra não recebem `priority`;
- promoções, proximidade, produtos/serviços e descoberta orgânica são carregados apenas quando se aproximam da viewport;
- limitar o DOM ao conteúdo realmente exibido;
- filtros, limites e ordenação ficam no servidor/banco;
- categorias podem usar cache mais longo;
- campanhas precisam continuar compatíveis com rotação e métricas;
- descoberta orgânica usa resposta privada sem cache compartilhado por depender do visitante;
- a posição da home é preservada em `sessionStorage` ao navegar para destinos internos e restaurada ao retornar.

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

- grid de 4–6 cards conforme o bloco;
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
- [x] Validar lint/build da PR (GitHub Actions `Qualidade`, execução #217).
- [ ] Validar regras comerciais em preview.

### P1 — Feed de descoberta

- [x] Transformar `NearbyBusinesses` em trilho horizontal.
- [x] Adaptar promoções para trilho.
- [x] Adaptar produtos/serviços destacados para trilho.
- [x] Criar `DiscoveryBusinesses`.
- [x] Criar `/api/descobrir`.
- [x] Evitar duplicidade entre campanhas pagas ativas e descoberta orgânica.
- [x] Criar CTA forte para catálogo completo.

### P2 — Escala, métricas e performance

- [x] Implementar lazy loading por viewport.
- [x] Criar skeletons padronizados.
- [ ] Refinar cache por tipo de conteúdo.
- [x] Preservar posição de scroll ao retornar da vitrine.
- [ ] Instrumentar métricas orgânicas.
- [ ] Validar Core Web Vitals/performance mobile.
- [x] Revisar imagens e `sizes`.

---

## Validação técnica registrada

- preview da Vercel para a branch respondeu `200 OK` após a reorganização do feed;
- build com lazy loading e skeletons concluído com sucesso;
- build com restauração de scroll concluído com sucesso;
- build com revisão de `next/image sizes` concluído com sucesso;
- validação visual real em mobile/tablet/desktop e validação de todas as regras comerciais ainda são obrigatórias antes de retirar a PR do modo draft.

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
- descoberta orgânica não competir visualmente como conteúdo pago;
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
