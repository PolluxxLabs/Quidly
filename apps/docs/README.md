# Quidly Docs

Documentation site for Quidly v1 merchants and integrators.

## Pages

- `/`
- `/quickstart`
- `/auth`
- `/payments`
- `/webhooks`
- `/base-usdc-limitations`

## Development

From the repo root:

```bash
pnpm --filter docs dev
```

The app runs on `http://localhost:3002`.

## Checks

```bash
pnpm --filter docs lint
pnpm --filter docs test
pnpm --filter docs build
```

## Scope

The docs cover:

- merchant account setup
- API key creation
- crypto payment creation and inspection
- JWT auth usage
- outbound webhook behavior
- Base/USDC limitations for v1

No runtime environment variables are required for the docs MVP.

## Deployment

Deploy as a standard Next.js app. No special server-side integration is required for the current MVP.
