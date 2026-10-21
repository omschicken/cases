#!/usr/bin/env bash
set -euo pipefail

cd ../..
pnpm install --frozen-lockfile

is_writable_preview=false
if [[ "${VERCEL_ENV:-}" == "preview" && "${CASECROW_PREVIEW_WRITABLE:-}" == "1" && -n "${DATABASE_URL:-}" ]]; then
  is_writable_preview=true
  # Neon supplies both pooled and direct URLs. Prisma migrations must use the
  # direct endpoint while the serverless runtime keeps the pooled DATABASE_URL.
  export DIRECT_URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}"
fi

pnpm --filter @cs2-cases/api prisma:generate

if [[ "$is_writable_preview" == "true" ]]; then
  pnpm --filter @cs2-cases/api prisma:deploy
  pnpm --filter @cs2-cases/api seed:cases:db
fi

pnpm --filter @cs2-cases/shared build
pnpm --filter @cs2-cases/api build
pnpm --filter @cs2-cases/web build
