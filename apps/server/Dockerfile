# Build and run from monorepo root: docker build -f apps/server/Dockerfile .
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.6 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json packages/db/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile

FROM base AS runner
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/package.json /app/package.json
COPY --from=deps /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY --from=deps /app/pnpm-lock.yaml /app/pnpm-lock.yaml
COPY packages/db /app/packages/db
COPY apps/server /app/apps/server
WORKDIR /app/apps/server
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "run", "dev"]
