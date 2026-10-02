# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run migrate` — apply checked-in SQL migrations with an advisory lock
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server exec node --test src/routes/stripeWebhook.integration.test.mjs` — webhook signature/status/accounting regression checks using temporary development database tables; all fixtures are rolled back, with no Stripe API calls
- Required env:
  - `DATABASE_URL` — Postgres connection string
  - `STRIPE_SECRET_KEY` — server-only Stripe API secret
  - `STRIPE_WEBHOOK_SECRET` — signing secret for `/api/stripe/webhook`
  - `PUBLIC_APP_URL` — trusted public web origin used for Stripe Connect return URLs
  - `LUDI_PLATFORM_FEE_BASIS_POINTS` — integer platform fee in basis points (defaults to `500`, or 5%)
  - `VITE_STRIPE_PUBLIC_KEY` / `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` — publishable keys for web/mobile Stripe UI

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
