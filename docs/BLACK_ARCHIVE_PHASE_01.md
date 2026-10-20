# DROPZONE / BLACK ARCHIVE — Phase 01

## Visual system

- **Palette:** graphite `#070806`, elevated carbon `#10110e`, warm metal `#282920`, bone white `#f1f0e8`, archive amber `#d7a83a`. Rarity colors appear only on item signals.
- **Type:** display type creates the composition; interface type carries actions, names and prices; mono is limited to indices and state labels.
- **Grid:** a 12-column desktop rhythm with a 1440px content cap. Home cards use responsive `auto-fill`; mobile becomes a dense two-column archive.
- **Spacing:** 4px base scale. Large sections breathe at 48–96px; controls and card internals use 8–24px.
- **Cards:** squared metal plates, 2–6px radii, thin warm edges, contact shadow, one directional highlight. The object, name, price and action stay in that order.
- **Light:** one warm key light and a neutral rim. No ambient purple brand glow and no decorative particle field.
- **Motion:** CSS transitions for hover and focus; movement stays under 360ms. Continuous motion is limited to live data and disabled by `prefers-reduced-motion`.
- **Responsive:** the hero remains a complete composition on mobile; secondary proof and archive decoration simplify before primary content does.

## CSS ownership

`dz-tokens.css` owns the shared palette and motion. `dz-hero.css`, `dz-card.css`, and `dz-nav.css` are loaded after legacy redesign sheets and own the current shell/home selectors. New global `!important` rules are prohibited. Untouched game routes keep their existing visual layer until their own phase.
