# @automatos/look-kit

The look runtime a theme with looks bundles (PRD-261 §7): from the theme's own catalogue, a look's custom properties
and Studio's tokens, the WCAG contrast math that keeps every text colour readable on its ground, Studio's HSL triplets,
and the schema-driven look validator. It holds no catalogue, no variable prefix and no look format of its own: the
theme passes them in.

It starts from Play's copy of core's `frontend/lib/look-kit` (core keeps its own copy for the host). The files came
out of `themes/play/src/lib/look-kit/` as they were, but for their imports, which name each other with the `.ts`
extension so plain Node loads them too (the theme CLI's `check design` and `scripts/compile-looks.mjs`).

| Module | What it does |
|---|---|
| `@automatos/look-kit/contrast` | WCAG 2.2 luminance and contrast ratio; `readableOn` and the colour mixes that make a text colour read at AA |
| `@automatos/look-kit/css` | a look as the theme's `--<prefix>-*` custom properties, the glow caps, `applyCssVars` |
| `@automatos/look-kit/hsl` | `#rrggbb` to and from Studio's `H S% L%` triplets |
| `@automatos/look-kit/studio-tokens` | a look as Studio's tokens; the consequence tokens are the catalogue's error colour, never the accent |
| `@automatos/look-kit/types` | the catalogue and a look's picks, as the runtime reads them |
| `@automatos/look-kit/validate` | the one gate for a look from outside the code, checked against the theme's look spec |

`src/plain-line.ts` is core's `frontend/lib/text/plain-line.ts` byte for byte (the one other core file the runtime
reads, for `validate`'s one-line rule); `test/plain-line.test.ts` holds it to core's sha256.

## Bundling it

A theme names the package, at this version, under `dependencies` in its `package.json`
(`"@automatos/look-kit": "0.1.0"`) and imports its modules by name. The kit's vite-preset then bundles this folder's
`src/` with the theme's own (and nothing else of it), and `automatos-theme pack` writes it into the package as
`source/packages/look-kit/src/`, where the Marketplace review rebuilds it. The review has no `package.json` of this
package, so it sets no `sideEffects` and nothing else the build would read.

## Tests

`npm test` here. The tests moved here from Play's with the runtime: the 24 ground and accent pairs' AA proofs (Play's
variables and Studio's tokens, over the accent tints and the page glow), the rule that Studio's consequence tokens
never take the look's accent, and the validator's cases. They prove the runtime on Play's catalogue, presets and
stylesheet, the kit's reference theme, which they import from `themes/play` by path; the test-move ledger
(`themes/play/test/moved-from-core/lib.json`) names them.
