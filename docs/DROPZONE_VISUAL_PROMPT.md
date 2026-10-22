# DROPZONE — master visual prompt

Design and implement a distinctive, production-ready visual identity for a Counter-Strike 2 case discovery and opening site named DROPZONE. The result should feel like a premium digital armory crossed with a contemporary game editorial: confident, fast, tactile, and clear. It must look original rather than like a reskin of existing case sites.

## Art direction

- Core palette: near-black graphite and deep petrol, with warm off-white type, electric citron as the primary action color, and restrained coral or ice-blue accents. Use color to guide attention, not to flood the screen.
- Typography: strong condensed display headlines paired with a readable neutral body face. Keep clear hierarchy from hero to section heading to item metadata.
- Surfaces: engineered metal, fine grid lines, precise borders, cropped corners, serial markings, and controlled atmospheric light. Avoid generic glassmorphism, casino confetti, gradients on every surface, and fake social proof.
- Case artwork: every case needs its own recognizable identity while sharing the DROPZONE product family. Vary silhouette, material treatment, hue, emblem, nameplate, and subtle pattern. Each design must remain legible at catalog-card size and powerful on its detail page.
- Motion: physical and purposeful. A case may float subtly and its lid may open on deliberate hover or focus, revealing a real catalog item preview. Respect reduced-motion settings. Avoid continuous motion across the whole grid.

## Page composition

1. Header: unmistakable brand, simple utility links, clear sign-in.
2. Hero: one focused message and action, with a real item or case preview. No invented metrics or promotions.
3. Discovery: three price-led routes generated from the live catalog, easy to compare and select.
4. Catalog: fast search, category filters, price sorting, a clear card grid, and honest rarity/price information. The first card may be featured only in the unfiltered view.
5. Case detail: dramatic case stage, exact price, item count and odds, an obvious opening action, and a complete item roster.
6. Footer: concise transparency and legal information.

## Quality bar

- Desktop, tablet, and phone layouts should be intentionally composed, not just shrunk.
- Minimum text contrast and visible keyboard focus; meaningful information cannot depend on hover alone.
- Use actual API data for prices, counts, odds, and images. Never invent wins, player counts, discounts, or scarcity.
- Keep load, empty, and error states designed. Keep product navigation usable if the API is temporarily unavailable.
- Reuse the existing React/CSS stack and make every visual element maintainable in code. Do not add a heavy animation or UI library solely for decoration.
- Judge success by first-glance recognition, ability to find an affordable case quickly, clarity of the case detail, and consistency across every catalog item.
