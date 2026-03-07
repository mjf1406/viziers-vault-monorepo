# Architecture

## Overview

- **`apps/web`** — Frontend-only SPA (Vite + React + TanStack Router + TanStack Query). No server runtime; no SSR.
- **`apps/server`** — Sole backend (Hono). Serves API and Better Auth. No second backend.

## Why TanStack Start was removed

The repo previously used TanStack Start in `apps/web`, which provided a full-stack SSR runtime (Nitro, server-side rendering, and server functions). We moved to a **single-backend** design:

- The web app is a plain Vite SPA. The browser loads static assets and talks to `apps/server` over HTTP.
- All API and auth live under one backend. This avoids the “two backends” problem (Start’s server vs. `apps/server`) and keeps deployment and cookies simple.

## Auth: identity vs. authorization

- **Identity and sessions** are handled by **Better Auth** in `apps/server` (login, signup, cookies, session storage).
- **Authorization and permissions** live in **app/domain data** (e.g. campaigns, memberships, roles). They are not configured inside the auth provider. `packages/domain` is the source of truth for roles and permission helpers; the database schema stays in sync with that.

## Same-origin and deployment

- **Target deployment**: Self-host or LAN behind a **reverse proxy** so the browser sees a single origin (e.g. `https://app.example.com`). The proxy serves the web app and forwards `/api/*` to the backend.
- **Browser requests**: Use **relative API paths** (e.g. `/api/health`, `/api/me`, `/api/auth/*`) with `credentials: "include"` so cookies are sent. Avoid hardcoded cross-origin API URLs when possible.
- **Local dev**: The Vite dev server proxies `/api` to `apps/server` (e.g. port 3001), so the app runs as if same-origin. `APP_ORIGIN` is set to the web app origin (e.g. `http://localhost:3000`), not the server port.

## Key paths

| Path            | Handler              | Purpose                    |
|-----------------|----------------------|----------------------------|
| `GET /api/health` | Hono                 | Health check               |
| `ALL /api/auth/*` | Better Auth          | Auth (sign in, sign up, session) |
| `GET /api/me`     | Hono + Better Auth   | Current session/user       |

## Packages

- **`@workspace/db`** — Drizzle client and schema (PostgreSQL). Better Auth tables + app tables (campaigns, memberships, invites).
- **`@workspace/auth`** — Thin boundary around Better Auth: server factory `createAuth({ db, secret, baseURL })` and React client. Does not read `process.env`; the server passes options in.
- **`@workspace/domain`** — Shared role type, permission helpers, and Zod schemas. Source of truth for app roles; DB enum is kept in sync.
