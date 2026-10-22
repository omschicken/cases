# Casecrow: 15 original case images (21 October 2026)

## Status
This branch adds **two editorial galleries** with 15 exact artwork slugs. The front end deliberately marks an image-only card as **Готовится** until a real, active case with that slug exists in the API. It does **not** simulate availability or opening.

**Production is unchanged.** The supplied JPG/PNG user images are not yet committed as binary assets through the connector. Before deploying this branch, place the files from the accompanying `Casecrow_15_Web_Assets.zip` archive at:

`apps/web/public/casecrow-originals/*.webp`

There are 15 images. The archive also contains `manifest.json`, `thumbnails/`, and `preview.jpg`; only `apps/web/public` should be merged directly into the repository.

## Collections

- Авторская коллекция (13): raven, ancient, blackout, anubis, ice-vein, dragon-fire, eco-round, headshot, fade, gold-rush, blood-money, toxic, doppler.
- Кристальная коллекция (2): ruby-crystal, sapphire-crystal.

## Server-side configuration required before enabling opening

API data are persisted in PostgreSQL/Prisma, NOT generated from gallery cards. Configure 15 `Case` records with these exact slugs, each containing a vetted CS2 item pool, market-grounded prices, weights and valid image URLs. Validate: (1) probabilities are nonzero and transparent (2) `assessCaseEconomics` allows opening (3) each price includes platform margin and protection from stale prices (4) no historical inventory or provably-fair references are overwritten (5) test in staging, then make active. Never invent fake prices or odds or clone mismatched market values just to unlock the UI.

The gallery checks `isActive && canOpen !== false`; it does not construct client-side drop outcomes.

## Deployment

The public cases-x18t Vercel project is separate from the other `cases` project. It last served commit `20edb789d10327eec4fa5822f26b5f33902d9153` when work began. Deploy only after the binary assets, database records and staging checks are complete. Preserve existing production configuration and check /api/cases, individual /api/cases/:slug and sample opening flow.
