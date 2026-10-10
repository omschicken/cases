# Deploying the API on Vercel

Create a separate Vercel project for the API from this repository and set its **Root Directory** to `apps/api`. The project configuration in this directory builds the shared workspace package and API, then routes the existing API paths through a Node.js Function. API paths remain `/auth/...`, `/cases/...`, etc.; the internal `/api` function prefix is rewritten away.

Set these production environment variables in the API project:

- `DATABASE_URL`: Supabase Transaction Pooler URL on port `6543`. For Prisma 5, append `?pgbouncer=true&connection_limit=1` (or use `&` if the URL already has query parameters).
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`: the same signing secrets used by the current API. Do not generate new ones during cutover or existing sessions will stop working.
- `WEB_ORIGIN`: the production Vercel website origin, with no trailing slash.
- `API_PUBLIC_URL`: the new API project origin, with no trailing slash; Steam OpenID uses it for its callback URL.
- Copy any currently used provider variables, including `STEAM_API_KEY`, payment/KYC settings, `USD_TO_RUB_RATE`, and bootstrap-admin variables. Keep secrets in Vercel Environment Variables, never in Git.

Set `VITE_API_URL` in the website's Vercel project to the new API origin (no trailing slash), then redeploy the website. Update the Steam OpenID return URL configuration to the new API callback before testing Steam login.

## Cutover blockers

Do not remove the Railway API until the Vercel deployment and authenticated flows have been checked against Supabase.

The API's daily price synchronization currently runs with Nest's in-process scheduler. That scheduler is disabled automatically on Vercel because Function instances are short-lived and can be concurrent. The admin sync endpoint also starts a long background operation; it needs a durable, resumable job (for example, a Vercel Workflow with bounded batches) before production cutover. The current in-memory throttler is also per Function instance, so its rate limits are not shared across concurrent instances and need a shared store or platform-level protection for production.
