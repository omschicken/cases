# Editorial Light — temporary asset replacement list

The current images are crops from a single AI mockup. They remain suitable only for layout validation on the dev-only `/design-lab` page and must not be treated as production source art.

| File | Current size | Current use | Required replacement |
| --- | ---: | --- | --- |
| `hero.webp` | 738×320 | Desktop and mobile Hero | Original uncropped Hero panorama at least 2400×1040 px, without baked UI or text; preserve the current 738:320 composition. |
| `static.webp` | 902×522 | Static Case card | Standalone original case render at least 1804×1044 px, same 902:522 framing, clean background, no baked labels/UI. |
| `ignition.webp` | 902×522 | Ignition Case card | Standalone original case render at least 1804×1044 px, same framing and lighting, no baked labels/UI. |
| `tidal.webp` | 902×522 | Tidal Case card | Standalone original case render at least 1804×1044 px, same framing and lighting, no baked labels/UI. |
| `phantom.webp` | 902×522 | Phantom Case card | Standalone original case render at least 1804×1044 px, same framing and lighting, no baked labels/UI. |
| `promo.webp` | 766×110 | Collection banner | Original banner panorama at least 1532×220 px, without baked button/text; preserve the current 383:55 composition. |

## Technical rendering until replacement

- Hero is capped at its native 738 px width on desktop and uses `object-fit: contain`.
- Case artwork uses its native 902:522 aspect ratio and `object-fit: contain`.
- Promo is capped at its native 766×110 display size and uses `object-fit: contain`.
- Image hover scaling has been removed.
- The four-column desktop grid is unchanged.
