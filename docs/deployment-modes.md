# Deployment modes

Three deployment modes are planned; only cloud and self-host have scaffolding so far.

## 1. Cloud deployment

- **Web**: Deploy `apps/web` (e.g. Vercel, Netlify, or Node server). Set `VITE_API_BASE_URL` (or equivalent) to the public API URL.
- **Server**: Deploy `apps/server` (e.g. Node on a VPS, Railway, Fly.io). Set `PORT` and `DATABASE_URL`.
- **Database**: Managed PostgreSQL (e.g. Neon, Supabase, RDS).
- Runtime config is typically compile-time or env-based; optional runtime config file for overrides.

## 2. Self-host (Docker Compose)

- **Scaffold**: `infra/docker/docker-compose.selfhost.yml` defines placeholder services: `postgres`, `server`, `web`.
- **Reverse proxy**: `infra/docker/Caddyfile` is a commented placeholder for routing (e.g. `/` → web, `/api` → server).
- **Next steps**: Add Dockerfiles for `apps/web` and `apps/server`, then point Compose at them. Use `.env.example` as a template for `POSTGRES_*` and `DATABASE_URL`.

## 3. Future: GM-hosted LAN / Electron host mode

- **LAN**: Same stack as self-host but intended to run on a game master’s machine and be reached by players on the same network. Documented here for clarity; no extra infra yet.
- **Electron**: `apps/desktop` will later provide an Electron shell that loads the web app (or shared UI). Distribution is separate from Docker; Electron is not part of Docker Compose.

## Summary

| Mode    | Web        | Server     | DB           | Notes                    |
|---------|------------|------------|--------------|--------------------------|
| Cloud   | Hosting    | Hosting    | Managed PG   | Env / runtime config      |
| Self-host | Docker   | Docker     | Docker PG    | Compose + reverse proxy  |
| LAN     | Same as self-host | Same | Same         | Network scope only       |
| Desktop | Electron   | Optional   | Optional     | Electron shell only      |
