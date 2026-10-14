# skins/

Example skins as source folders, one per skin: `skins/<slug>/skin.json` plus `skins/<slug>/assets/` (fonts, mascot clips, `preview.png`). Each must pass `npm run validate skins/<slug>`, and `npm run pack skins/<slug>` turns it into `dist/<slug>-<version>.autoskin`.

The examples are Ember, Daylight, Workshop and Neon (PRD-004 K-008). Copy one to start your own. A skin holds data only: never CSS, JavaScript, SVG, HTML or URLs.
