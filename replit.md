# BrewDesk

نظام إدارة كافيه متكامل — يشمل الحجوزات، الكاشير، الموظفين، المخزون، والتقارير المالية.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/brewdesk run dev` — run the frontend (port 19955)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Default Credentials

Default seed credentials have been removed from this file for security. Check with a team administrator for login details.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind + shadcn/ui + Recharts + Wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Auth: Custom token-based (SHA-256, stored in localStorage)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/db/src/schema/` — Drizzle schema files (one per entity)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/brewdesk/src/` — React frontend (pages/, components/)
- `lib/api-client-react/src/generated/` — Generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — Generated Zod schemas for server (do not edit)

## Architecture decisions

- Contract-first: OpenAPI spec drives both frontend hooks and server validation via Orval codegen
- Token auth stored in `localStorage` under `brewdesk_token` key; custom-fetch.ts sends it as Bearer header
- Sessions are the core entity: every table/room occupation creates a session, orders attach to sessions, end-session generates an invoice automatically
- Table/room status (available/reserved/occupied) is updated automatically when sessions start/end
- Password hashing: bcrypt (12 rounds, per-user salt). Existing SHA-256 legacy hashes are transparently migrated to bcrypt on first successful login.

## Product

BrewDesk covers:
- Dashboard with live occupancy & revenue stats
- Visual café map (tables with color-coded status)
- Bookings (tables, meeting rooms, lecture halls, football viewing)
- Active session management with live elapsed timer
- Orders & kitchen display screen
- Cashier/POS with discounts and cash change calculation
- Menu management (categories, items, pricing, discounts)
- Inventory with low-stock alerts
- Expense tracking (rent, bills, supplies, salary)
- Financial reports (daily/weekly/monthly/yearly) with Recharts charts
- Staff management with role-based access

## User preferences

- Arabic-first UI with bilingual (Arabic/English) labels
- Dark espresso/amber color palette
- RTL layout support

## Gotchas

- After OpenAPI spec changes, always run `pnpm --filter @workspace/api-spec run codegen` before touching frontend
- Sessions route imports `@workspace/db` tables dynamically in some places — keep import paths consistent
- The `orders` route updates session `currentCost` — if this causes issues, compute cost on-demand in the sessions GET handler instead

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
