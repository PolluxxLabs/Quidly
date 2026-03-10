# Quidly

Quidly is a Base USDC payment infrastructure platform. It is a pnpm monorepo with three apps:

- **apps/api** — NestJS REST API backend (port 3000)
- **apps/dashboard** — Next.js 15 merchant dashboard (port 5000, Replit preview)
- **apps/docs** — Next.js 15 documentation site (port 3001)

## Architecture

- **Package manager**: pnpm 10.26.1 with workspaces
- **Database**: PostgreSQL via Prisma ORM (adapter-pg)
- **Auth**: JWT + Passport with bcrypt password hashing
- **Queues**: BullMQ + Redis (can be disabled via `DISABLE_QUEUES=true`)
- **Security**: Helmet, rate limiting (ThrottlerModule), CORS, input validation (class-validator)

## Running the Project

Two workflows are configured:

1. **Dashboard** — `cd apps/dashboard && pnpm dev` (port 5000, webview)
2. **API** — `cd apps/api && pnpm start:dev` (port 3000, console)

## Environment Variables

Key secrets (stored in Replit Secrets):
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — JWT signing secret
- `WEBHOOK_SECRET_ENCRYPTION_KEY` — Webhook secret encryption key
- `NEXT_PUBLIC_API_URL` — Public URL of the API (used by dashboard)

Key env vars (in shared environment):
- `PORT=3000` — API port
- `DISABLE_QUEUES=true` — Disables Redis/BullMQ (set to false if Redis is available)
- `CORS_ORIGINS` — Comma-separated allowed origins for the API

## Database

Prisma schema is at `apps/api/prisma/schema.prisma`. To apply migrations:
```
cd apps/api && pnpm exec prisma migrate deploy
```

To regenerate the Prisma client after schema changes:
```
cd apps/api && pnpm exec prisma generate
```

## Notes

- `DISABLE_QUEUES=true` is set by default since there is no Redis in the Replit environment. Set it to `false` and provide `REDIS_URL` if Redis is available.
- The `packageManager` field in `package.json` is pinned to `pnpm@10.26.1` to match the Replit-installed version.
