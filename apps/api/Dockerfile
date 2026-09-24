# Build context is the repo root (this is a pnpm workspace: apps/api depends
# on packages/shared). Railway config: see railway.json at the repo root.

FROM node:20-slim AS builder
# node:20-slim is Debian 12 (bookworm, OpenSSL 3.x) but ships without the
# `openssl` package itself, so Prisma's engines can't detect the OpenSSL
# version to link against and silently pick the wrong one — install it
# explicitly, as Prisma's own warning recommends.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

# Install deps first (better layer caching) — copy just the manifests needed
# to resolve the workspace graph.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/api apps/api

RUN pnpm --filter @cs2-cases/shared build
RUN pnpm --filter @cs2-cases/api run prisma:generate
RUN pnpm --filter @cs2-cases/api build

FROM node:20-slim AS runtime
# Same reason as the builder stage: `prisma migrate deploy` runs here at
# container startup and needs a detectable OpenSSL to load its schema engine.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /repo

# Copy the whole workspace tree (not just prod deps) so the Prisma CLI
# (a devDependency, needed for `prisma migrate deploy` at startup) and the
# pnpm symlink layout both stay intact.
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /repo/packages/shared ./packages/shared
COPY --from=builder /repo/apps/api ./apps/api

WORKDIR /repo/apps/api
EXPOSE 4000

# Apply pending migrations, then start the API. DATABASE_URL and the JWT
# secrets are supplied as Railway environment variables, not baked in here.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma && node dist/main.js"]
