# Threat Model

## Project Overview

BrewDesk is a cafe-management application with a React/Vite frontend and an Express 5 API backed by PostgreSQL via Drizzle ORM. It manages staff accounts, bookings, active sessions, orders, invoices, inventory, expenses, and financial reports. The current deployment is public, so production API routes are reachable from the internet. The mockup sandbox artifact is development-only and out of scope unless production reachability is demonstrated.

## Assets

- **Staff accounts and session tokens** — bearer tokens grant access to operational and financial functionality across the application.
- **Staff credentials** — usernames and password hashes protect access to all business data and privileged actions.
- **Operational business data** — bookings, sessions, tables, rooms, orders, invoices, menu pricing, and inventory drive live cafe operations.
- **Financial data** — expenses, invoices, revenue summaries, and profit reports expose sensitive business performance information.
- **Customer data** — customer identities, phone numbers, emails, visit history, and spend totals are sensitive commercial data.
- **Application secrets and database access** — the database connection and any server-side secrets would enable full compromise if exposed.

## Trust Boundaries

- **Browser to API** — all frontend requests cross from an untrusted client into the Express API. Client-side permission checks are advisory only; the API must enforce authorization.
- **API to PostgreSQL** — route handlers can read and mutate all application data. Unsafe queries or overbroad updates can expose or tamper with core business records.
- **Unauthenticated to authenticated** — `/api/auth/*` and `/api/healthz` are public, while the rest of `/api` is intended to require a valid bearer token.
- **Authenticated to privileged staff** — managers, admins, cashiers, kitchen, and waiters have different intended permissions. Sensitive financial and staff-management actions must be enforced server-side, not just in the UI.
- **Production to dev-only artifacts** — `artifacts/mockup-sandbox/` is not treated as production scope under current assumptions.

## Scan Anchors

- Production API entry points: `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/`, `artifacts/api-server/src/middleware/auth.ts`, `artifacts/api-server/src/auth-store.ts`
- Highest-risk areas: custom auth in `src/routes/auth.ts`, route protection in `src/routes/index.ts`, staff/financial/report/inventory/menu routes, and frontend permission assumptions in `artifacts/brewdesk/src/lib/permissions.ts`
- Public surfaces: `/api/healthz`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- Authenticated surfaces: all other `/api/*` routes after `router.use(requireAuth)`
- Dev-only area to usually ignore: `artifacts/mockup-sandbox/`

## Threat Categories

### Spoofing

BrewDesk uses custom bearer tokens and custom password verification instead of a managed auth system. The application must ensure tokens are unpredictable, invalidatable, and validated on every protected request. Staff passwords must be resistant to offline cracking if the staff table is exposed.

### Tampering

Many routes directly mutate prices, bookings, orders, sessions, inventory, expenses, and staff records. The API must enforce server-side authorization for every sensitive mutation and must only apply validated fields to database updates.

### Information Disclosure

The application stores customer, staff, operational, and financial data in a single backend. API responses must be scoped to the caller’s role and permissions, and sensitive business metrics or staff details must not be exposed to any authenticated user by default.

### Denial of Service

The public login surface and JSON API can be hit directly from the internet. Authentication and other expensive endpoints must resist brute-force and abusive request volume, and request parsing should remain bounded.

### Elevation of Privilege

The frontend models granular permissions such as `reports.view`, `inventory.manage`, and `staff.manage`, so the backend must uphold the same permission boundaries. Any route that trusts only `requireAuth` for privileged actions risks letting low-privilege staff escalate into managerial or administrative capabilities.
