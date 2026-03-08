# Vizier's Vault — Setup Guide

This guide walks you through running the project locally and deploying it in all three supported ways: **cloud** (managed Node), **self-hosted** (Docker Compose), and **desktop** (Electron).

---

## Prerequisites

| Requirement | Version / Notes |
|-------------|-----------------|
| **Node.js** | `>=20` |
| **pnpm** | `9.0.6` (recommended; corepack will use this if you enable it) |
| **Docker + Docker Compose** | Required for local Postgres and for self-hosted production |

**Install pnpm (if needed):**

```bash
corepack enable
corepack prepare pnpm@9.0.6 --activate
```

Or install Node 20+ and use: `npm install -g pnpm@9.0.6`.

**Docker:** Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose) and ensure `docker` and `docker compose` work in your terminal.

---

## Local Development

Follow these steps in order.

### 1. Clone and install

```bash
git clone <your-repo-url>
cd viziers-vault-monorepo
pnpm install
```

### 2. Start Postgres

From the repo root:

```bash
pnpm dev:services
```

This starts a PostgreSQL 16 container on **port 5432** using the dev Compose file. Default DB: `viziers_vault`, user: `viziers`, password: `viziers`.

To stop it later: `pnpm dev:stop`.

### 3. Configure environment

Copy the API env example and edit:

```bash
cp apps/api/.env.example apps/api/.env
```

Use these values for a minimal local setup (edit `apps/api/.env`):

```env
# Database — matches dev Postgres from step 2
DATABASE_URL=postgres://viziers:viziers@localhost:5432/viziers_vault

# Deployment: "cloud" (email + Google OAuth) or "self-host" (email only)
DEPLOYMENT_MODE=cloud

# Better Auth — required; use a secret at least 32 characters
# Generate one: openssl rand -base64 32
BETTER_AUTH_SECRET=your-secret-at-least-32-chars

# In local dev this must be the Vite origin so auth cookies work (same origin)
BETTER_AUTH_BASE_URL=http://localhost:5173

# API port
PORT=3000

# Optional: Google OAuth (only for DEPLOYMENT_MODE=cloud)
# Get credentials: https://console.cloud.google.com/apis/credentials
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
```

Generate a secure secret (run in terminal):

```bash
openssl rand -base64 32
```

Paste the output into `BETTER_AUTH_SECRET`.

### 4. Run migrations

The `db` package reads `DATABASE_URL` from the environment, not from `apps/api/.env`. Set it in the shell, then run migrations.

**PowerShell (Windows):**

```powershell
$env:DATABASE_URL="postgres://viziers:viziers@localhost:5432/viziers_vault"; pnpm db:migrate
```

**Bash (macOS / Linux / WSL):**

```bash
DATABASE_URL=postgres://viziers:viziers@localhost:5432/viziers_vault pnpm db:migrate
```

### 5. Start the dev servers

From the repo root:

```bash
pnpm dev
```

This starts:

- **Web (Vite)** — [http://localhost:5173](http://localhost:5173) (proxies `/api` to the API)
- **API (Hono)** — [http://localhost:3000](http://localhost:3000)

Open **http://localhost:5173** in your browser.

### 6. Optional: Desktop app (Electron)

Runs the same UI with an embedded API and PGlite (no Postgres, no sign-in):

```bash
pnpm dev:desktop
```

The embedded API listens on `http://127.0.0.1:3099`. Data is stored in your OS user data directory.

---

## Production Method 1: Cloud (managed Node process)

Deploy the API as a Node process and serve the built web app from a CDN or nginx, with your own PostgreSQL.

### Build

From the repo root:

```bash
pnpm build
```

Outputs:

- `apps/api/dist/index.js` — API
- `apps/web/dist/` — Static SPA

### Environment variables (production)

Set these where the API runs (e.g. server env or process manager):

| Variable | Required | Example |
|----------|----------|---------|
| `DATABASE_URL` | Yes | `postgres://user:pass@host:5432/viziers_vault` |
| `DEPLOYMENT_MODE` | Yes | `cloud` or `self-host` |
| `BETTER_AUTH_SECRET` | Yes | At least 32 characters |
| `BETTER_AUTH_BASE_URL` | Yes | `https://your-domain.com` (public URL users see) |
| `PORT` | No | `3000` (default) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | For cloud + Google | From Google Cloud Console |

### Run the API

```bash
node apps/api/dist/index.js
```

(Or use a process manager like systemd, PM2, etc.)

### Serve the web app and proxy `/api`

Serve the contents of `apps/web/dist/` from your domain and proxy `/api` to the API. Example nginx snippet:

```nginx
root /path/to/apps/web/dist;
index index.html;
location / {
    try_files $uri $uri/ /index.html;
}
location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Run migrations against the production database (with production `DATABASE_URL` set) before going live:

```bash
DATABASE_URL="postgres://..." pnpm db:migrate
```

---

## Production Method 2: Self-hosted (Docker Compose)

Single-command stack: Postgres + API + nginx serving the built SPA. Good for a VPS or your own server.

### 1. Build the web app

From the repo root:

```bash
pnpm --filter=web build
```

The Compose setup mounts `apps/web/dist` into the nginx container.

### 2. Configure Docker env

From the repo root:

```bash
cp docker/.env.example docker/.env
```

Edit `docker/.env`:

```env
POSTGRES_USER=viziers
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=viziers_vault
BETTER_AUTH_SECRET=your-secret-at-least-32-chars
BETTER_AUTH_BASE_URL=https://your-domain.com
```

Use a strong `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET`. `BETTER_AUTH_BASE_URL` must be the public URL users use to reach the app.

### 3. Expose Postgres (for first-time migrations)

The production Compose file does not expose Postgres to the host. To run migrations from your machine, in `docker/docker-compose.yml` under the `postgres` service add:

```yaml
ports:
  - "5432:5432"
```

You can remove this block after the first migration if you don’t want Postgres exposed.

### 4. Start the stack

From the repo root:

```bash
docker compose -f docker/docker-compose.yml up -d
```

### 5. Run migrations (first time)

From the repo root, using the same password as in `docker/.env`:

**PowerShell:**

```powershell
$env:DATABASE_URL="postgres://viziers:your-secure-password@localhost:5432/viziers_vault"; pnpm db:migrate
```

**Bash:**

```bash
DATABASE_URL=postgres://viziers:your-secure-password@localhost:5432/viziers_vault pnpm db:migrate
```

The app is available on **port 80**. Open `http://localhost` (or your server’s IP/domain).

### 6. Useful Docker commands

- View logs: `docker compose -f docker/docker-compose.yml logs -f`
- Stop: `docker compose -f docker/docker-compose.yml down`
- Rebuild API: `docker compose -f docker/docker-compose.yml build api && docker compose -f docker/docker-compose.yml up -d`

### 7. Running with pre-built Docker images (no local build)

If the repo’s GitHub Actions have built and pushed images to GitHub Container Registry (GHCR), you can run the stack without building anything locally.

1. Clone the repo.
2. Copy `docker/.env.example` to `docker/.env` and set `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_BASE_URL`.
3. From the repo root, set your GitHub org/repo so Compose can pull the right images (replace with your repo):

   **Bash:** `export GITHUB_REPOSITORY=your-org/viziers-vault-monorepo`  
   **PowerShell:** `$env:GITHUB_REPOSITORY="your-org/viziers-vault-monorepo"`

4. Start the stack from the repo root:

   ```bash
   docker compose -f docker/docker-compose.ci.yml --env-file docker/.env up -d
   ```

5. Run migrations once (see step 5 in “Production Method 2” above; expose Postgres port if needed).

Images used: `ghcr.io/<GITHUB_REPOSITORY>/api:latest` and `ghcr.io/<GITHUB_REPOSITORY>/web:latest`. The **Docker** workflow (on push to `main` or on release) builds and pushes these images.

---

## Production Method 3: Electron desktop app

Fully offline: embedded PGlite DB, no sign-in, data in the OS user data directory.

### Development

```bash
pnpm dev:desktop
```

### Build installers locally

From the repo root:

```bash
pnpm --filter=desktop dist
```

Or build for one platform: `pnpm --filter=desktop dist:win`, `dist:mac`, or `dist:linux`. Installers are written to `apps/desktop/dist/` (e.g. NSIS `.exe` on Windows, `.dmg` on macOS, `.AppImage` on Linux).

### Downloading pre-built installers

The **Desktop installers** GitHub Action (on push to `main` or on release) builds installers for Windows, macOS, and Linux and uploads them as workflow artifacts.

1. Open the repo on GitHub → **Actions** → **Desktop installers**.
2. Open a successful run and scroll to **Artifacts**.
3. Download **desktop-win**, **desktop-mac**, or **desktop-linux** and unzip; run the installer or app inside.

macOS installers are unsigned; if the system blocks the app, right-click it → **Open** once to allow. For signed builds and auto-updates you’d add code signing and notarization (secrets and extra workflow steps).

---

## Useful commands reference

| Command | Description |
|--------|-------------|
| `pnpm dev` | Start web + API dev servers |
| `pnpm dev:desktop` | Start Electron app (dev) |
| `pnpm dev:services` | Start local Postgres (Docker) |
| `pnpm dev:stop` | Stop local Postgres |
| `pnpm build` | Build all apps |
| `pnpm --filter=desktop dist` | Build desktop installers (all platforms from one OS: use `dist:win`, `dist:mac`, `dist:linux`) |
| `pnpm db:migrate` | Run Drizzle migrations (set `DATABASE_URL` in env) |
| `pnpm db:studio` | Open Drizzle Studio (set `DATABASE_URL` in env) |
| `pnpm typecheck` | Type-check all packages |
| `pnpm lint` | Lint all packages |
| `pnpm format` | Format code |

---

## Troubleshooting

### Port already in use

- **5173** — Vite (web). Change in `apps/web/vite.config.ts` if needed.
- **3000** — API. Set `PORT` in `apps/api/.env`.
- **5432** — Postgres. Stop other Postgres instances or change the port in `docker/docker-compose.dev.yml`.

### "DATABASE_URL" or migrations fail

`pnpm db:migrate` runs in the `@workspace/db` package and does not load `apps/api/.env`. Set `DATABASE_URL` in the same shell:

- **PowerShell:** `$env:DATABASE_URL="postgres://..."; pnpm db:migrate`
- **Bash:** `DATABASE_URL=postgres://... pnpm db:migrate`

### Auth / cookies not working in dev

`BETTER_AUTH_BASE_URL` must match the origin the browser sees. With the Vite proxy, the browser origin is `http://localhost:5173`, so set:

```env
BETTER_AUTH_BASE_URL=http://localhost:5173
```

Do not use `http://localhost:3000` for local dev.

### Docker: "Cannot connect to Postgres" or migrations from host

For self-hosted Compose, Postgres is not exposed to the host by default. Either expose `5432` on the `postgres` service temporarily to run `pnpm db:migrate` from the host, or run migrations from inside a container that has network access to the `postgres` service and the migration tooling.

### Windows PowerShell: env vars for one command

Use `$env:VAR="value"; command` (semicolon, no space before `;`). For multiple vars:

```powershell
$env:DATABASE_URL="postgres://..."; $env:OTHER="..."; pnpm db:migrate
```
