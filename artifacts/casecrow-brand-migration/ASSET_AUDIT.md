# CaseCrow asset audit

## Source kit

`CaseCrow_Brand_Foundation_V1.zip` was not present in Downloads, Desktop, or the Codex attachment store during this migration. The interface therefore uses a temporary code-native geometric crow mark that follows the supplied graphite, milk, and muted-sage direction. Replace it with the approved vector files from the foundation kit when they are available.

## Raster assets that still contain the retired identity

These files are intentionally left untouched because removing raster lettering with CSS or destructive retouching would reduce quality:

| File | Retired marking | Current use | Required replacement |
| --- | --- | --- | --- |
| `apps/web/src/assets/editorial-kit/hero-editorial.webp` | `DZ` on the hero case | Home hero and mobile hero | Original CaseCrow hero scene, same crop and lighting |
| `apps/web/src/assets/editorial-kit/static-case.webp` | `DZ` on the case | Static catalog card | Original CaseCrow Static Case art |
| `apps/web/src/assets/case-detail-editorial/static-case.webp` | `DZ` on the case | Static case detail scene | Original CaseCrow Static Case detail art |
| `apps/web/src/assets/case-detail-editorial/static-case-cutout.webp` | `DZ` on the case | Static opening scene | Transparent CaseCrow Static Case cutout |

The duplicated raster subjects above should be replaced as a coordinated set so the catalog, detail page, and opening sequence remain visually consistent. The other audited case images contain collection symbols rather than `DZ` or `DROPZONE` text.

## New temporary public assets

- `apps/web/public/casecrow-mark.svg`: scalable favicon in graphite, milk, and muted sage.
- `apps/web/src/components/CaseCrowLogo.tsx`: accessible shared public signature for both application shells.

Internal class names with the `dz-` prefix and the local-storage key `gundone.lang` remain unchanged because they are not public branding and renaming them would add regression risk.
