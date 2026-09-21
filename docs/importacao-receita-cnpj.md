# Importação Receita Federal — pré-cadastro de empresas privadas

## Situação verificada em 21/09/2026

O arquivo oficial `Municipios.zip` e os arquivos `Empresas*.zip`/`Estabelecimentos*.zip` respondem por byte-range HTTP 206 e podem encerrar conexões longas. O importador baixa em faixas de 8 MiB, preserva o arquivo parcial, retoma do último byte confirmado, valida host, tamanho, tipo de conteúdo e estrutura ZIP. A conexão de controle GitHub OIDC com o Supabase está validada.

Em 21/09/2026, a execução real `#4` no `ubuntu-latest` confirmou que a RFB encerra a conexão do runner hospedado antes de enviar os cabeçalhos HTTP, inclusive após 12 tentativas. A importação terminou sem inserir registros. O runner hospedado não deve ser usado para essa fonte.

**Não configurar execução nacional automática nem afirmar importação concluída até um lote de CNPJ real ser persistido e auditado.**

## Execução do piloto

O piloto exige um runner Linux x64 confiável com o rótulo `rfb-cnpj` e acesso legítimo à fonte oficial, ou os ZIPs oficiais já baixados no próprio runner. Não desativar certificados TLS, não usar proxies para contornar restrições e não baixar de sites sem procedência comprovada.

1. Registrar um runner GitHub Actions próprio, Linux x64, com o rótulo adicional `rfb-cnpj` e Python 3.12+.
2. Confirmar a competência oficial disponível (ex.: `2026-08`). Todos os arquivos usados precisam pertencer à mesma competência.
3. Opcionalmente, definir `RFB_OFFICIAL_ARCHIVES_DIR` com `Municipios.zip`, `Estabelecimentos0.zip` e `Empresas0.zip` a `Empresas9.zip`, todos oficiais e da mesma competência. Os arquivos não devem ser versionados no Git.
4. Abrir GitHub → Actions → **Piloto de importação CNPJ - Receita Federal** → Run workflow, branch `main`, arquivo `Estabelecimentos0`, cidade Assis, UF SP, `max_candidates=20`. O workflow é manual e não possui cron.
5. Conferir logs sem copiar o token OIDC. Para validar dados no Supabase, consultar as tabelas `business_data_sources` (fonte `rfb_cnpj_open_data`), `business_source_records` e `businesses` vinculadas. Confirmar contagem real, candidatos de duplicidade, classificação por CNAE, complemento e que todos os novos cadastros tenham `owner_id IS NULL`, `pre_registered=true`, `publication_status='unpublished'` e `listing_type='business'`.
6. Repetir o mesmo lote e verificar que o número de perfis criados não aumentou. Só depois da auditoria ampliar arquivos, cidades ou agendamento.

## Regras de segurança

- O endpoint de importação aceita exclusivamente o OIDC da workflow configurada na branch `main`, acionada manualmente; a RPC no banco concede execução apenas a `service_role`.
- Nunca importar ou publicar dados do quadro societário, CPF, telefone, e-mail ou CNPJ visível no slug da vitrine. A tabela de proveniência protegida pode usar CNPJ como identificador de deduplicação.
- Naturezas jurídicas de administração pública, empresário individual e pessoa física ficam fora do piloto. O filtro requer situação ativa, CNAE mapeado, nome fantasia e endereço empresarial.
- Cadastro ativo na Receita não comprova atendimento ao público ou operação no endereço. Por isso, **não publicar automaticamente** os perfis importados.
- Locais com mesmo endereço e complemento não são automaticamente fundidos. Correspondências suspeitas são revisadas por humano.

**Critério de conclusão:** pelo menos um lote real importado com registros validados, zero publicação automática, execução repetida sem duplicidades e auditoria dos dados de origem. Testes com registros sintéticos em transação revertida não substituem este critério.
