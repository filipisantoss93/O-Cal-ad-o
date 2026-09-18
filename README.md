# O Calçadão

O Calçadão é um Centro Comercial para aproximar consumidores e comércios da
mesma cidade. No MVP, as pessoas encontram lojas, serviços, produtos e ofertas
e iniciam o contato diretamente pelo WhatsApp. A plataforma não intermedeia
pagamentos nesta primeira fase.

## Stack

- Next.js 16 com App Router
- TypeScript
- Tailwind CSS 4
- Supabase (Postgres, Auth e Storage)
- Interface mobile-first

## Estado atual

A aplicação contém:

- página inicial com busca, categorias, destaques e ofertas;
- listagem com busca e filtro por categoria;
- página pública de cada comércio;
- seleção manual por estado e município e identificação da cidade pela
  localização atual do dispositivo, com busca pelo endereço da loja como
  alternativa quando o GPS não estiver disponível;
- estados de carregamento, erro e página não encontrada;
- criação de conta, confirmação de e-mail, login, logout e recuperação de senha;
- painel protegido para o comerciante;
- cadastro e edição da loja, com logo e capa;
- contatos públicos opcionais para site, Instagram, Facebook e telefone fixo;
- criação, edição, ativação, pausa e exclusão de promoções;
- contratação de lojas em destaque por cidade, categoria ou nos dois espaços,
  com pacotes de 7, 15 e 30 dias;
- banners pagos na página inicial, segmentados pela cidade selecionada, com
  upload de arte, rodízio regional e pacotes de 7, 15 e 30 dias;
- painel administrativo para preços, capacidade, cortesias, pausas, bônus e
  cancelamentos das campanhas patrocinadas;
- rodízio de vitrines patrocinadas e métricas de impressão, visita, WhatsApp e
  solicitação de rota;
- edição do perfil, alteração de e-mail e alteração de senha;
- exclusão definitiva da conta e dos dados vinculados;
- clientes Supabase para navegador, servidor e renovação segura de sessão;
- schema com RLS para perfis, 27 estados, 5.571 municípios, categorias,
  comércios, produtos, promoções e imagens;
- malhas municipais do IBGE armazenadas no PostGIS para resolver coordenadas
  sem enviar a localização a serviços externos;
- Edge Function autenticada para excluir a conta;
- validação automática no GitHub Actions.

O painel do comerciante e as lojas publicadas usam dados reais do Supabase. Os
dados de `src/data/catalog.ts` permanecem como demonstração e fallback visual
quando ainda não há vitrines publicadas para um espaço.

## Destaques patrocinados

O comerciante contrata em `/painel/destaques`. A reserva de vaga, o preço e o
desconto Pro de 10% são calculados no banco antes de abrir o checkout da Efí.
Uma loja precisa estar aprovada, ativa, sem suspensão de cobrança e com logo e
capa para participar.

O administrador gerencia a operação em `/painel/admin/destaques`. Cada espaço
tem capacidade simultânea configurável; o combo consome uma vaga de cidade e
uma de categoria. Campanhas pagas são ativadas pelo webhook, processadas de
forma idempotente e concluídas pela rotina agendada a cada cinco minutos.

As métricas são deduplicadas por visitante, campanha, evento e dia. A indicação
“Patrocinado” acompanha as vitrines em destaque nas superfícies públicas.

Os banners regionais usam o mesmo checkout e desconto Pro. A arte é enviada
pelo comerciante no próprio painel e só começa a consumir os dias contratados
depois da confirmação do pagamento e da aprovação administrativa. O
administrador pode ajustar preços, limitar o inventário por cidade, aprovar ou
solicitar correções, pausar, cancelar e acompanhar impressões e cliques.

## CSS consolidado

Todo o CSS próprio do projeto fica em `src/app/globals.css`. Os componentes usam
as classes utilitárias do Tailwind e não possuem folhas de estilo paralelas.

## Configuração local

Requisitos: Node.js 22 e npm.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Depois, abra `http://localhost:3000`.

Preencha em `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://mieekhdagjlzdbeklrxp.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua_chave_publicavel
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Opcional: permite trocar a instância Nominatim usada na busca por endereço.
GEOCODING_API_URL=https://nominatim.openstreetmap.org/search
```

Use somente a chave publicável no navegador. Nunca adicione a chave secreta ou
`service_role` a uma variável `NEXT_PUBLIC_*`.

### Redirecionamentos do Supabase Auth

Em **Authentication > URL Configuration**, mantenha a URL pública da aplicação
como Site URL e autorize os callbacks usados pelo fluxo PKCE:

```text
http://localhost:3000/auth/confirm
https://ocalcadao.com.br/auth/confirm
```

Defina `NEXT_PUBLIC_APP_URL` com a origem exata de cada ambiente, sem barra no
final. Confirmação de cadastro, recuperação de senha e alteração de e-mail usam
essa variável para retornar à aplicação.

## Banco de dados

O projeto Supabase reservado para a aplicação tem o identificador
`mieekhdagjlzdbeklrxp`. O schema versionado está em `supabase/migrations`.

Antes de aplicar em qualquer ambiente, confirme que o projeto selecionado é o
O Calçadão. Em seguida, aplique a migration pelo fluxo oficial do Supabase.

O schema ativa RLS em todas as tabelas públicas. Visitantes veem apenas
comércios publicados e itens ativos; comerciantes autenticados gerenciam apenas
os registros dos próprios negócios.

As funções `supabase/functions/delete-account` e
`supabase/functions/efi-billing-checkout` devem permanecer com verificação de
JWT habilitada. A chave `service_role` é fornecida pelo próprio ambiente da Edge
Function e nunca deve ser exposta ao Next.js ou ao navegador. O webhook da Efí
faz sua própria validação consultando a notificação diretamente no provedor.

### Dashboard administrativo

O dashboard em `/painel/admin/dashboard` reúne totais de contas, lojas,
promoções e campanhas, evolução de cadastros e links para as filas de moderação.
Os filtros de 7, 30 e 90 dias alteram apenas os indicadores de novos cadastros
e de campanhas criadas no período. “Valor confirmado” soma o preço das
campanhas Efí agendadas, ativas, pausadas ou concluídas; pedidos pendentes,
cortesias e reembolsos não entram. A base não registra cada parcela recebida
de assinaturas ou adicionais, portanto o dashboard apresenta apenas a
quantidade de assinaturas Pro ativas, sem inventar receita recorrente.

### Alertas administrativos no PWA

O painel `/painel/admin/notificacoes` é restrito a administradores. Os alertas
são entregues a todos os perfis com papel `admin` e cobrem cadastro confirmado,
suporte, denúncia, reivindicação de estabelecimento, correção/atualização/remoção
de perfil, loja de comerciante aguardando moderação e banner pago aguardando
revisão. Importações em massa, geocodificação e pré-cadastros automáticos não
geram push individual. A caixa usa RLS; o Web Push usa uma Edge Function com
token de despacho e não depende da página aberta. No iPhone, instale o site na
Tela de Início antes de ativar a permissão.

Em um novo projeto Supabase, depois das migrations, gere **uma única** dupla
VAPID e um token aleatório de 32 bytes. Salve em Supabase Vault com os nomes
`ocalcadao_vapid_public`, `ocalcadao_vapid_private`,
`ocalcadao_push_dispatch_token` e `ocalcadao_push_project_url` (URL base do
projeto Supabase). Não coloque o segredo VAPID nem o token no repositório ou
nas variáveis públicas do Next.js. Implante
`supabase/functions/admin-push-dispatch` com `verify_jwt=false`: a função
valida o token do Vault antes de consultar ou enviar qualquer alerta.

Os dados de estados, municípios e malhas são gerados a partir das APIs e dos
arquivos oficiais do IBGE pelo script `scripts/generate-brazil-locations.mjs`.
A localização exata recebida pelo endpoint `/api/localizacao` é usada somente
durante a consulta espacial e não é persistida; o navegador guarda apenas a
cidade escolhida.

Quando o comerciante solicita a busca pelo endereço, o endpoint autenticado
`/api/geocodificar-endereco` consulta o provedor configurado, limita e mantém em
cache as chamadas e só aceita coordenadas que pertençam ao município escolhido.

## Comandos

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Estrutura principal

```text
src/
  app/                    Rotas e CSS global
  components/             Componentes reutilizáveis da interface
  data/                   Dados demonstrativos temporários
  lib/supabase/           Clientes e configuração do Supabase
  types/                  Tipos do catálogo e do banco
supabase/
  functions/              Funções protegidas executadas no backend
  migrations/             Evolução versionada do schema PostgreSQL
```
