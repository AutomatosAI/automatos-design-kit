# Fonts

`fonts` has three optional slots: `sans` (body and interface text), `serif` (headings) and `mono` (code, figures, labels). Each is either a font Studio ships or a woff2 file in the package. A slot left out keeps Studio's default.

```json
"fonts": {
  "sans": "Geist",
  "serif": "assets/fonts/serif-my-display.woff2",
  "mono": "Geist Mono"
}
```

## Studio's fonts

The faces Studio's `frontend/app/layout.tsx` loads: `Geist`, `Geist Mono` and `Newsreader` (`STUDIO_FONTS` in `lib/skins/format.ts`). Any slot may use any of them (Neon uses Geist for headings too). Nothing has to be packed.

## Your own font

- **woff2 only,** checked by the file's first bytes (`wOF2`), not its name. A `.ttf` or `.woff` renamed to `.woff2` is refused.
- **At most 400 KB** per file. Subset the face to the scripts you need if it is larger.
- **Path:** `assets/fonts/<name>.woff2`, letters, digits and `.`, `_` or `-` between them. The editor names dropped files `assets/fonts/<slot>-<name>.woff2`. Studio's draft validator (S-001) is stricter: `[A-Za-z0-9_-]{1,64}`, no dots before `.woff2`, so avoid dots in the name.
- **Licence:** you are shipping the file to everyone who installs the skin. Use a font whose licence allows embedding and redistribution (SIL Open Font Licence faces do), and say so in `licence` or `description`.
- A file in `assets/fonts/` that no slot names is refused ("no other files").

In the editor, each slot has a picker ("Studio's default", Geist, Geist Mono, Newsreader, your file) and a drop zone; the preview loads the file at once.

## How Studio applies them

A slot sets Studio's own font variable: `sans` → `--font-geist-sans`, `serif` → `--font-newsreader`, `mono` → `--font-geist-mono` (`lib/skins/css.ts`), so Studio's rules pick the face up with no other change. Studio loads a skin's font files itself, from the package (core decision K2: the FontFace API from object URLs, since an asset route needs a token a CSS `url()` can't send).

**The Studio base reads these variables; Classic mostly doesn't.** Studio's `.studio` rules set `font-family` from them (body, `h1`/`h2`/`.font-serif`, `code`/`.font-mono`), but Classic uses Tailwind's own stacks (system sans, Tiempos/Charter serif, JetBrains Mono: `frontend/tailwind.config.ts`), which name no variable. On a Classic skin, fonts reach only the few rules that read the variables directly. Pick `"base": "studio"` when type matters to the skin.
