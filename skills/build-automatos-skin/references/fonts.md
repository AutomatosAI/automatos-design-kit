# Fonts

`fonts` has three optional slots: `sans` (body and interface text), `serif` (headings) and `mono` (code, figures, labels). Each is either the key of a font Studio ships or a woff2 file in the package. A slot left out keeps Studio's default.

```json
"fonts": {
  "sans": "geist",
  "serif": "assets/fonts/serif-my-display.woff2",
  "mono": "geist-mono"
}
```

## Studio's fonts

The faces Studio's `frontend/app/layout.tsx` loads, named by their keys: `geist` (Geist), `geist-mono` (Geist Mono) and `newsreader` (Newsreader) (`SHIPPED_FONTS` in `lib/skins/format.ts`, the core's S-001 list). The family name (`"Geist"`) is refused: use the key. Any slot may use any of them (Neon uses `geist` for headings too). Nothing has to be packed.

## Your own font

- **woff2 only,** checked by the file's first bytes (`wOF2`), not its name. A `.ttf` or `.woff` renamed to `.woff2` is refused.
- **At most 400 KB** per file. Subset the face to the scripts you need if it is larger.
- **Path:** `assets/fonts/<name>.woff2`, where the name is 1 to 64 letters, digits, `_` or `-` (`^assets/fonts/[A-Za-z0-9_-]{1,64}\.woff2$`, Studio's S-001 rule): no dots or spaces before `.woff2`. The editor names dropped files `assets/fonts/<slot>-<name>.woff2` with anything else turned into `-`.
- **Licence:** you are shipping the file to everyone who installs the skin. Use a font whose licence allows embedding and redistribution (SIL Open Font Licence faces do), and say so in `licence` or `description`.
- A file in `assets/fonts/` that no slot names is refused ("no other files").

In the editor, each slot has a picker ("Studio's default", Geist, Geist Mono, Newsreader, your file) and a drop zone; the preview registers the file at once, the way Studio does (below).

## How Studio applies them

A slot sets Studio's own font variable: `sans` → `--font-geist-sans`, `serif` → `--font-newsreader`, `mono` → `--font-geist-mono` (`lib/skins/css.ts`), so Studio's rules pick the face up with no other change. For your own file the variable names a family Studio makes, `skin-<id>-<slot>`, never your file's name.

The stylesheet never holds `@font-face` or `url()` (core decision K2): an asset route needs a token a CSS `url()` can't send, so Studio fetches the woff2 itself and registers it with the browser's **FontFace** API under that family (its `frontend/lib/skins/fonts.ts` hands FontFace the file's bytes). The kit's editor and preview do the same with the files kept in your browser (`lib/skins/font-faces.ts`). A face the browser refuses leaves the slot on its fallback stack.

**The Studio base reads these variables; Classic mostly doesn't.** Studio's `.studio` rules set `font-family` from them (body, `h1`/`h2`/`.font-serif`, `code`/`.font-mono`), but Classic uses Tailwind's own stacks (system sans, Tiempos/Charter serif, JetBrains Mono: `frontend/tailwind.config.ts`), which name no variable. On a Classic skin, fonts reach only the few rules that read the variables directly. Pick `"base": "studio"` when type matters to the skin.
