# Vizier's Vault Monorepo

Monorepo foundation for a product with three targets:

1. **Cloud-hosted web app** — paying users, email/password + Google OAuth
2. **Self-hosted deployment** — Docker Compose, email/password only
3. **Electron desktop app** — single local user, PGlite, no sign-in

## Stack

- **Frontend:** React, Vite, TanStack Router, TanStack Query, shadcn/ui, Tailwind
- **API:** Hono
- **Auth (web/self-host only):** Better Auth
- **Database:** Drizzle ORM (PostgreSQL for server, PGlite for desktop)
- **Validation:** Zod

## Repository structure

- `apps/web` — Vite + React web app (shared by cloud, self-host, and Electron renderer)
- `apps/api` — Hono API (cloud + self-host)
- `apps/desktop` — Electron app (embedded API + PGlite, reuses `apps/web` as renderer)
- `packages/ui` — shadcn/ui components
- `packages/db` — Drizzle schema, migrations, repositories, Postgres/PGlite connections
- `packages/shared` — Zod schemas, `RuntimeConfig` type, shared constants
- `packages/api-core` — Shared Hono routes, services, auth abstraction
- `docker/` — Dockerfile and Compose for API and self-hosting

## Local development

### Prerequisites

- Node 20+
- pnpm 9
- Docker (for local Postgres)

### One-time setup

```bash
pnpm install
```

Copy env examples and set values:

```bash
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env: set DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_BASE_URL
# For local dev with Vite proxy, use BETTER_AUTH_BASE_URL=http://localhost:5173
```

### Start local Postgres

```bash
pnpm dev:services
```

### Run migrations

Migrations use `DATABASE_URL` from the environment. From repo root, either export it or run from `apps/api` (where `.env` is loaded by the API at runtime). For CLI tools, set it before running:

```bash
# From repo root (export first, or use a .env in packages/db if you add one)
export DATABASE_URL=postgres://viziers:viziers@localhost:5432/viziers_vault
pnpm db:migrate
```

### Run web + API together

```bash
pnpm dev
```

This starts both the web app (Vite, port 5173) and the API (Hono, port 3000). The web app proxies `/api` to the API so auth cookies work on the same origin.

- **Web:** http://localhost:5173  
- **API:** http://localhost:3000 (proxied via Vite as `/api`)

### Run Electron (desktop) in dev

```bash
pnpm dev:desktop
```

Starts the embedded API (PGlite, port 3099), then Electron with the web app as the renderer. No sign-in; single local profile.

### Other commands

- `pnpm dev:stop` — stop local Postgres
- `pnpm db:studio` — open Drizzle Studio (set `DATABASE_URL` as for migrations)
- `pnpm build` — build all apps
- `pnpm typecheck` — typecheck all packages

## Auth modes by target

| Target      | Auth        | Email/password | Google OAuth |
|------------|-------------|----------------|--------------|
| Cloud web  | Better Auth | Yes            | Yes (if env set) |
| Self-host  | Better Auth | Yes            | No           |
| Desktop    | None        | No sign-in     | No           |

The frontend learns which mode and providers are available from `GET /api/config` (runtime config). No build-time env vars for auth in the web app.

## Self-hosting with Docker Compose

1. Build the web app and API image:

   ```bash
   pnpm --filter=web build
   docker compose -f docker/docker-compose.yml build
   ```

2. Copy `docker/.env.example` to `docker/.env` and set `BETTER_AUTH_SECRET`, `BETTER_AUTH_BASE_URL` (your public URL), and Postgres credentials.

3. Run migrations against the Postgres instance (e.g. after first `docker compose up -d postgres`):

   ```bash
   export DATABASE_URL=postgres://user:pass@localhost:5432/viziers_vault
   pnpm db:migrate
   ```

4. Start the stack:

   ```bash
   docker compose -f docker/docker-compose.yml up -d
   ```

nginx serves the web app and proxies `/api` to the API so the browser uses a single origin.

## Production env (summary)

- **API:** `DATABASE_URL`, `DEPLOYMENT_MODE` (cloud | self-host), `BETTER_AUTH_SECRET`, `BETTER_AUTH_BASE_URL`, `PORT`. Optional for cloud: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- **Web:** Optional `VITE_API_BASE_URL` override; normally not needed (relative `/api` or runtime-injected in Electron).

## Using components (shadcn)

To add components to the shared UI package:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

Use them from the UI package:

```tsx
import { Button } from "@workspace/ui/components/button";
```
