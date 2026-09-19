# Auditoria SEO do catálogo — 19/09/2026

## Escopo e observação temporal

Consulta ao Supabase de produção, apenas `businesses` com `publication_status = 'published'`, `is_active = true` e `billing_suspended = false`. A importação nacional está em andamento: contagens mudam durante a execução. A aferição próxima à criação da fila registrou **69.513 perfis elegíveis**, sendo **21.463 empresas** e **48.050 locais públicos**. A fila foi preenchida em etapas e representa os registros encontrados no instante de cada lote. Reexecutar auditoria após cada importação significativa.

## Diagnóstico

| Tema | Registros observados | Interpretação / ação segura |
| --- | ---: | --- |
| Categoria genérica de empresas | 399 | 233 em “Outros” e 166 em “Serviços”; revisar categoria com fonte confiável antes de alterar. |
| Bairro vazio/placeholder | 2.779 na fila | Revisar fonte/endereço. Nunca inferir bairro só pela cidade. |
| Logradouro ausente ou placeholder | 8 | Registros de locais públicos de saúde, inclusive unidades móveis; não inventar endereço fixo nem coordenada. |
| Descrição ausente em empresas | 4.115 | Solicitar descrição ao responsável ou conferir evidências; não inventar atividade ou serviço. |
| Descrição ausente em locais públicos | 47.681 | Prioridade baixa para revisão em lote por fonte oficial; ausência de descrição própria não equivale a informação falsa. |
| Pares suspeitos por mesmo nome+cidade+logradouro+número normalizados | 9 pares (18 registros) | 4 pares com número informado, 5 com número “S/N”. Conferir se são estabelecimentos distintos, fontes de importação, unidade e `google_place_id`. **Nenhum foi mesclado ou excluído automaticamente.** |
| Endereço “S/N” | 12.314 empresas em amostra | “Sem número” não equivale a rua ausente; somente verificar endereço quando houver evidência conflitante. |
| Coordenadas ausentes | 18.359 empresas na amostra | Não publicar `geo` estruturado nem supor coordenadas; fluxo de geocodificação é separado. |

**Dados estruturados:** o código atual só gera `LocalBusiness` para `listing_type='business'` com endereço, cidade e UF na vitrine. Os 21.463 comércios do retrato analisado são *candidatos técnicos* à marcação básica por endereço; isso **não** valida a exatidão de cada endereço nem garante rich result ou indexação. Os 48.050 locais públicos não recebem `LocalBusiness` nessa implementação. O tipo adequado para cada subtipo de local público deve ser revisado com fontes confiáveis.

## Fila interna criada no banco

Tabela `public.business_seo_review_queue`, migration Supabase `create_internal_business_seo_review_queue`. Somente metadados de revisão foram inseridos; **nenhuma ficha de empresa, categoria, descrição, localização, vínculo de rede ou status de publicação foi modificada**. A fila tem RLS habilitada, nenhuma policy para usuários públicos e `SELECT/INSERT/UPDATE/DELETE` concedidos somente a `service_role`; tanto `anon` como `authenticated` não possuem `SELECT`. O painel administrativo ainda não possui uma tela específica desta fila, e não deve usar `service_role` no navegador.

**Após a carga inicial:** 54.991 pendências cobrindo 53.661 perfis, com prioridade e tipo:

| Prioridade | issue_code | Quantidade |
| --- | --- | ---: |
| P1 | `missing_street` | 8 |
| P1 | `possible_duplicate` com número identificável | 4 pares |
| P2 | `possible_duplicate` com “S/N” | 5 pares |
| P2 | `generic_category` | 399 |
| P2 | `missing_neighborhood` | 2.779 |
| P3 | `missing_business_description` | 4.115 |
| P4 | `missing_public_place_description` | 47.681 |

A prioridade 4 é uma fila de **revisão por fonte/lote**, não ordem para escrever 47 mil textos manualmente. Evitar preencher em massa descrições genéricas como se fossem serviços confirmados.

Consulta no SQL Editor do Supabase (acesso administrativo):

```sql
select q.priority, q.issue_code, q.id, q.business_id, b.name,
       b.slug, c.name as cidade, b.street, b.address_number,
       b.neighborhood, q.related_business_id, q.status
from public.business_seo_review_queue q
join public.businesses b on b.id=q.business_id
join public.cities c on c.id=b.city_id
where q.status='pending'
order by q.priority, q.created_at, q.id
limit 100;
```

Agrupamento de andamento:

```sql
select priority, issue_code, status, count(*) as total
from public.business_seo_review_queue
group by priority, issue_code, status
order by priority, issue_code, status;
```

A associação a cada estabelecimento é única por `(business_id, issue_code)`; pode-se repetir a coleta periodicamente usando `ON CONFLICT DO NOTHING` sem duplicar pendências. Antes de marcar como `resolved`, comparar o cadastro com a fonte e registrar a correção no fluxo de moderação. A fila não aplica edições automáticas nem resolve potenciais duplicatas.

## Ajustes de exibição seguros iniciados

A vitrine passa a desconsiderar marcadores como “SEM ENDERECO”, “SEM BAIRRO” e “Não informado” ao montar título/resumo/endereço exibido. Dados de origem permanecem inalterados. O JSON-LD `LocalBusiness` só é emitido quando há endereço não marcado como ausente. Testar HTML e dados estruturados em produção após o deploy.

## Próximos testes

- [ ] Confirmar deploy e verificar exemplo de local público com endereço “SEM ENDERECO” e empresa com bairro “Não informado”; conferência sem dados inventados.
- [ ] Abrir a fila no SQL Editor; revisar os 9 pares separadamente do candidato já pendente na `business_duplicate_candidates` (pipeline de importação).
- [ ] Revisar primeiro os 8 endereços ausentes e as 399 categorias genéricas de empresas, usando fonte oficial/evidências e sem reclassificação baseada somente no nome.
- [ ] Implementar no painel isolado leitura da fila através de API no servidor com autorização de admin; **não** expor `service_role` ao cliente.
- [ ] Repetir contagem e coleta idempotente após novas importações e monitorar indexação no Google Search Console.
