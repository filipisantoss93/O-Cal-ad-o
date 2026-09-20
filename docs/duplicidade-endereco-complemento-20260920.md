# Duplicidades por endereço e complemento (20/09/2026)

## Regra aplicada no painel de perfis não reivindicados

Quando duas vitrines têm **nome, cidade, rua e número iguais**, o complemento (andar, sala, loja, unidade) deve ser comparado antes de concluir que se trata da mesma empresa:

- Complementos informados e diferentes: permitir cadastros separados; exemplos: sala 2301 e sala 2302, ou andar 12 e andar 23.
- Complementos iguais, inclusive diferenças apenas de maiúsculas, espaços, pontuação ou acentos: impedir cadastrar/alterar como se fosse nova unidade.
- Cadastro antigo sem complemento e novo registro com complemento específico: permitir o novo registro, pois o cadastro antigo não identifica a sala; **não presumir que os dois são duplicados nem mesclá-los automaticamente**. Havendo dúvida sobre identidade, revisar as fontes.
- Novo cadastro sem complemento e outro com complemento informado: pedir identificação de sala/andar para impedir o registro ambíguo.
- Ambos sem complemento: mesma chave de unidade informada; manter alerta de duplicidade e verificar os dados.
- Empresas com nomes distintos podem funcionar no mesmo prédio e na mesma sala, sem serem consideradas duplicadas apenas por compartilharem endereço.

A regra vale para a criação e edição de perfis não reivindicados. Em caso de conflito do slug da vitrine, o sistema gera um sufixo único, sem alterar a URL de perfis existentes.

## Escopo da auditoria SEO

A fila apresenta os complementos das duas vitrines para a comparação manual. Não concluir ou descartar uma pendência automaticamente: outros indícios, como fonte oficial, número da unidade, código externo e contato comercial, podem ser necessários. A importação nacional de redes já compara complementos informados e possui tratamento separado para complementos ausentes; não se deve equiparar endereço comercial à identidade de uma unidade.

## Verificações

- [ ] Editar o cadastro do exemplo de Londrina com sala/andar **realmente diferente**, mantendo nome, cidade, rua e número; a edição deve ser aceita.
- [ ] Tentar cadastrar/editar com o mesmo complemento de outra unidade; a ação deve sinalizar colisão.
- [ ] Confirmar que o endereço sem complemento antigo não bloqueia nova unidade identificada.
- [ ] Confirmar que duas empresas distintas no mesmo prédio não são bloqueadas.
- [ ] Verificar URL única e lista SEO com complemento visível.
- [ ] Não mesclar ou apagar os registros existentes sem checagem das fontes.

**Nota sobre a captura:** há no catálogo dois registros de «Bradesco - PLATAFORMA CORPORATE NORTE PARANA» na Av. Ayrton Senna da Silva, 500, em Londrina, e ambos já registram «ANDAR 23 SALA 2301 E 2302», embora apresentem bairros diferentes. Se a segunda unidade é realmente outra sala, o complemento precisa ser corrigido para refletir a sala real; só então a diferenciação se aplica. Nenhuma alteração factual foi realizada nesse par.
