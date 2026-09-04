# O Calçadão

O Calçadão é uma avenida digital para aproximar consumidores e comércios da
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
- estados de carregamento, erro e página não encontrada;
- criação de conta, confirmação de e-mail, login, logout e recuperação de senha;
- painel protegido para o comerciante;
- cadastro e edição da loja, com logo e capa;
- criação, edição, ativação, pausa e exclusão de promoções;
- edição do perfil, alteração de e-mail e alteração de senha;
- exclusão definitiva da conta e dos dados vinculados;
- clientes Supabase para navegador, servidor e renovação segura de sessão;
- schema inicial com RLS para perfis, cidades, categorias, comércios, produtos,
  promoções e imagens;
- Edge Function autenticada para excluir a conta;
- validação automática no GitHub Actions.

O painel do comerciante usa dados reais do Supabase. O catálogo público ainda
usa os dados demonstrativos de `src/data/catalog.ts` enquanto a camada pública
de consultas não é conectada.

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

A função `supabase/functions/delete-account` deve permanecer com verificação de
JWT habilitada. A chave `service_role` é fornecida pelo próprio ambiente da Edge
Function e nunca deve ser exposta ao Next.js ou ao navegador.

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
