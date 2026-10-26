# Design handoff

- `handoff/stage-1` … `stage-6` — all screens: World 1 (map, path, learn card, pick, drag, end of level) and the
  motion spec; World 2 games; World 3 games; World 4 games and boss; motivation (rank up, album, streak freeze,
  certificate); stage 6: parent gate, dashboard, settings, my new words, content review, backup, duel (setup, pass the phone,
  results) and edge states. Each of stages 2-5 has its handoff summary; stage 5 also has
  DESIGN.md v1.2.
- `handoff-v1.1/` — v1.1 tokens, component sheet, summary and SVG assets (mascot, collectible).

Deviations agreed with the product owner: backups are plain, unencrypted JSON (no "encrypted" label, no clipboard
backup code); the app is offline-first, so there is never a blocking offline screen, only a small notice on actions
that need the network (e.g. sharing).

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
