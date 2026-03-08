# Build and run from monorepo root: docker build -f apps/web/Dockerfile .
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.6 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ui/package.json packages/ui/
COPY packages/db/package.json packages/db/
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/package.json /app/package.json
COPY --from=deps /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY --from=deps /app/pnpm-lock.yaml /app/pnpm-lock.yaml
COPY --from=deps /app/turbo.json /app/turbo.json
COPY packages/ui /app/packages/ui
COPY packages/db /app/packages/db
COPY apps/web /app/apps/web
COPY apps/server/package.json /app/apps/server/
WORKDIR /app
RUN pnpm build --filter=web

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
RUN echo 'server { root /usr/share/nginx/html; index index.html; location /api/ { proxy_pass http://server:3000/; proxy_http_version 1.1; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; } location / { try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
