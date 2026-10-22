# DROPZONE Editorial V2 — Asset quality gate

This page is an isolated visual concept. None of these assets are approved for production commerce yet.

| Asset | Source | Match | Resolution / format | Transparency | Rights status | Device use |
| --- | --- | --- | --- | --- | --- | --- |
| Static Case | Original image-generation output created for this design lab | Static Case concept | 1536×1024 RGBA PNG | Yes | Project-original concept; commercial terms must be confirmed before production | Hero, desktop and mobile card |
| Ignition Case | Original image-generation output created for this design lab | Ignition Case concept | 1145×1374 RGBA PNG | Yes | Project-original concept; commercial terms must be confirmed before production | Desktop and mobile card |
| Dragon Case | Original image-generation output created for this design lab | Dragon Case concept | 1536×1024 RGBA PNG | Yes | Project-original concept; commercial terms must be confirmed before production | Desktop and mobile card |
| Editorial Light hero scene v2 | ImageGen composition based on the project-original Static Case concept | Static Case in a warm architectural showroom | 1672×941 JPEG | No | Project-original design-lab concept; commercial terms must be confirmed before production | Hero, desktop and mobile |

## Production requirements

1. Confirm that Static, Ignition and Dragon are actual catalog entities and map them to their real API records before integration.
2. Record the author, license and source URL for every Valve/Steam/CS2-derived item image.
3. Keep the Hero free from undocumented weapon renders. If a weapon is added later, record its market name, finish, source and license before production.
4. Export approved case masters as transparent WebP/AVIF plus PNG fallback: 1600 px desktop, 900 px mobile, with a consistent color profile and no baked background.
5. Keep rarity color only for a verified case/item rarity and never as generic decoration.

Until those checks are complete, `/design-lab` remains development-only and does not present its demo cards as live API inventory.
