# Raven interactive opening — stage 1

## Verified baseline
Production alias cases-x18t.vercel.app resolves to READY deployment dpl_BW4b3VM7rH15Ng71dsM3dZiUU3MA, SHA 0e4ddb24ee866618a3485d47751fbb539b487b91 (checked 2026-10-21). Repository default branch claude/cs2-case-opening-site-0k0i3z is a different revision. This change is based on the deployed SHA, without incorporating or overwriting the many active work branches.

pnpm monorepo: apps/web (React 18 / Vite), apps/api (NestJS / Prisma), packages/shared (money, schemas, provably fair logic). apps/web/api/router.ts hosts the API on Vercel. Existing styles and result receipt remain authoritative.

## Authority and safety
POST /cases/open and /cases/open-batch are authenticated and throttled. CasesService debits wallet and creates inventory/event inside one Prisma transaction with wallet and seed row locking; result is broadcast after commit. There is no request-id idempotency contract. Do not automatically replay requests after timeout or ambiguous failure.

RavenStage imports no API client, wallet, odds, or random selection. CaseDetail retains its synchronous click lock, pending receipt and uncertain-response recovery. The animation only observes `opening` and the returned `winner`. Skip does not abort or resend the mutation. Navigation cancels presentation timers; it does not claim to cancel a committed purchase. Existing receipt recovery handles the response. Batch results remain in the existing results grid. Other cases retain the reliable reel.

## Prototype scope
RavenWorld is actual rendered and animated Three.js geometry: separate body, hinge-pivot lid, pivoting locks, raven body/head/beak/eyes/feather wings, planter, floor, shadows and particles. Pointer moves the raven head and case orientation. A damped landing curve approximates soft physics, not a rigid-body simulation. Sound is synthesized and opt-in. Marble is a procedural floor study, not a photoreal scanned material. Result uses the existing real server item image and receipt.

No production-quality GLB models are present or claimed. No prerecorded video or AI image substitutes for 3D. Missing final assets: authored Raven.glb, rigged raven-bird.glb, botanical/marble PBR textures, designed impact/wing/lock audio. Current prototype is for visual review and must not be promoted without QA.

## Asset contract / pipeline
Create in Blender at meter scale, Y-up on glTF export, origin at floor center; apply transforms. Raven.glb: Body, LidPivot at rear hinge, Lid, LockLeftPivot, LockRightPivot, separate inner cavity and emission surface. Lid opens 0–110 degrees without intersecting the body. Raven-bird.glb: skeleton root, body/head/neck/tail and left/right wing chains; clips FlyIn, Land, FoldWings, Idle, React, TakeOff, FlyAway. Clips must blend without root jumps. Preserve physical scale and perch position at y=1.58.

Author a high-poly sculpt, bake normal/AO onto mobile retopology, use metallic/roughness PBR and packed ORM. Target case <=35k triangles, bird <=25k, <=50 bones, <=4 materials each, 1k mobile / 2k desktop textures. Export GLB, validate with Khronos validator, inspect in glTF viewer and test low-end devices. Use meshopt and KTX2 only with tested decoder fallback. Record asset license/source and revision. Do not silently load missing asset paths.

Replace the geometry renderer behind the same presentation phase contract using useGLTF and AnimationMixer; never couple animation completion to another API request. Extend by slug configuration only after Raven passes review.

## Accessibility / degradation
Reduced motion skips phase delays and removes dust / sway. DPR capped at 1.5, low-power WebGL preference, 256px contact shadow, bounded geometry and 45 dust sprites. Unsupported WebGL2, render errors and lost context use the existing reel. Intro and purchase animations can be skipped independently. The existing DOM buttons and result remain keyboard accessible.
