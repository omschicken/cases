# CS2 Cases

A real-money CS2 case-opening platform: users deposit, open cases with a
provably-fair RNG, and withdraw winnings as cash, crypto, or CS2 skins.

## ⚠️ Legal status — read before deploying with real money

This is a **regulated gambling product**. The code here implements the
platform mechanics (wallet, provably-fair RNG, KYC gating, admin review)
correctly, but it does **not** make the business legal to run. Before
accepting a single real deposit:

- **Get a gambling licence** for every jurisdiction you operate in (LatAm:
  e.g. Coljuegos in Colombia, SEGOB in Mexico, provincial licences in
  Argentina — requirements differ by country and change often). Operating
  without one risks criminal liability, not just a fine.
- **Card/crypto payment providers require proof of licence** before they'll
  process gambling transactions — get the licence first, the PSP contract
  second.
- **KYC/AML is mandatory** for withdrawals almost everywhere gambling is
  licensed. This app gates withdrawals on `KycStatus.VERIFIED` (see
  `apps/api/src/kyc/kyc.service.ts`), but the identity-verification
  itself is a mock — wire a real provider before going live (see below).
- **The Steam-skin rail is the highest-risk one.** Valve has repeatedly sent
  cease-and-desist letters to CS2 skin-gambling sites and can ban the bot
  accounts / API keys such a site depends on. Get specific legal advice
  before enabling `STEAM_SKIN` deposits/withdrawals in production.
- Age gating here is a checkbox at signup plus a DOB check in KYC
  (`MINIMUM_AGE_YEARS` in `kyc.service.ts`) — confirm the legal age is
  correct for your licensing jurisdiction (often 18, sometimes higher).

None of this is legal advice. Talk to a gambling-law specialist in your
target jurisdiction(s) before launch.

## Architecture

Monorepo (pnpm workspaces):

```
apps/api      NestJS + Prisma + PostgreSQL backend
apps/web      React + Vite frontend (player site + /admin dashboard)
packages/shared  Provably-fair RNG, shared types, zod schemas
```

### Provably-fair case opening

`packages/shared/src/provablyFair.ts`. Standard commit-reveal scheme:

1. The server generates a `serverSeed` and publishes `sha256(serverSeed)`
   (the "commitment") **before** any roll is made against it — see
   `GET /cases/seed/me`.
2. Each case-open consumes the next `nonce` for the user's active seed pair
   and computes `HMAC-SHA256(serverSeed, "${clientSeed}:${nonce}")`; the
   first 32 bits become a roll in `[0, 1)`, which picks a weighted item.
3. When the user rotates their seed (`POST /cases/seed/rotate`), the old
   `serverSeed` is revealed. Anyone can then recompute every past roll and
   confirm both the commitment hash and the resulting item —
   `GET /cases/open-events/:id/verify` does this and is a public endpoint
   for exactly that reason.

Covered by unit tests in `packages/shared/src/provablyFair.test.ts`,
including a 20k-trial distribution check and explicit tamper-detection
tests.

### Money handling

All balances are integer minor units (`BigInt`, e.g. cents) — see
`packages/shared/src/money.ts`. Never introduce floating point into the
wallet/ledger path.

`apps/api/src/wallet/wallet.service.ts` is the only place balances are
mutated. Every change is:

- backed by an append-only `LedgerEntry` (so the balance can always be
  reconstructed independently — the concurrency test below checks this
  directly), and
- guarded by a `SELECT ... FOR UPDATE` row lock on the wallet, so
  concurrent requests against the same user's wallet (e.g. two case-opens
  firing at once) can't race and lose an update.

`apps/api/test/wallet.service.test.ts` is an integration test against a
real Postgres database that fires 20 concurrent debits against a balance
that can only cover 10, and asserts exactly 10 succeed, the balance never
goes negative, and replaying the ledger reproduces the final balance.

### Withdrawals: hold-then-pay

Requesting a withdrawal immediately debits (holds) the funds and creates a
`PENDING` `Withdrawal` row, so the same balance can't be spent twice while
it sits in the admin review queue. An admin then approves (calls the
payment provider, marks `PAID`, or credits the hold back and marks
`FAILED` if the provider call fails) or rejects (credits the hold back,
marks `REJECTED`) via `/admin/withdrawals/:id/review`.

### Pluggable payment / KYC providers

Nothing in the business logic talks to a real PSP, crypto processor,
Steam bot, or identity-verification vendor — everything goes through an
interface with a `mock` implementation wired up by default:

| Interface | File | Mock impl | Swap in |
|---|---|---|---|
| `PaymentProvider` (per rail) | `apps/api/src/payments/payment-provider.interface.ts` | `providers/mock-{card,crypto,steam}.provider.ts` | Real PSP / crypto processor / Steam bot adapter |
| `KycProvider` | `apps/api/src/kyc/kyc-provider.interface.ts` | `providers/mock-kyc.provider.ts` | Sumsub / Veriff / Onfido / etc. |

The mock payment providers confirm deposits and pay out withdrawals
**synchronously**, which real PSPs never do — real integrations confirm
asynchronously via webhook. `PaymentsController` has a `TODO` marking
where a `POST /payments/webhook/:rail` handler needs to go once you wire a
real provider.

Swap a provider by changing the binding in the relevant `*.module.ts`
(e.g. `PaymentsModule`, `KycModule`) — `PaymentsService`/`KycService` never
need to change.

### Referral program

5% (configurable via `REFERRAL_COMMISSION_BPS`) of a referred user's
confirmed deposit is credited to the referrer's wallet automatically
(`apps/api/src/referral/referral.service.ts`).

## Local development

Requires Node 20+, pnpm, and a PostgreSQL instance.

```bash
pnpm install

# Postgres via Docker...
docker compose up -d
# ...or point apps/api/.env at any Postgres instance you already have.

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# edit apps/api/.env: set DATABASE_URL, JWT secrets

cd apps/api
pnpm prisma:migrate   # applies migrations, generates the Prisma client

cd ../..
pnpm dev:api   # http://localhost:4000
pnpm dev:web   # http://localhost:5173
```

The first user you register is a normal `USER`. To reach `/admin`, promote
a user to `ADMIN` directly in the database:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';
```

(then log out and back in — the role is baked into the JWT).

Create a case from `/admin/cases` (or `POST /admin/cases`), then deposit
and open it from the player site — the mock payment providers confirm
instantly so the whole loop works without any real credentials.

## Tests

```bash
pnpm --filter @cs2-cases/shared test   # provably-fair RNG unit tests
pnpm --filter @cs2-cases/api test      # wallet ledger integration tests (needs Postgres)
```

## What's still missing before production

- Real PSP / crypto processor / KYC vendor / Steam bot integrations (see
  table above) plus the webhook endpoints they need.
- File/object storage for KYC document uploads (`kyc.submit` currently
  takes URLs directly).
- Real gambling licence(s) for every jurisdiction served, and legal sign-off
  on the Steam-skin rail specifically.
- Responsible-gambling tooling most licences require: deposit limits,
  self-exclusion, session reminders.
- Production hardening: structured logging/alerting on the admin actions
  and payment flows, secrets management for `.env` values, HTTPS/CORS
  locked to the real domain, rate limiting tuned for production traffic
  (a basic global throttle is enabled via `@nestjs/throttler`).
