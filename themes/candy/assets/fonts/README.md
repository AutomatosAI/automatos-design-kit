# Candy's type

Candy's two faces, shipped in the package. The web's are declared by `src/app/theme.css` as `@font-face` rules (each
family named `candy-…`); the phone's are the `mobile` block's `serif` (titles) and `sans` (body and chat) in
`theme.json`, which takes TrueType files only, one file per role.

| File | Face | Use | Source | sha256 |
|---|---|---|---|---|
| `outfit-latin-600-normal.woff2` | Outfit 600 | web: titles, figures (`candy-outfit`) | `@fontsource/outfit` 5.3.0, `files/` | `8cfe15c2c6de6ef8efff3eedbd52a383ac9ef23d6c23f6cd9f9b838f5f37dc36` |
| `outfit-latin-700-normal.woff2` | Outfit 700 | web: the orb's figure (`candy-outfit`) | `@fontsource/outfit` 5.3.0, `files/` | `5d5e3734089a74707292ce8a3e186def34cd63e33879f9ac3689a8d8da9d0706` |
| `nunito-latin-400-normal.woff2` | Nunito 400 | web: running text (`candy-nunito`) | `@fontsource/nunito` 5.3.0, `files/` | `a5906e15ceb68f73d3b2c2076b4057c3f6ed401186d56283b45ce12944ca0735` |
| `nunito-latin-700-normal.woff2` | Nunito 700 | web: labels, list titles (`candy-nunito`) | `@fontsource/nunito` 5.3.0, `files/` | `fa89300b9bbb3bd0f60d6991aa055965d98e2ccca27bf8688fe0c39cdc796846` |
| `nunito-latin-800-normal.woff2` | Nunito 800 | web: buttons, card labels (`candy-nunito`) | `@fontsource/nunito` 5.3.0, `files/` | `2363d3ed037283ebb961e8c4b4917e40a8bc8853cf9965cf1ea7b4daa1df630a` |
| `mobile/candy-title.ttf` | Outfit SemiBold | phone: titles (`mobile.fonts.serif`) | Google Fonts, Outfit v15 600 static instance (`fonts.gstatic.com/s/outfit/v15/QGYyz_MVcBeNP4NjuGObqx1XmO1I4e6yC4E.ttf`) | `8900df5726b5a6f23e723594f11d5ea27e695bd85c884f18d88ed080544fe205` |
| `mobile/candy-body.ttf` | Nunito Regular | phone: body and chat (`mobile.fonts.sans`) | Google Fonts, Nunito v32 400 static instance (`fonts.gstatic.com/s/nunito/v32/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshRTM.ttf`) | `9ecbdba35fa74f10a1a916c31649b802a12deb9e66c7b1fe4650afcfd4d16971` |
| `LICENSE-outfit.txt` | | the licence of all three Outfit files | `@fontsource/outfit` 5.3.0, `LICENSE` | `0e5fcef5d93bfcae273c11c00f0bb453d3b5491860e1ac8b658767b7577c938f` |
| `LICENSE-nunito.txt` | | the licence of all four Nunito files | `@fontsource/nunito` 5.3.0, `LICENSE` | `40991bfa02ac620aae16dc527f3c47765a25e43f270d4c301ee6ab663a8d9015` |

- **Source:** the woff2 files and the licences are copied byte for byte from the Fontsource packages on the npm
  registry; the TrueType files are the static instances Google Fonts serves for one weight (the Google Fonts
  repository holds Outfit and Nunito as variable fonts only, and a phone draws a variable font at its default
  weight). Each family's licence there (`OFL.txt`) is the same text as Fontsource's `LICENSE`. `test/assets.test.ts`
  holds every file to its sha256 here.
- **Licence:** both families are under the SIL Open Font License 1.1; each licence file sits beside its fonts and
  travels with them in the package.
- **Not here:** Geist and Geist Mono, the host's own, which the host strip (the host's parts) uses.
