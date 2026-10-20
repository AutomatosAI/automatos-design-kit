# Play's display type

The display faces of Play's type styles, shipped in the package and declared by `src/app/play-fonts.css` as
`@font-face` rules (each family named `play-…`). A browser downloads a face only when a look's type style uses it.

| File | Face | Family | Type style | Licence |
|---|---|---|---|---|
| `instrument-serif-latin-400-normal.woff2` | Instrument Serif 400 | `play-instrument-serif` | Editorial | [`LICENSE-instrument-serif.txt`](LICENSE-instrument-serif.txt) |
| `instrument-serif-latin-400-italic.woff2` | Instrument Serif 400 italic | `play-instrument-serif` | Editorial | [`LICENSE-instrument-serif.txt`](LICENSE-instrument-serif.txt) |
| `bricolage-grotesque-latin-700-normal.woff2` | Bricolage Grotesque 700 | `play-bricolage-grotesque` | Characterful | [`LICENSE-bricolage-grotesque.txt`](LICENSE-bricolage-grotesque.txt) |
| `fredoka-latin-600-normal.woff2` | Fredoka 600 | `play-fredoka` | Playful | [`LICENSE-fredoka.txt`](LICENSE-fredoka.txt) |

- **Source:** core's `frontend/app/fonts/play` (the latin subsets of the Fontsource packages for these families),
  copied byte for byte with their licence files at core commit `ebedc7eb8d7f7f9d032706728a7f420a9e833392`.
- **Licence:** all three families are under the SIL Open Font License 1.1; each licence file sits beside its fonts
  and travels with them in the package.
- **Geist and Geist Mono** (the Clean type style, and Play's body and mono text) are not here: Play reads the
  host's own `--font-geist-sans` and `--font-geist-mono`.
