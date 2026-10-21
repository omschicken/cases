# CSMarketCap → CS.MONEY reference price feed

## Purpose
Imports **read-only** marketplace data into `market_csmoney_quote`. No buying, delivery, Steam bot, admin inventory changes, case drop repricing or wallet changes.

The API endpoint is documented at https://docs.csmarketcap.com/min-prices

- POST `https://api.csmarketcap.com/api/v2/graphql` with `createSubscriptionToken(api_key: "...")`. Tokens last two hours.
- POST `https://api.csmarketcap.com/api/v2/rest/get-aggregated-min-prices` with `{"game_id":730,"markets":["csmoney"]}` and `api-token` header.
- Exact `market_hash_name` -> price and availability count. Currency **USD**, price is **USD × 1000**. E.g. `price: 12345` means `$12.345`, not $123.45.
- `price_locked` is an optional trade-restricted price, stored separately.
- Images, stickers, float, paint seed and knife Doppler phase identifiers **are not provided** by this endpoint. Never infer a phase from a generic name.

## Storage
`market_csmoney_quote`: exact `market_hash_name`, `price_usd_milli`, `price_locked_usd_milli`, `offers`, `observed_at`.

`market_csmoney_sync_state`: `last_started`, `last_success`, `last_error`, `rows_received`, `rows_saved`, `duration_ms`.

New tables have RLS enabled with no public policies; the server's PostgreSQL role manages them. Existing market prices in `market_item`, `SkinPrice`, `CaseItem` are unchanged.

## Getting started
1. Subscribe to CSMarketCap Min Prices and generate an API key in https://csmarketcap.com/profile → API Keys.
2. In GitHub repository Settings → Secrets and variables → Actions, set `CSMARKETCAP_API_KEY` and verify existing `SUPABASE_DATABASE_URL`. Never commit the key, JWT or database credentials.
3. Apply `apps/api/prisma/migrations/20261021170000_add_market_csmoney_quote/migration.sql` to the correct Supabase project (already applied to `omcsdqiyhsgpvibqgune`).
4. Merge the implementation into the repo **default branch**. GitHub scheduled workflows execute on the default branch only. Alternatively, manually run the command on a connected deployment environment with both credentials:
   `pnpm --filter @cs2-cases/api prisma:sync-csmoney`.
5. From GitHub Actions, run **Sync CS.MONEY reference quotes** once manually to verify provider subscription; inspect its logs and check the status SQL below.

Workflow trigger: minutes 7, 22, 37 and 52 (UTC), every hour. Approximately 2,880 successful snapshots / 30-day month. Each snapshot needs a JWT mint plus a data query; budget at least **5,760 API calls** per month, excluding errors / retries, when selecting your plan. Provider limits and prices may change.

## Status checks
```sql
SELECT last_started, last_success, last_error, rows_received, rows_saved,
       duration_ms FROM public.market_csmoney_sync_state WHERE id = 1;

SELECT count(*) AS known_items,
       count(*) FILTER (WHERE observed_at > now()-interval '30 minutes') AS fresh_items,
       count(*) FILTER (WHERE offers=0) AS reported_zero_offers,
       min(observed_at) AS oldest_quote, max(observed_at) AS newest_quote
FROM public.market_csmoney_quote;

SELECT market_hash_name, price_usd_milli/1000.0 AS price_usd, offers, observed_at
FROM public.market_csmoney_quote
WHERE market_hash_name = 'AK-47 | Redline (Field-Tested)';
```

## Failure and data-integrity policy
- Authenticate each job with a new JWT. Retry transient HTTP 429/5xx and network errors with backoff; never log credentials.
- Under 1,000 valid quotes means a suspiciously partial response: **fail without importing**.
- Rate-limit concurrent runs. Existing quotes persist if one import fails or an item disappears. Use `observed_at` to identify stale entries. A zero offer value does not automatically modify wallet or case economics.
- No direct writes to real-case valuations until market feed reliability is independently verified and explicitly approved.

## Tests
`pnpm --filter @cs2-cases/api test -- csmc-csmoney.test.ts`

Tests cover exact names and CS.MONEY-only price rows, USD-thousandths, locked prices, stock counts, incomplete / malformed records, and not inventing Doppler phases.

**Current activation status:** importer and schema prepared; the actual data feed requires your paid CSMarketCap subscription / API key. Do not claim that it is live based on a successful build or schema migration.
