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

A primeira base navegável contém:

- página inicial com busca, categorias, destaques e ofertas;
- listagem com busca e filtro por categoria;
- página pública de cada comércio;
- estados de carregamento, erro e página não encontrada;
- clientes Supabase para navegador, servidor e renovação de sessão;
- schema inicial com RLS para perfis, cidades, categorias, comércios, produtos,
  promoções e imagens;
- validação automática no GitHub Actions.

Os dados exibidos na interface são demonstrativos até a migration ser aplicada
e a camada de consultas ser conectada ao Supabase.

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

## Banco de dados

O projeto Supabase reservado para a aplicação tem o identificador
`mieekhdagjlzdbeklrxp`. O schema versionado está em `supabase/migrations`.

Antes de aplicar em qualquer ambiente, confirme que o projeto selecionado é o
O Calçadão. Em seguida, aplique a migration pelo fluxo oficial do Supabase.

O schema ativa RLS em todas as tabelas públicas. Visitantes veem apenas
comércios publicados e itens ativos; comerciantes autenticados gerenciam apenas
os registros dos próprios negócios.

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
  migrations/             Evolução versionada do schema PostgreSQL
```
