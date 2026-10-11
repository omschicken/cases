# Vercel API + Supabase

Этот проект может работать без Railway: Vercel обслуживает сайт и NestJS API-функцию, а Supabase хранит PostgreSQL.

## Переменные Vercel

Добавьте на production и preview:

- `DATABASE_URL` — Supabase pooler, порт 6543, с `pgbouncer=true`;
- `DIRECT_URL` — прямое подключение Supabase, порт 5432;
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`;
- `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL=7d`;
- `WEB_ORIGIN=https://cases-x18t.vercel.app`;
- `API_PUBLIC_URL=https://cases-x18t.vercel.app/api`;
- `VITE_API_URL=/api`;
- `USD_TO_RUB_RATE` — подтверждённый курс для RUB-каталога;
- временно: `PAYMENTS_*_PROVIDER=mock` и `KYC_PROVIDER=mock`.

## Supabase

1. Откройте Supabase → **Project Settings → Database → Connection string**.
2. Runtime URL возьмите из **Transaction pooler** (порт 6543).
3. Migration URL возьмите из **Direct connection** (порт 5432).
4. Локально или в одноразовом CI-запуске выполните `pnpm --filter @cs2-cases/api prisma:deploy` с этими переменными.

## Vercel

Корневой каталог проекта — `apps/web`. Конфигурация `apps/web/vercel.json` собирает сайт и публикует `apps/web/api/[...path].ts`. Проверка после первого пакетного деплоя:

- `GET /api/health` → `{"status":"ok","service":"cs2-cases-api"}`;
- `GET /api/cases`;
- регистрация и Steam OAuth callback.

До подключения лицензированных PSP, KYC и Steam trade adapters реальные деньги включать нельзя: в репозитории остаются mock-провайдеры.
