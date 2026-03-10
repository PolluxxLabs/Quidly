# Quidly

Kenya-first payments infrastructure, currently focused on a strict crypto v1:

- `method=CRYPTO`
- `asset=USDC`
- `chain=BASE`

This repository is a modular monolith. The backend remains the source of truth for payment lifecycle, ledgering, provider events, and webhook delivery state.

## Monorepo apps

- `apps/api` - NestJS backend with Prisma, PostgreSQL, BullMQ, Redis, and Base/USDC monitoring
- `apps/dashboard` - Next.js merchant dashboard using backend JWT auth
- `apps/docs` - Next.js documentation site for external developers

## Local prerequisites

- Node.js 22+
- pnpm 10+
- PostgreSQL 16+
- Redis 7+

## Quick start

1. Install dependencies:

```bash
pnpm install
```

2. Copy environment files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/dashboard/.env.example apps/dashboard/.env.local
```

3. Start PostgreSQL and Redis, then run the API migration:

```bash
pnpm --filter api exec prisma migrate dev
```

4. Seed a local merchant:

```bash
pnpm seed:api
```

The seed script prints a merchant email/password, API key, and webhook secret for local use.

5. Start the apps you need:

```bash
pnpm dev:api
pnpm dev:dashboard
pnpm dev:docs
```

Default local ports:

- API: `http://localhost:3000`
- Dashboard: `http://localhost:3001`
- Docs: `http://localhost:3002`

## Docker

For a local containerized stack with API + PostgreSQL + Redis:

```bash
pnpm docker:up
```

This uses the root [Dockerfile](/home/mantra/Quidly/Dockerfile) for the API and [docker-compose.yml](/home/mantra/Quidly/docker-compose.yml) for service orchestration.

To stop the stack:

```bash
pnpm docker:down
```

## Workspace commands

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

## Deployment notes

Railway:

- run the API service from the repo root with the root `Dockerfile`
- attach managed PostgreSQL and Redis
- set `DATABASE_URL`, `JWT_SECRET`, `WEBHOOK_SECRET_ENCRYPTION_KEY`, `REDIS_HOST`, `REDIS_PORT`, `BASE_RPC_URL`, and `CRYPTO_WALLET_SEED`
- use a start command equivalent to `pnpm --filter api exec prisma migrate deploy && pnpm --filter api start:prod`

Fly.io:

- deploy the API container from the repo root
- provision Fly Postgres and Redis, or connect external managed services
- set the same environment variables as Railway
- run Prisma deploy migrations during release before promoting the new instance

Dashboard and docs can be deployed separately as standard Next.js apps. Point the dashboard `NEXT_PUBLIC_API_URL` at the deployed API.

## Migrations and rollback

Forward migration:

```bash
pnpm --filter api exec prisma migrate deploy
```

Development migration:

```bash
pnpm --filter api exec prisma migrate dev --name your_change
```

Rollback approach:

- prefer additive schema changes for production
- if a deploy must be rolled back, revert application code first
- if schema rollback is required, create a new corrective migration instead of manually editing migration history
- for local development only, `prisma migrate reset` is acceptable when data loss is acceptable

## v1 scope

Quidly v1 intentionally does not support:

- cards
- Airtel Money
- PesaLink
- custodial wallets
- swaps or exchange flows
- multi-chain crypto

The next rail scaffolded in code is M-Pesa, but it is not enabled for v1 payments.
