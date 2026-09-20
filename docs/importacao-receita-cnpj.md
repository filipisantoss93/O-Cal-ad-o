# Importação Receita Federal — pré-cadastro de empresas privadas

## Situação verificada em 20/09/2026

O arquivo oficial `Municipios.zip` e os arquivos `Empresas*.zip`/`Estabelecimentos*.zip` de 2026-08 responderam com byte-range HTTP 206 no processo `pg_net` do banco, mas o servidor oficial encerrou a conexão (`curl 56 / connection reset`) tanto no GitHub Actions Ubuntu como no macOS. Uma Edge Function Supabase também falhou ao baixar do servidor (HTTP 502). A conexão de controle GitHub OIDC com o Supabase foi validada.

**Não configurar execução nacional automática nem afirmar importação concluída até um lote de CNPJ real ser persistido e auditado.**

## Pré-requisito de infraestrutura para execução

É necessário um runner Linux x64 confiável, autorizado pelo dono do projeto, **com acesso legítimo** ao compartilhamento público da RFB, ou arquivos ZIP oficiais já baixados e verificados localmente. Não desativar certificados TLS, não usar proxies para contornar restrições e não baixar de sites sem procedência comprovada.

1. Registrar runner *self-hosted* neste repositório, Linux x64, adicionando o label customizado `rfb-cnpj`. Instalar Python 3.12+ e espaço livre para todos os arquivos a serem processados.
2. Baixar a **mesma competência** da fonte oficial (ex.: `2026-08`): `Municipios.zip`, `Estabelecimentos0.zip`, e `Empresas0.zip` a `Empresas9.zip`. Não misturar competências. Conferir assinatura e estrutura ZIP, registrar SHA-256 no ambiente do runner e confirmar URL oficial de origem.
3. Se os ZIPs já estiverem disponíveis no runner, definir uma variável **do repositório** no GitHub Actions chamada `RFB_OFFICIAL_ARCHIVES_DIR` com o caminho absoluto do diretório que contém os ZIPs. A rotina consumirá os arquivos locais; não fará novo download. Não versionar nem publicar esses arquivos no Git.
4. Abrir GitHub → Actions → **Piloto de importação CNPJ - Receita Federal** → Run workflow, branch `main`, competência confirmada, arquivo `Estabelecimentos0`, cidade Assis, UF SP, `max_candidates=20`. O workflow é manual e não possui cron.
5. Conferir logs sem copiar o token OIDC. Para validar dados no Supabase, consultar as tabelas `business_data_sources` (fonte `rfb_cnpj_open_data`), `business_source_records` e `businesses` vinculadas. Confirmar contagem real, candidatos de duplicidade, classificação por CNAE, complemento e que todos os novos cadastros tenham `owner_id IS NULL`, `pre_registered=true`, `publication_status='unpublished'` e `listing_type='business'`.
6. Repetir o **mesmo** lote antes de aumentar a abrangência e verificar que o número de perfis criados não aumentou (idempotência). Conferir detalhes de endereço e publicação manual antes de autorizar novos arquivos, outras cidades ou agendamento nacional.

## Regras de segurança

- O endpoint de importação aceita exclusivamente o OIDC da workflow configurada na branch `main`, acionada manualmente; a RPC no banco concede execução apenas a `service_role`.
- Nunca importar ou publicar dados do quadro societário, CPF, telefone, e-mail ou CNPJ visível no slug da vitrine. A tabela de proveniência protegida pode usar CNPJ como identificador de deduplicação.
- Naturezas jurídicas de administração pública, empresário individual e pessoa física ficam fora do piloto. O filtro requer situação ativa, CNAE mapeado, nome fantasia e endereço empresarial.
- Cadastro ativo na Receita não comprova atendimento ao público ou operação no endereço. Por isso, **não publicar automaticamente** os perfis importados.
- Locais com mesmo endereço e complemento não são automaticamente fundidos. Correspondências suspeitas são revisadas por humano.

**Critério de conclusão:** pelo menos um lote real importado com registros validados, zero publicação automática, execução repetida sem duplicidades e auditoria dos dados de origem. Testes com registros sintéticos em transação revertida não substituem este critério.
