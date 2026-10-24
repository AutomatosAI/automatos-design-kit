# HUD's display type

The display faces of HUD's type styles, shipped in the package and declared by `src/app/hud-fonts.css` as
`@font-face` rules (each family named `hud-…`). A browser downloads a face only when a look's type style uses it.

| File | Face | Family | Type style | Package | sha256 | Licence |
|---|---|---|---|---|---|---|
| `rajdhani-latin-700-normal.woff2` | Rajdhani 700 | `hud-rajdhani` | RAJDHANI (`raj`) | `@fontsource/rajdhani` 5.3.0 | `5b7e4a6f97163c2636724d4de90304fc895653dcfe64c67a7a22f26331ca5c5f` | [`LICENSE-rajdhani.txt`](LICENSE-rajdhani.txt) |
| `chakra-petch-latin-600-normal.woff2` | Chakra Petch 600 | `hud-chakra-petch` | CHAKRA (`chakra`) | `@fontsource/chakra-petch` 5.3.0 | `a5888696e9eb1b4bbbecc8eb3922b8369f49d4bddb72263e033cbd17f399be76` | [`LICENSE-chakra-petch.txt`](LICENSE-chakra-petch.txt) |
| `LICENSE-rajdhani.txt` | | | | `@fontsource/rajdhani` 5.3.0, its `LICENSE` | `078e327eb00525214cdce9780cfdf156141f137f1a095bec9798f470703d7d2d` | |
| `LICENSE-chakra-petch.txt` | | | | `@fontsource/chakra-petch` 5.3.0, its `LICENSE` | `8f32c96ea465c5916489845361238b31b365414228bc2e4e45e3ae98ba1d311a` | |

- **Source:** the latin subsets of the Fontsource packages named above, from the npm registry: each woff2 is the
  package's `files/<file>`, and each licence the package's `LICENSE`, copied byte for byte.
  `test/assets.test.ts` holds every file to its sha256 here.
- **Licence:** both families are under the SIL Open Font License 1.1; each licence file sits beside its font
  and travels with it in the package.
- **Geist and Geist Mono** (body text, labels, and the MONO type style) are not here: HUD reads the host's own
  `--font-geist-sans` and `--font-geist-mono`.
