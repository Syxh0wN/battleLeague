# BattleLeague

BattleLeague e um projeto fullstack de duelos taticos inspirado no universo Pokemon.
A ideia central e simples: cada jogador monta seu time, evolui seus pokemons, sobe no ranking e disputa batalhas com estrategia real.

Este projeto foi pensado para portfolio, mostrando arquitetura de produto real:
- autenticacao
- regras de negocio
- motor de batalha
- progressao
- social
- seguranca

## Ideia Do Projeto

O BattleLeague simula uma liga competitiva com foco em progressao de medio prazo.
Nao e so "clicar e lutar". Cada decisao impacta:

- qual pokemon usar
- quando evoluir
- quando treinar
- como administrar recursos
- quais rivais desafiar

O objetivo e entregar uma experiencia de jogo web com:
- sensacao de progresso
- risco/recompensa
- identidade de perfil
- competitividade justa

## Como O Sistema Funciona

### 1) Perfil Do Jogador
- login e sessao segura
- edicao de nome, tag, avatar e sexo do perfil
- exibicao de dados de progresso

### 2) Time E Progressao
- escolha de starter
- captura/evolucao de pokemons
- treino, cooldown e fadiga
- ganho de XP, nivel e recursos

### 3) Batalhas
- PvP (jogador vs jogador)
- PvE (jogador vs IA)
- turnos com calculo de dano no `game-engine`
- resultado com impacto em MMR e progressao

### 4) Economia
- loot box com regras de raridade
- sistema de fragmentos e duplicados
- recompensas de evento/quest

### 5) Social
- envio e aceite de amizade
- visualizacao de perfil publico
- historico e comparacao de desempenho

## Arquitetura

Monorepo com workspaces:

- `apps/api` - API NestJS + Prisma
- `apps/web` - Frontend Next.js
- `packages/game-engine` - motor de resolucao de turno
- `packages/shared-types` - tipos compartilhados

## Stack Tecnica

- Frontend: Next.js, React, TypeScript, React Query, Tailwind
- Backend: NestJS, TypeScript, Prisma
- Banco: SQLite (ambiente atual)
- Auth: fluxo com refresh token em cookie

## Setup Local

1. Copie os arquivos de ambiente:
   - `apps/api/.env.example` -> `apps/api/.env`
   - `apps/web/.env.example` -> `apps/web/.env.local`
2. Instale dependencias:
   - `npm install`
3. Gere o client do Prisma:
   - `npm run prisma:generate --workspace @battleleague/api`
4. Aplique migracoes:
   - `npm run prisma:migrate --workspace @battleleague/api -- --name init`
5. Popule dados iniciais:
   - `npm run prisma:seed --workspace @battleleague/api`

## Executar Em Desenvolvimento

- API: `npm run dev:api`
- Web: `npm run dev:web`

## Scripts Uteis

- Lint geral: `npm run lint`
- Build geral: `npm run build`
- Prisma generate: `npm run prisma:generate --workspace @battleleague/api`
- Prisma migrate: `npm run prisma:migrate --workspace @battleleague/api`
- Prisma seed: `npm run prisma:seed --workspace @battleleague/api`

## Rotas Principais Da API

Todas as rotas usam o prefixo `/battle/`:

- `POST /battle/auth/google`
- `POST /battle/auth/refresh`
- `GET /battle/users/me`
- `PATCH /battle/users/me/profile`
- `GET /battle/pokemon/species`
- `POST /battle/pokemon/claimStarter`
- `POST /battle/battles`
- `POST /battle/battles/:battleId/turn`
- `POST /battle/progression/lootbox/open`
- `POST /battle/social/friends/request`
- `GET /battle/health` - Health check endpoint

## Objetivo De Portfolio

Este projeto foi construido para demonstrar capacidade fullstack ponta a ponta:
- modelagem de dominio
- qualidade de codigo em monorepo
- preocupacao com seguranca
- foco em UX de produto
- evolucao continua com refatoracao e validacao tecnica
