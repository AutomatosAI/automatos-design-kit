# The host's type

The fonts core supplies to every page, so a theme in the harness draws its `var(--font-geist-sans)`,
`var(--font-geist-mono)` and `var(--font-newsreader)` text as core draws it, not in the browser's default face. Core
self-hosts them and loads them with `next/font/local` in `frontend/app/core-fonts.ts`, whose classes core's layout
puts on `<html>`. The harness's page (`app/index.html`) does the same: one `@font-face` per file below, with the
weight and style core declares, and one class on `<html>` per variable, under core's variable names. The family
names are the harness's own (`harness-geist-sans`, `harness-geist-mono`, `harness-newsreader`), as next/font
generates its own. The build emits each file under `harness/`, on the harness's origin.

## Faces

| File | Variable | Weight | Style | Licence |
|---|---|---|---|---|
| `geist-latin-wght-normal.woff2` | `--font-geist-sans` | `100 900` | `normal` | `LICENSE-geist.txt` |
| `geist-mono-latin-wght-normal.woff2` | `--font-geist-mono` | `100 900` | `normal` | `LICENSE-geist-mono.txt` |
| `newsreader-latin-400-normal.woff2` | `--font-newsreader` | `400` | `normal` | `LICENSE-newsreader.txt` |
| `newsreader-latin-400-italic.woff2` | `--font-newsreader` | `400` | `italic` | `LICENSE-newsreader.txt` |
| `newsreader-latin-500-normal.woff2` | `--font-newsreader` | `500` | `normal` | `LICENSE-newsreader.txt` |
| `newsreader-latin-500-italic.woff2` | `--font-newsreader` | `500` | `italic` | `LICENSE-newsreader.txt` |
| `newsreader-latin-600-normal.woff2` | `--font-newsreader` | `600` | `normal` | `LICENSE-newsreader.txt` |
| `newsreader-latin-600-italic.woff2` | `--font-newsreader` | `600` | `italic` | `LICENSE-newsreader.txt` |

## Files

| File | sha256 |
|---|---|
| `geist-latin-wght-normal.woff2` | `19f9c92546aa300c312235e3125af1b81394d8db9a4bc4a425cd5b641d2d54e1` |
| `geist-mono-latin-wght-normal.woff2` | `684ad5b531f81d43c1e8c7038262d5db7cdc1f68006e04d6c7769efa8d33c8cc` |
| `newsreader-latin-400-normal.woff2` | `e66067814f1c672d33a457e4f4d102c818b481420e2234cf685ebdbf2f443904` |
| `newsreader-latin-400-italic.woff2` | `fa9b900403949d9a723106752a5c8ad2797012a0c9057427b1da2db72d552148` |
| `newsreader-latin-500-normal.woff2` | `5613e2fc8377392c02e8ac9d55014689fb5320a5f2a7be55e8088a314728ac2c` |
| `newsreader-latin-500-italic.woff2` | `3d184d574e56fcb42f4c1920d4130db872ec0af6de9a0ad0f9e850444be44b7d` |
| `newsreader-latin-600-normal.woff2` | `05c91a26d19a61eafe7ce8e0b77eff3fd279ce994dc89f432f4cd06784935e84` |
| `newsreader-latin-600-italic.woff2` | `63ff324ab27c27c3ad19c6c61b2fbee3b74931ad9909dd051e8be7340133ceaa` |
| `LICENSE-geist.txt` | `71609cbb5c78b5870d712eab73a31d76622635c6ed034ab5cee3b9ecbda8685f` |
| `LICENSE-geist-mono.txt` | `cc815ed4fc045f0e991abb10395b7932bd028c6a067deb13316d6002105074e6` |
| `LICENSE-newsreader.txt` | `26028ec4e13b650065fa525a09532176f8a668b76ff849ea01c564a7480f91e7` |

- **Source:** core's `frontend/app/fonts/core` (the latin subsets of the Fontsource packages for these families),
  copied byte for byte with their licence files at core commit `b9d25e1b8a3bb8e9a5903203e5c98b0694a3e954`, with no
  edit; the faces are those core's `frontend/app/core-fonts.ts` declares at that commit. `test/host-fonts.test.ts`
  holds each file to its sha256 here.
- **Licence:** all three families are under the SIL Open Font License 1.1; each licence file sits beside its fonts.
- **Left out:** next/font also writes a fallback face for each family (the system's Arial, its metrics adjusted to
  the font's), which only shows until the font has loaded. The harness has none: the shots wait for the fonts
  (`document.fonts.ready`) before each shot.
