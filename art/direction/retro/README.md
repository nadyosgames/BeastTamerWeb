# Approved ink-and-parchment direction

The user approved `art/style-ref/retro-menu.png` and `retro-run.png` as the new visual direction on 2026-10-02. The previous painterly direction is superseded.

Dark hand-inked library scenery; warm cream parchment; thick warm-black outlines; muted cel colors; expressive 1930s cartoon faces and pie-cut pupils; brick-red primary controls. UI text, card rules, numbers and frames remain real components. Card art has sparse elemental doodles and no scenic landscape.

`plan.json` stores each individual built-in ImageGen job. Generate one asset per request. Visually check the full-size output before import: eyes/pupils, connected and species-appropriate limbs, wings/fins/tail, silhouette, safe framing and thumbnail readability. Reject and repair malformed anatomy. Imported assets retain the previous master under `art/source/revisions/`. Generated raster assets use the existing master → WebP + thumbnail pipeline.

Weather characters, pack props, elemental icons and the glove cursor are native SVG UI. They do not require separate raster generations.

Progress is recorded per asset; a pending entry must not be described as completed.
