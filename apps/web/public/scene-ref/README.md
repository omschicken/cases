# scene-ref

Textures for the raven case scene (`src/components/raven/`), all derived from `reference.png`, the approved reference render (1254×1254).

| file | what it is |
| --- | --- |
| `reference-chest.jpg` | albedo for the case body, lid and relief (80 % desaturated) |
| `reference-full.jpg` | full colour, used for the pedestal and the backdrop |
| `reference-normal.png` | normal map from the luminance of the reference (3×3 blur, strength 3) |
| `reference-height.png` | contrast-stretched luminance, drives the raven relief displacement |

UVs are baked on the vertices from the hero camera (`sceneConfig.ts`), so the textures stay glued to the geometry.
`reference.png` is only the source for the bake and is not loaded at runtime.
