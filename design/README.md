# Design handoff

- `handoff/` — latest handoff (v3.0): World 3 games (intensity ladder, register sort, context choice) and summary.
- `handoff-v1.1/` — v1.1 tokens, component sheet, summary and SVG assets (mascot, collectible).
- `handoff-v1.0/` — v1.0 screens still in use for World 1 (world map, station path, learn card, pick the synonym,
  drag pairs, end of level) and the motion spec. Kept until a later handoff replaces those screens.

Game text in mockups is illustrative; the app always renders text from the data. Follow v1.1 (dark cards) where
DESIGN.md disagrees.

## Dropping in a new handoff

1. **Tokens:** replace `src/design/tokens.json` with the designer's `tokens.json`, verbatim. The designer's
   `tokens.css` is not needed: CSS variables are generated from the JSON at startup (`src/design/tokens.ts`).
   Values the designer has not defined yet live in `src/design/tokens.supplement.json`; the designer's file wins on any
   shared path, so new designer values replace them automatically.
2. **Icons:** put each SVG in `src/design/icons/<name>.svg`, drawn with `currentColor`. Names are listed in
   `src/ui/icons.ts`.
3. **Assets:** mascot and collectibles go in `src/design/assets/`.
4. Run `npm test`. The token contract test lists any variable the stylesheets use that the new tokens no longer
   define. If the designer renamed a token, remap it in `src/styles/theme.css`, the only file that names `--wq-*`
   variables.

World colors are also exposed by order (`--wq-world-1-primary` ...), so renaming a world key is not breaking.
