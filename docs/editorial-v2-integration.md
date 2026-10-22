# Editorial V2: four sections

Branch: codex/editorial-v2-four-sections. Base: f66ffca8a0665eba73611be3cb04341838192992.
No production deployment is part of this change.

## Connected behavior

- Shared EditorialShell, approved CaseCrow logo and self-hosted Cyrillic Inter; 76px header / 204px sidebar on desktop, shared mobile navigation includes inventory.
- Battles: GET /cases, POST /games/battles, GET /games/operations/me, GET /wallet/me. One round against the server bot. Explicit price confirmation, real player/bot drops and outcome, wallet refresh, personal history and operation details.
- Contracts: GET /cases/inventory/me, POST /games/contracts. Select 3–10 unique RUB items, remove/clear, search/rarity/sort, exact BigInt totals, server reward and inventory refresh. The displayed rules include the backend's fallback below the usual 60–90% range.
- Upgrade: GET /cases/inventory/me, GET /games/upgrade-targets, POST /games/upgrades. Source/target selection, filters, exact integer preview formula from GamesService, server-authoritative result/chance, restrained result motion and reduced motion. ×2/×3/×5 filter targets by price; they do not change the game rules.
- Inventory: real available inventory, images, prices, weapon/knife/glove and rarity filters, search/sort, multiple selection, transfer selection to contract/upgrade, sequential sale through POST /cases/inventory/:id/sell. Two confirmations; the queue stops on first error. Wallet refresh and verification via GET /wallet/me/ledger.
- Shared financial guard: synchronous in-flight ref; persistent per-user intent written before POST; no replay on timeout/5xx or reload; game history reconciles uncertain operations. Navigator Locks prevents a second tab from queueing another game debit. A sale receipt is matched by inventory ID in the wallet ledger. Existing server conditional item claims remain unchanged.

## Backend limitations found during audit

- No multiplayer battle list, rooms, joining, teams, round streams, spectators, cancellation or multi-round battle API. The existing battle is a synchronous one-case bot operation. The page does not simulate PvP or active rooms.
- GET /games/operations/me returns the last 30 game operations across all game types, not unlimited battle history.
- No Steam item withdrawal endpoint. The inventory endpoint returns only IN_INVENTORY items; no withdrawn/locked/sold inventory history or reliable historical sold counter is exposed. No fake statuses or totals are shown.
- No atomic bulk-sale endpoint. Multiple sales are deliberately individual operations; partial completion is reported and remaining requests stop on error.
- No read-only contract reward pool / upgrade quote API. Upgrade preview reproduces the audited backend formula exactly, with BigInt truncation and 1–75% bounds; the POST response is authoritative. Target catalog is limited by the backend to 250 items.
- No idempotency key on the game POST endpoints. The frontend blocks replay and preserves uncertain intent instead of retrying a charge. If no matching operation appears within the history window, it keeps the operation blocked and directs the user to support.

## Visual verification

Compared the four supplied 1600×1000 renders with actual browser screenshots. Preserved the light palette, shared layout, 330px contract summary, ten compact slots, 288px upgrade center with 196px ring, seven-column pickers, five-column inventory and 240px rail. Iterations corrected image clipping, rule-button contrast, logo sizing, compact remove controls and vertical spacing of filters/cards.
Differences in item names, prices, counts and battle content are intentional: the prototype's fictional data and unsupported modes are not production data. Weapon crops from the prototype were replaced with the project's verified item images, as its README requires. Screenshots use a local API fixture with recorded public catalog item names/prices/images and a simulated account. No screenshot is presented as a live user's balance or inventory.

## Validation

- TypeScript: 0 errors.
- Production Vite build: passed. Existing large-bundle advisory remains; no build failure.
- Vitest: 19 passed across 6 files, including four upgrade pricing boundary/precision tests.
- Browser: 28 passed: 12 page/viewport combinations (1600×1000, 1440×900, 390×844) and 16 action/state checks. Covers double click, cross-tab battle, pending reload, definitive/uncertain failures, success/loss, partial bulk sale, min/max selection, auth, empty/error inventory, fallback images, keyboard dismissal and reduced motion.
- Browser API calls are fulfilled locally. No paid production operation was performed. Live authenticated backend end-to-end transactions were not executed.

Run normal repository typecheck/build/test scripts. With a local web preview running, execute node apps/web/e2e/editorial-sections.cjs. EDITORIAL_BASE_URL must point to localhost. EDITORIAL_ARTIFACT_DIR selects screenshots/report location. EDITORIAL_IMAGE_CACHE optionally points to files named by fixture item ID; otherwise the suite reads the verified fixture image URLs. No external mutation is allowed by the test harness.

## Changed files

apps/web/src/App.tsx
apps/web/src/components/BottomNav.tsx
apps/web/src/components/editorial/EditorialShell.tsx
apps/web/src/components/editorial/SectionUI.tsx
apps/web/src/hooks/useEditorialData.ts
apps/web/src/hooks/useEditorialOperation.ts
apps/web/src/lib/editorialGameRules.ts
apps/web/src/lib/editorialGameRules.test.ts
apps/web/src/styles/editorial-sections.css
apps/web/src/pages/Battles.tsx
apps/web/src/pages/Contracts.tsx
apps/web/src/pages/Upgrader.tsx
apps/web/src/pages/Inventory.tsx
apps/web/e2e/editorial-sections.cjs
docs/editorial-v2-integration.md
