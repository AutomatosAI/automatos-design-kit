# Arcade's type

Arcade's two pixel faces, shipped in the package. The web's are declared by `src/app/theme.css` as `@font-face`
rules (each family named `arcade-…`); the phone's are the `mobile` block's `serif` (titles) and `sans` (body and chat)
in `theme.json`, which takes TrueType files only, one file per role.

| File | Face | Use | Source | sha256 |
|---|---|---|---|---|
| `press-start-2p-latin-400-normal.woff2` | Press Start 2P 400 | web: headings, labels, counters, buttons (`arcade-press-start`) | `@fontsource/press-start-2p` 5.3.0, `files/` | `afec86997fdaf54af1f59358fa2c1e2a0f1d04146edad18e5cd141d0384a7548` |
| `pixelify-sans-latin-400-normal.woff2` | Pixelify Sans 400 | web: running text (`arcade-pixelify`) | `@fontsource/pixelify-sans` 5.3.0, `files/` | `d830612ac9131788ebae754b9268f83f7c1d3ffa9bc0f9a5514207a8283fe71e` |
| `pixelify-sans-latin-600-normal.woff2` | Pixelify Sans 600 | web: bold running text (`arcade-pixelify`) | `@fontsource/pixelify-sans` 5.3.0, `files/` | `9ee47c039a991caea6072eecfe03cf36debf4f70bb2566bd602b9eada1ab1112` |
| `mobile/press-start-2p-regular.ttf` | Press Start 2P | phone: titles (`mobile.fonts.serif`) | `google/fonts`, `ofl/pressstart2p/PressStart2P-Regular.ttf` | `034c77f1f05ec89421e4a63f0e3a4ca1ecf852cc6d2bf611f126f275728e017d` |
| `mobile/pixelify-sans-wght.ttf` | Pixelify Sans (variable weight) | phone: body and chat (`mobile.fonts.sans`) | `google/fonts`, `ofl/pixelifysans/PixelifySans[wght].ttf` | `9ba86cd010a4de309d263ceff8e8044092c9db7efda869620cb9ff1c4389e8a5` |
| `LICENSE-press-start-2p.txt` | | the licence of both Press Start 2P files | `@fontsource/press-start-2p` 5.3.0, `LICENSE` | `98e451fe911e5ee4a1a45359535dc30ea7df28b8d9a9cd1f741778efab1387ee` |
| `LICENSE-pixelify-sans.txt` | | the licence of all three Pixelify Sans files | `@fontsource/pixelify-sans` 5.3.0, `LICENSE` | `8ed5cd9e189e30dfdb0df2d5c2771556b50e9d502d899221328c3245caf8423c` |

- **Source:** the woff2 files and the licences are copied byte for byte from the Fontsource packages on the npm
  registry; the TrueType files from the Google Fonts repository (`google/fonts`, main). Each family's licence there
  (`OFL.txt`) is the same text as Fontsource's `LICENSE` but for whitespace. `test/assets.test.ts` holds every file
  to its sha256 here.
- **Licence:** both families are under the SIL Open Font License 1.1; each licence file sits beside its fonts and
  travels with them in the package.
- **Not here:** Geist and Geist Mono, the host's own, which the host strip (the message box) and code in replies use.
