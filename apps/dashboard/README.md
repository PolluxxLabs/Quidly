# Quidly Dashboard

Merchant dashboard for Quidly v1.

The dashboard uses the backend JWT auth flow and reads data from the API directly. It is intentionally narrow in scope for v1 operations.

## Pages

- `/login`
- `/register`
- `/overview`
- `/transactions`
- `/transactions/[id]`
- `/api-keys`
- `/webhook-logs`
- `/settings`

## Environment

Copy [apps/dashboard/.env.example](/home/mantra/Quidly/apps/dashboard/.env.example) to `apps/dashboard/.env.local`.

Required variable:

- `NEXT_PUBLIC_API_URL`

Local default:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Development

From the repo root:

```bash
pnpm --filter dashboard dev
```

The app runs on `http://localhost:3001`.

## Checks

```bash
pnpm --filter dashboard lint
pnpm --filter dashboard test
pnpm --filter dashboard build
```

## Notes

- authentication uses the current backend JWT endpoints
- API keys can be created and viewed from the dashboard
- webhook delivery logs can be inspected and replayed
- the UI currently covers `awaiting_payment`, `confirming`, `succeeded`, and `expired`

## Deployment

Deploy as a standard Next.js app. Set `NEXT_PUBLIC_API_URL` to the public API base URL for the target environment.
