# Quidly API

NestJS backend for Quidly's v1 payments infrastructure.

Current v1 payment scope:

- `method=CRYPTO`
- `asset=USDC`
- `chain=BASE`

The API is a modular monolith. Prisma is the source of truth for payment, invoice, transaction, provider event, ledger, merchant, and webhook delivery state.

## Stack

- NestJS
- Prisma 7 with `@prisma/adapter-pg`
- PostgreSQL
- BullMQ + Redis
- viem for Base chain monitoring

## Environment

Copy [apps/api/.env.example](/home/mantra/Quidly/apps/api/.env.example) to `apps/api/.env`.

Required runtime values:

- `DATABASE_URL`
- `JWT_SECRET`
- `WEBHOOK_SECRET_ENCRYPTION_KEY`
- `REDIS_HOST`
- `REDIS_PORT`
- `BASE_RPC_URL`
- `CRYPTO_WALLET_SEED`

Useful local toggles:

- `DISABLE_QUEUES=true` disables BullMQ wiring for test runs
- `BASE_REQUIRED_CONFIRMATIONS` controls confirmation depth
- `CRYPTO_MONITORING_INTERVAL_MS` controls polling frequency

## Local development

Install dependencies from the repo root:

```bash
pnpm install
```

Run migrations:

```bash
pnpm --filter api exec prisma migrate dev
```

Start the API:

```bash
pnpm --filter api start:dev
```

Seed a local merchant:

```bash
pnpm --filter api seed:dev-merchant
```

The seed script prints:

- merchant email
- merchant password
- raw API key
- raw webhook secret

## Core routes

Public auth:

- `POST /auth/register`
- `POST /auth/login`

Merchant JWT routes:

- `POST /merchant/api-keys`
- `GET /merchant/api-keys`
- `DELETE /merchant/api-keys/:id`
- `GET /merchant/settings`
- `PATCH /merchant/settings`
- `POST /merchant/settings/rotate-webhook-secret`
- `GET /merchant/payments`
- `GET /merchant/payments/overview`
- `GET /merchant/payments/:id`
- `GET /merchant/webhooks/deliveries`
- `POST /merchant/webhooks/deliveries/:id/replay`

Merchant API key routes:

- `POST /v1/payments`
- `GET /v1/payments`
- `GET /v1/payments/:id`

JWT-only dev simulation routes:

- `POST /v1/payments/:id/simulate/detected`
- `POST /v1/payments/:id/simulate/confirmed`
- `POST /v1/payments/:id/simulate/expired`

Ops and dev inspection:

- `GET /health`
- `GET /health/db`
- `GET /health/redis`
- `GET /metrics`
- `GET /internal/dev/payments/:id/inspect`
- `GET /internal/dev/queues/:queue/failed`

## Payment lifecycle

For crypto payments, Quidly enforces a strict state machine:

- awaiting payment
- confirming
- succeeded
- expired

Invalid transitions return `400` errors. Duplicate ledger writes, duplicate provider events, and illegal status regressions are blocked at the service layer.

## Queue and worker model

BullMQ queues:

- `webhook-deliveries`
- `crypto-expiry`
- `crypto-monitoring`

Workers handle:

- outbound webhook dispatch with retries and delivery metadata
- scheduled invoice expiry
- Base/USDC transfer polling and confirmation updates

## Testing

Run unit tests:

```bash
pnpm --filter api test
```

Run e2e tests:

```bash
pnpm --filter api test:e2e
```

Run lint:

```bash
pnpm --filter api lint
```

The e2e suite uses an isolated Postgres schema and disables BullMQ workers with `DISABLE_QUEUES=true`.

## Deployment notes

Railway:

- deploy from the repo root using the root `Dockerfile`
- attach PostgreSQL and Redis
- run `pnpm --filter api exec prisma migrate deploy` before startup
- set the runtime env vars listed above

Fly.io:

- build and deploy the API container from the repo root
- attach managed PostgreSQL and Redis or external equivalents
- run Prisma deploy migrations as part of release
- expose port `3000`

## Migration and rollback notes

Production forward migration:

```bash
pnpm --filter api exec prisma migrate deploy
```

Development migration creation:

```bash
pnpm --filter api exec prisma migrate dev --name your_change
```

Rollback guidance:

- prefer rolling back application code first
- avoid editing existing Prisma migration history
- if schema correction is needed, add a new migration that restores the expected state
- only use `prisma migrate reset` in local development where data loss is acceptable
