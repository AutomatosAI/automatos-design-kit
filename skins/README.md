# skins/

Example skins as source folders, one per skin: `skins/<slug>/skin.json` plus `skins/<slug>/assets/` (fonts, mascot clips, `preview.png`). Each must pass `npm run validate skins/<slug>`, and `npm run pack skins/<slug>` turns it into `dist/<slug>-<version>.autoskin`.

The examples are Ember, Daylight, Workshop and Neon (PRD-004 K-008); the kit's Examples page lists them, and `tests/skins/examples.test.ts` runs the validator and the packer over each. Copy one to start your own. Their `assets/preview.png` is drawn by `npm run previews`. Ember and Workshop use Auto (`"mascot": {"mode": "auto"}`): his clips are never in a skin folder. A skin holds data only: never CSS, JavaScript, SVG, HTML or URLs.
