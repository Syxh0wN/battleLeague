# DuelMen

Pokemon duel web monorepo with Google login, async battles, progression, and social features.

## Workspaces
- `apps/api`: NestJS API with Prisma
- `apps/web`: Next.js web app
- `packages/game-engine`: battle turn engine
- `packages/shared-types`: shared types

## Setup
1. Copy `apps/api/.env.example` to `apps/api/.env`
2. Copy `apps/web/.env.example` to `apps/web/.env.local`
3. Run `npm install`
4. Run `npm run prisma:generate --workspace @duelmen/api`
5. Run `npm run prisma:migrate --workspace @duelmen/api -- --name init`
6. Run `npm run prisma:seed --workspace @duelmen/api`

## Run
- API: `npm run dev:api`
- Web: `npm run dev:web`

## Main API Routes
- `POST /api/auth/google`
- `POST /api/auth/refresh`
- `GET /api/users/me`
- `GET /api/pokemon/species`
- `POST /api/pokemon/claimStarter`
- `POST /api/battles`
- `POST /api/battles/:battleId/turn`
- `POST /api/progression/lootbox/open`
- `POST /api/social/friends/request`
