# O Calçadão — plano orgânico para primeira página do Google

**Início:** 30/09/2026  
**Objetivo:** aumentar a presença orgânica do O Calçadão sem mídia paga, começando por Assis/SP e expandindo conforme evidência de indexação, impressões e posição.

## Meta principal

Colocar o O Calçadão na primeira página do Google para consultas locais relevantes e não relacionadas à marca, começando por Assis/SP.

Exemplos de consultas-alvo iniciais:
- restaurantes em Assis SP
- oficinas em Assis SP
- eletropostos em Assis SP
- farmácias em Assis SP
- academias em Assis SP
- supermercados em Assis SP
- autopeças em Assis SP
- hotéis em Assis SP
- materiais de construção em Assis SP
- lojas em Assis SP

A primeira página será tratada como posição orgânica aproximada 1–10. O acompanhamento deve ser feito principalmente pelo Google Search Console, não por buscas manuais personalizadas.

## Princípios

1. Custo de mídia: R$ 0.
2. Não comprar backlinks.
3. Não criar páginas vazias, doorway pages ou textos artificiais em escala.
4. Não inventar endereço, telefone, horário, avaliação, coordenada ou descrição.
5. Só indexar páginas locais quando houver catálogo real suficiente.
6. Priorizar qualidade de dados, utilidade e boa ligação interna.
7. Medir antes e depois de cada ciclo.

## Situação de partida

Já existe:
- sitemap indexado por lotes de vitrines;
- URLs canônicas;
- vitrines individuais `/loja/[slug]`;
- página nacional `/descobrir`;
- marcação JSON-LD `LocalBusiness` quando há dados suficientes;
- fila administrativa de qualidade SEO;
- busca interna com `noindex`.

Gargalo identificado:
- uma única página nacional `/descobrir` tem baixa capacidade de responder a consultas genéricas do tipo categoria + cidade;
- precisamos criar presença local indexável com páginas úteis e dados reais, sem gerar páginas em massa sem conteúdo.

## Fase 0 — Baseline

### Medir
- páginas indexadas;
- páginas descobertas e não indexadas;
- impressões;
- cliques;
- CTR;
- posição média;
- principais consultas;
- principais páginas;
- consultas que já aparecem entre posições 11 e 30.

### Resultado esperado
Criar um placar semanal com:
- Top 10;
- posições 11–20;
- posições 21–50;
- páginas com impressão e zero clique;
- páginas com CTR abaixo do esperado.

## Fase 1 — Arquitetura local

### Implementação
Criar uma rota de cidade:
- `/cidade/assis-sp`
- depois outras cidades conforme catálogo suficiente.

A página deve:
- ter título e descrição próprios;
- ter canonical;
- listar estabelecimentos reais da cidade;
- mostrar quantidade real de vitrines elegíveis;
- ter links HTML para vitrines;
- ter conteúdo de contexto real;
- usar `noindex,follow` se a cidade não atingir o limiar mínimo;
- nunca depender de texto inventado.

### Critério inicial de elegibilidade
- cidade ativa;
- pelo menos 10 vitrines publicadas, ativas e não suspensas.

Esse número pode ser aumentado após observar qualidade e indexação.

## Fase 2 — Cidade + categoria

Somente depois da página de cidade estar consolidada.

Exemplos:
- `/cidade/assis-sp/alimentacao`
- `/cidade/assis-sp/automotivo`
- `/cidade/assis-sp/eletropostos`

Critérios:
- categoria válida;
- quantidade mínima de resultados;
- conteúdo real suficiente;
- canonical próprio;
- sem duplicidade com busca interna.

Não liberar dezenas de combinações de uma vez. Começar pelas categorias de maior demanda e melhor cobertura.

## Fase 3 — Qualidade das vitrines

Prioridades:
1. título local correto;
2. categoria específica;
3. endereço completo;
4. bairro;
5. coordenadas confiáveis;
6. telefone;
7. site/cardápio/catálogo;
8. horário;
9. imagens;
10. descrição real quando houver fonte.

Dados estruturados:
- manter `LocalBusiness`;
- evoluir para subtipos Schema.org quando houver mapeamento confiável;
- incluir geo somente quando coordenadas forem confiáveis;
- incluir openingHoursSpecification somente com horário confirmado.

## Fase 4 — Linkagem interna

Estrutura alvo:

`/`
→ `/descobrir`
→ páginas de cidade
→ categorias locais
→ vitrines

Cada vitrine deve apontar de volta para:
- cidade;
- categoria;
- descoberta.

Evitar páginas órfãs.

## Fase 5 — Sitemap

Criar sitemap específico para páginas locais elegíveis.

Exemplo:
- `/sitemaps/cidades`
- no futuro `/sitemaps/categorias-locais`

Somente URLs indexáveis entram no sitemap.

## Fase 6 — Autoridade sem pagar

Ações:
- botão/CTA para empresa compartilhar sua vitrine;
- selo “Estamos no O Calçadão” com link;
- páginas úteis para entidades locais;
- menções em sites de associações comerciais, eventos e parceiros;
- divulgação orgânica das vitrines pelos próprios estabelecimentos.

Nunca comprar links.

## Fase 7 — Conteúdo derivado de dados reais

Usar o catálogo para gerar informação útil sem inventar texto.

Exemplos:
- quantidade de estabelecimentos por categoria;
- bairros com presença daquela categoria;
- estabelecimentos recentemente atualizados;
- eletropostos cadastrados;
- categorias com maior cobertura.

Todo número deve vir do banco em tempo real ou de processo auditável.

## Fase 8 — Expansão geográfica

Ordem sugerida após Assis:
1. Presidente Prudente
2. Marília
3. Ourinhos
4. Bauru
5. Botucatu
6. Ribeirão Preto
7. Olímpia
8. Sumaré

A ordem poderá mudar conforme dados reais do Search Console e cobertura do catálogo.

## Ciclo semanal

Toda semana:
1. medir Search Console;
2. identificar consultas em posições 11–30;
3. selecionar 3 a 5 oportunidades;
4. corrigir página/conteúdo/linkagem;
5. conferir indexação;
6. registrar antes/depois;
7. repetir.

## KPIs

### Primários
- consultas no Top 10;
- cliques orgânicos;
- impressões;
- páginas indexadas elegíveis.

### Secundários
- CTR;
- posição média por consulta;
- vitrines recebendo tráfego orgânico;
- quantidade de cidades com página indexável;
- quantidade de links externos naturais.

## Critérios de segurança SEO

Não fazer:
- conteúdo duplicado em escala;
- páginas por cidade sem catálogo real;
- páginas por categoria com poucos resultados;
- texto gerado apenas para repetir palavra-chave;
- backlinks comprados;
- alteração de dados comerciais sem fonte;
- schema com dados não exibidos na página.

## Primeira execução — 30/09/2026

Iniciar com:
- [x] criar este plano;
- [x] criar infraestrutura de slug local;
- [x] criar landing page de cidade indexável somente acima do limiar mínimo;
- [ ] adicionar links de descoberta para páginas locais elegíveis;
- [ ] adicionar sitemap de cidades elegíveis;
- [ ] validar build/lint;
- [ ] medir baseline no Search Console;
- [ ] criar painel/relatório semanal de consultas-alvo;
- [ ] selecionar as primeiras categorias locais de Assis com base em cobertura real.

## Critério de sucesso da primeira etapa

A primeira etapa termina quando:
- Assis possuir landing local válida e indexável;
- a URL estiver no sitemap;
- houver links internos suficientes para descoberta;
- Search Console reconhecer a URL;
- começarmos a receber impressões para consultas locais não relacionadas à marca.

Depois disso, avançar para cidade + categoria.
