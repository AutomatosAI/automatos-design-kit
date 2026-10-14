# Looks: the format, for designers

A **Look** is how the kit (formerly Automatos Play) looks: the background, the accent, the display type, Auto's shell and light, and how strongly the page glows. The Look editor ("Make it yours.", `components/looks/LooksScreen.tsx`) picks and edits one, and the whole app changes at once; since PRD-004 K-004 the kit's `/` is the skin editor instead, so the Look editor is no longer on a page and the kit keeps the Look stored in the browser (Ember by default). The live style sheet (`/style`) shows exactly what the active Look produces, with the numbers.

This file is the reference for the format (`automatos-interface-look/v1`). The code is the source of truth, and every value below comes from it:

| What | Where |
|---|---|
| The catalogue | `lib/looks/catalogue.ts` |
| The format | `lib/looks/types.ts` |
| The five presets | `lib/looks/presets.ts` |
| The validator | `lib/looks/validate.ts` |
| Contrast maths and derived text colours | `lib/looks/contrast.ts` |
| A Look as CSS variables | `lib/looks/css.ts` |
| Export and import | `lib/looks/transfer.ts` |
| Storage in the browser | `lib/looks/storage.ts` |

The spec is `docs/prd/PRD-002-LOOKS-POC.md`. The designs are in `docs/design/ember/` (the Looks prototype is `Automatos Play Looks.dc.html`).

## A Look is data, not code

A Look holds **catalogue keys** and one number. It never holds a colour, a font name, CSS or a URL. `"accent": "molten"` means "the catalogue's Molten", and the catalogue says what Molten is.

Why keys and not raw colours:

- **Safe to share.** A Look can't carry CSS, so it can't inject styles, load a remote font or image, track who opens it, or hide content. The worst a Look can do is pick an ugly pairing from the catalogue.
- **Always readable.** Every pairing in the catalogue is checked for contrast by tests (see [The contrast guarantee](#the-contrast-guarantee)). A Look made of keys can only produce pairs that were checked. A free colour picker couldn't promise that.
- **Small and checkable.** A Look is about 300 bytes. Checking one is a mechanical job: every field against a fixed list. A reviewer reads it in seconds.
- **Better over time.** When the catalogue improves (a better ink for an accent, a better filter for a shell), every Look that names that entry improves with it.

Free colour pickers are a non-goal for now (PRD-002, section 5): they would need a computed ink and a live AA check for every colour.

## The catalogue

The Ember catalogue, copied exactly from the Looks prototype. A Look names one entry from each of the five sections.

### Grounds (`ground`)

The page and everything on it. `line`, `chip` and `panel` are translucent layers over the bg.

| Key | Name | bg | surface | text | text2 | line | chip | panel |
|---|---|---|---|---|---|---|---|---|
| `graphite` | Graphite | `#131110` | `#1D1917` | `#F4EEE8` | `#B7ADA4` | `rgba(244,238,232,.12)` | `rgba(244,238,232,.06)` | `rgba(244,238,232,.025)` |
| `obsidian` | Obsidian | `#0B0B0C` | `#151517` | `#EDEDED` | `#A1A1A6` | `rgba(255,255,255,.1)` | `rgba(255,255,255,.06)` | `rgba(255,255,255,.02)` |
| `indigo` | Night | `#120F2A` | `#1B1740` | `#F3F0FF` | `#B9B3DA` | `rgba(180,170,255,.16)` | `rgba(180,170,255,.08)` | `rgba(180,170,255,.03)` |
| `paper` | Paper | `#F4EEE8` | `#FFFFFF` | `#1F1A17` | `#6B635C` | `rgba(31,26,23,.14)` | `rgba(31,26,23,.06)` | `rgba(255,255,255,.5)` |

The key `indigo` shows as "Night". Keys are stable identifiers; names are what people see and may change.

### Accents (`accent`)

The one primary action per screen, rings when Auto is busy, icons, selected edges, the page glow. Each accent has its own **ink**: the text colour on a button filled with the accent.

| Key | Name | hex | ink | ink on accent |
|---|---|---|---|---|
| `molten` | Molten | `#FF6A1F` | `#1A0A02` | 6.74:1 |
| `cream` | Cream | `#EDE6DE` | `#131110` | 15.22:1 |
| `mint` | Mint | `#4BF0B7` | `#04140E` | 13.00:1 |
| `gold` | Gold | `#F2C14E` | `#1E1600` | 10.70:1 |
| `periwinkle` | Periwinkle | `#8C9BFF` | `#0A0D2A` | 7.47:1 |
| `rose` | Rose | `#FF5C8A` | `#2A0512` | 6.33:1 |

### Type styles (`font`)

The **display** type only: the big headings, Auto's caption, card titles and the brand. Reading text is Geist and code is Geist Mono in every Look. All fonts are self-hosted through `@fontsource` packages.

| Key | Name | Family | Style | Weight | Letter-spacing | Hero | Brand | Status | Card |
|---|---|---|---|---|---|---|---|---|---|
| `serif` | Editorial | Instrument Serif | italic | 400 | 0 | 72px | 28px | 40px | 22px |
| `clean` | Clean | Geist | normal | 600 | -0.03em | 58px | 18px | 30px | 17px |
| `bric` | Characterful | Bricolage Grotesque | normal | 700 | -0.02em | 58px | 18px | 30px | 17px |
| `round` | Playful | Fredoka | normal | 600 | 0 | 58px | 20px | 30px | 17px |

The Ember rule: Instrument Serif (Editorial) is never set below 19px; its smallest display size is 22px. `tests/looks/ember.test.ts` checks the CSS.

### Auto's shell (`shell`)

The colour of Auto's body. There is one set of mascot renders (bronze), so the shell is a **CSS filter** on Auto's video and still. New renders per shell are a non-goal for now.

| Key | Name | hex (for swatches) | Filter on the mascot |
|---|---|---|---|
| `bronze` | Bronze | `#C8692A` | `none` |
| `gold` | Gold | `#D9A441` | `hue-rotate(18deg) saturate(1.2) brightness(1.1)` |
| `silver` | Silver | `#B9BDC4` | `grayscale(1) brightness(1.25)` |
| `cobalt` | Cobalt | `#3D6FD6` | `hue-rotate(195deg) saturate(1.1)` |

### Auto's light (`light`)

Auto's eyes, his ring when he is calm, and the "connected" dot. Nothing else (the Ember rule; `tests/mascot/ring.test.ts` fails if the light is used anywhere else).

| Key | Name | hex |
|---|---|---|
| `mint` | Mint | `#4BF0B7` |
| `amber` | Amber | `#FFC24B` |
| `ice` | Ice | `#9FD8FF` |
| `rose` | Rose | `#FF8FB1` |

### Glow (`glow`)

A whole number from 0 to 40: the page glow behind Auto, as the accent at `glow / 100` alpha. 0 turns it off ("Off" on the slider). The glow follows Auto's state: the accent when he is busy or done, coral on a snag, off while he sleeps.

### Fixed: the error colour

Errors are coral `#FF6B6B` in every Look. A Look can't change it, so an error always looks like an error. It is always paired with a ✕ and words, never colour alone.

## The format

A Look is a JSON object with exactly these eleven fields, in this order:

| Field | Type | Rule |
|---|---|---|
| `schema` | string | Exactly `"automatos-interface-look/v1"`. |
| `id` | string | 1 to 64 letters, digits, dashes or underscores, starting with a letter or digit. |
| `name` | string | Plain text, one line, 1 to 40 characters after trimming. |
| `sub` | string | Plain text, one line, 0 to 40 characters after trimming. The short line under the name. |
| `interface` | string | Exactly `"play"`. Another interface has its own catalogue (see [Command](#commands-looksjson-and-v1)). |
| `ground` | string | A key of the grounds: `graphite`, `obsidian`, `indigo`, `paper`. |
| `accent` | string | A key of the accents: `molten`, `cream`, `mint`, `gold`, `periwinkle`, `rose`. |
| `font` | string | A key of the type styles: `serif`, `clean`, `bric`, `round`. |
| `shell` | string | A key of the shells: `bronze`, `gold`, `silver`, `cobalt`. |
| `light` | string | A key of the lights: `mint`, `amber`, `ice`, `rose`. |
| `glow` | number | A whole number from 0 to 40. |

Ember, the default Look, as Export writes it (`Ember.look.json`):

```json
{
  "schema": "automatos-interface-look/v1",
  "id": "ember",
  "name": "Ember",
  "sub": "Warm, editorial",
  "interface": "play",
  "ground": "graphite",
  "accent": "molten",
  "font": "serif",
  "shell": "bronze",
  "light": "mint",
  "glow": 24
}
```

### The presets

| id | Name | sub | ground | accent | font | shell | light | glow |
|---|---|---|---|---|---|---|---|---|
| `ember` | Ember (default) | Warm, editorial | graphite | molten | serif | bronze | mint | 24 |
| `obsidian` | Obsidian | Mono, minimal | obsidian | cream | clean | bronze | mint | 6 |
| `aurora` | Aurora | Cool and glassy | obsidian | mint | bric | bronze | ice | 20 |
| `workshop` | Workshop | The original | indigo | molten | round | bronze | mint | 14 |
| `daylight` | Daylight | For daytime | paper | molten | serif | bronze | mint | 10 |

Presets live in the code and can't be renamed or deleted, only duplicated. Saved Looks get ids `look-1`, `look-2` and so on. "Save as new look" names them "My look N", Duplicate "<name> copy" (then "copy 2" and so on), and an import keeps the name in its file.

## Validation

`validateLook(input)` in `lib/looks/validate.ts` is the one gate for any Look from outside the code. It is pure and returns `{ ok: true, look }` or `{ ok: false, errors }`. It rejects:

- anything that isn't a JSON object (an array, a string, `null`);
- **any field not in the table above** (`"isn't part of a Look. Remove it."`), including a raw `"color"` or `"css"`;
- a `schema` other than `automatos-interface-look/v1`;
- an `interface` other than `play`;
- an `id` that breaks the id rule;
- a `name` that is empty, over 40 characters, or holds a line break or other control character; the same for `sub`, which may be empty;
- a `ground`, `accent`, `font`, `shell` or `light` that isn't one of the catalogue's own keys (inherited names such as `toString` or `__proto__` are not keys);
- a `glow` that isn't a whole number from 0 to 40 (`24.5`, `"24"`, `41` and `-1` all fail).

It reports every problem at once, as plain sentences a designer can act on, for example `"accent" must be one of the catalogue's accents: molten, cream, mint, gold, periwinkle, rose.` It never echoes more than 40 characters of the input back. Only the known fields are kept, and `name` and `sub` are trimmed.

Where it runs:

| When | What happens to a Look that fails |
|---|---|
| Reading the active Look and the saved Looks from `localStorage` | Skipped with a console warning. A bad active Look means Ember. |
| Import (pasted JSON or a chosen `.json` file) | The errors show under Import, nothing is added. A file or paste of 1 MB or more is refused before it is read or parsed. A valid import gets a fresh id, so it never replaces a Look you have. |
| Save as new look, Rename, Duplicate | The errors show, nothing changes. |
| The pre-paint script in `<head>` | It checks the five keys against the catalogue and the glow range, and falls back to Ember. |

Imported names are only ever shown as text, never as HTML.

### Where Looks are kept

Per browser, in `localStorage`:

| Key | Holds |
|---|---|
| `automatos-play.looks` | The saved Looks, a JSON array of Look objects. |
| `automatos-play.look` | The active Look, the whole object (id plus values), so an edit you haven't saved survives a reload. |

When storage is blocked or full, Play runs in Ember and nothing is kept. Nothing about Looks is sent to Automatos: this needs no change in the core.

## From a Look to the page

`lookToCssVars(look)` in `lib/looks/css.ts` turns a Look into CSS custom properties on `<html>`. `app/theme.css` maps every colour and display-type token to these, so no component holds a colour of its own (`tests/looks/no-literal-colours.test.ts` checks it). Changing the Look changes the variables, and the whole app follows without a reload. Before first paint, a small inline script in `<head>` sets the same variables from the stored Look, so the page never flashes the wrong colours.

| Variable | From |
|---|---|
| `--ground-bg`, `-surface`, `-text`, `-text-2`, `-line`, `-chip`, `-panel` | The ground. |
| `--accent`, `--accent-ink` | The accent's hex and ink. |
| `--accent-line`, `--accent-fill` | The accent at 45% and 12% alpha. |
| `--accent-text` | The accent as text: see below. |
| `--error`, `--error-text` | `#FF6B6B`, and the error as text on this ground. |
| `--glow` | The accent at `glow / 100` alpha. |
| `--display-family`, `-style`, `-weight`, `-tracking`, `-hero`, `-brand`, `-status`, `-card` | The type style. |
| `--auto-shell`, `--auto-shell-filter` | The shell's hex and filter. |
| `--auto-light` | The light. |
| `--auto-dusk` | Auto's ring while he sleeps or is lost: the ground's text2 mixed 55% toward its bg. |
| `--sheet-bg`, `--sheet-text`, `--sheet-accent` | A Deliverable's page: on a dark ground a sheet in the ground's text colour with its bg as ink, on a light ground the ground's surface. |

Auto's ring takes the light when he is calm (hello, idle, listening, celebrate), the accent when he is busy (thinking, working, searching, reading), the error for oops, dusk for sleeping and lost, and text2 while loading.

## The contrast guarantee

Every Look made from the catalogue passes **WCAG AA (4.5:1)** for reading text, in all 24 ground × accent pairs. `tests/looks/contrast.test.ts` proves it on every CI run:

- text and text2 on the bg and on the surface;
- each accent's ink on the accent;
- the derived accent text and error text on the bg and on the surface;
- the Deliverable sheet's text and accent (`tests/looks/css.test.ts`).

The lowest pair is text2 on Paper, 5.12:1. The text pairs per ground:

| Ground | text / bg | text2 / bg | text / surface | text2 / surface |
|---|---|---|---|---|
| Graphite | 16.36:1 | 8.54:1 | 15.16:1 | 7.91:1 |
| Obsidian | 16.80:1 | 7.65:1 | 15.58:1 | 7.09:1 |
| Night | 16.60:1 | 9.33:1 | 15.06:1 | 8.46:1 |
| Paper | 14.97:1 | 5.12:1 | 17.24:1 | 5.89:1 |

### Derived text colours

The raw accents and the error coral are fine as fills, rings and icons on every ground, and fine as text on the three dark grounds. **As text on Paper they fail**: molten is 2.49:1 on `#F4EEE8`, cream 1.07:1, mint 1.26:1, and error coral 2.41:1.

So text in the accent or error colour never uses the raw colour. It uses `--accent-text` and `--error-text`, made by `readableOn(colour, bg, surface, text)` in `lib/looks/contrast.ts`:

1. If the colour reads at **4.8:1** or more on both the bg and the surface, use it as it is. (4.8, a little above AA, so rounding never lands a colour just under 4.5.)
2. Otherwise mix it toward the ground's text colour in 2% steps until it does.

On the dark grounds every accent and the error read as they are, so the text colour equals the raw colour. On Paper:

| Raw | Raw on Paper | Text colour on Paper | On bg / on surface |
|---|---|---|---|
| Molten `#FF6A1F` | 2.49:1 | `#AA4C1C` | 4.85:1 / 5.59:1 |
| Cream `#EDE6DE` | 1.07:1 | `#69635F` | 5.14:1 / 5.91:1 |
| Mint `#4BF0B7` | 1.26:1 | `#31745A` | 4.83:1 / 5.56:1 |
| Gold `#F2C14E` | 1.46:1 | `#7C632F` | 4.95:1 / 5.70:1 |
| Periwinkle `#8C9BFF` | 2.21:1 | `#5C6299` | 4.98:1 / 5.73:1 |
| Rose `#FF5C8A` | 2.55:1 | `#AE4461` | 4.80:1 / 5.53:1 |
| Error `#FF6B6B` | 2.41:1 | `#A54B49` | at least 4.8:1 |

The focus outline uses `--accent-text` too, so it shows on every ground. The style page marks a derived colour "darkened for reading on Paper". The Ember mocks put raw accent text on the page; that gap is logged in `docs/SKILL-GAPS.md` under "Design gaps".

## The style page

`/style` computes everything from the **active** Look and redraws when it changes (`lib/looks/style.ts`):

- **Colour:** a swatch for every colour variable, with its hex and role, and the live contrast table: `text / bg`, `text-2 / bg`, `text / surface`, `text-2 / surface`, `ink / <accent>`, `accent text / bg` and `error text / bg`, each with a "✓ AA pass" or "✕ AA fail" badge. Under Ember: 16.36:1, 8.54:1, 15.16:1, 7.91:1, 6.74:1, 6.57:1 and 6.78:1.
- **Type:** the display specimens at the Look's own sizes, then reply, body, button, label and mono.
- **Spacing and radii:** the 4px scale and the five radii (6 paper, 8 tool line, 10 button, 14 card, pill).
- **Components:** buttons, chips, tool lines, the receipts box, a Deliverable card, the message box, and Auto's 12 states with the ring colour each takes.
- **Motion:** the motion notes, with a toggle that plays them (off under reduced motion).
- **Copy tokens** copies the active Look's variables as a `:root { … }` block.

## Command's `looks.json` and v1

Command (`docs/design/command/`) is the HUD-style interface. It is not built; this section only says how its Looks would fit the same format.

`docs/design/command/looks.json` is a draft (`automatos-interface-look/v0`) that puts the catalogue, the presets and the fixed colours in one file. In v1 these split the same way they do in Play:

| v0 (`looks.json`) | v1 |
|---|---|
| `options.accent`, `options.ground`, `options.font` | A Command catalogue in code (say `lib/looks/command/catalogue.ts`), with its own keys: accents `arc`, `forge`, `ghost`, `nova`, `signal`, `gold`; grounds `void`, `carbon`, `navy`, `ember`; fonts `raj`, `chakra`, `mono` (with `titlePx` and `labelPx` in place of Play's sizes). |
| `fixed` (text, text2, line, track, error, body and mono fonts) | Stays fixed in the Command catalogue, like Play's error colour. Command grounds have only a bg, because the text colours are fixed. |
| `options.grid`, `options.glow`, `options.scan`, `options.auto`, `options.motion` | Extra fields on a Command Look (below). |
| `presets[]` | Command's presets in code, each a v1 Look. |
| `default` | The default preset in code, not in the file. |
| `$schema` | `schema`, now `automatos-interface-look/v1`. |

A Command Look in v1 has the same header (`schema`, `id`, `name`, `sub`, `interface`), `"interface": "command"`, and its own field set:

| Field | Rule |
|---|---|
| `ground`, `accent`, `font` | Keys of the Command catalogue. |
| `glow` | Whole number 0 to 40 (accent at `glow / 100`, as in Play). |
| `grid` | Whole number 0 to 30: the grid lines, accent at `grid / 300` alpha. |
| `scan` | Boolean: scanlines on or off. |
| `auto` | Boolean: show Auto inside the voice core. |
| `motion` | Boolean: `false` stops every loop. Reduced motion forces `false` whatever the Look says. |

Command has no `shell` or `light`: Auto is a yes or no there. Its presets have no sub line, so `sub` is `""`. The ARC preset:

```json
{
  "schema": "automatos-interface-look/v1",
  "id": "arc",
  "name": "ARC",
  "sub": "",
  "interface": "command",
  "ground": "void",
  "accent": "arc",
  "font": "raj",
  "grid": 14,
  "glow": 22,
  "scan": true,
  "auto": true,
  "motion": true
}
```

What this means for the code when Command is built:

- `interface` picks the catalogue and the field set. The validator becomes one check of the header, then the interface's own field check. Play's validator rejects a Command Look today ("This Look is for another interface"), which is the right answer for Play.
- Keys belong to their interface's catalogue. Command's `ember` ground and `gold` accent have nothing to do with Play's Ember preset or Gold accent.
- The same contrast tests apply: Command's fixed text and text2 on each of its grounds, and each accent's ink on its accent.
- Command keeps its own storage keys (`automatos-command.looks`, `automatos-command.look`).

## Marketplace notes, for the later core PRD

Publishing and installing Looks through the Marketplace is a change in `automatos-ai`, so it is out of scope here. Notes for that PRD:

- **A Look is data only.** No code, no CSS, no URLs, no images: a few hundred bytes of JSON naming catalogue keys. It needs no sandbox and no permissions, unlike a full interface.
- **Review is mechanical.** The validator says whether a Look is acceptable. The only human review is the words in `name` and `sub` (40 characters each, plain text).
- **The install is "validate, then add to saved Looks".** The same path as Import today (`importLook` in `lib/looks/transfer.ts`): run `validateLook`, give it a fresh id, add it to the saved Looks, and select it. Installing never replaces a Look the user has.
- **A thumbnail is rendered from the catalogue**, the way the Looks row draws its mini cards: the ground's bg and surface, the accent, the type style's name in its own font, and dots for the shell and light. No uploaded images to store or moderate.
- **The core needs the same validator.** The Marketplace must reject at publish time what Play rejects at install time, so the catalogue keys and rules for each interface need one source both sides read (or a Python port tested against the same cases).
- **Versioning.** `schema` carries the format version and `interface` the catalogue. Adding a catalogue entry is safe for old Looks; renaming or removing a key breaks every Look that names it, so keys are never removed, only retired from the editor.
- **Filtering.** The Marketplace lists a Look under its `interface`: a Play Look is no use in Command.
