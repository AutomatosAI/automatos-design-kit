# Looks

A look is one set of values for a theme's knobs: its accent, its ground, its type, whatever the theme lets a person
change. The theme declares the knobs (`looks/schema.json`), ships presets (`looks/presets/`), says how a look paints
before any code runs (`boot/prepaint.json`), and draws its own look editor (`lookEditor@1`). The host keeps the looks,
paints the active one and hands it to the theme through the SDK's `looks` area. Core has no fixed field list: every
look is checked against the theme's own schema.

## `looks/schema.json`

```json
{
  "schema": "automatos-look-schema/v1",
  "look": { "schema": "acme-harbour-look/v1", "interface": "harbour" },
  "knobs": {
    "ground": { "kind": "choice", "label": "Ground", "choices": ["paper", "ink"], "default": "paper" },
    "accent": { "kind": "choice", "label": "Accent", "choices": ["blue", "green"], "default": "blue" },
    "corners": { "kind": "choice", "label": "Corners", "choices": ["square", "round"], "default": "round" },
    "glow": { "kind": "number", "label": "Glow", "min": 0, "max": 40, "integer": true, "default": 12 }
  }
}
```

- `look.schema` names the theme's look documents (a lower-case letter, then lower-case letters, digits, `.` and `-`,
  then `/v<n>`); `look.interface` is optional (a lower-case letter, then up to 31 lower-case letters, digits and
  dashes) and, when given, every look carries it too.
- `knobs`: 1 to 32 knobs. A knob's name is a lower-case letter, then up to 31 letters and digits, and is none of the
  look's own fields (`schema`, `interface`, `id`, `name`, `sub`).

A knob has one of two kinds:

| Kind | Fields | A look's value |
|---|---|---|
| `choice` | `kind`, `label` (optional, at most 40 characters), `choices` (1 to 64 different keys of lower-case letters, digits and dashes), `default` (one of the choices) | one of the choices |
| `number` | `kind`, `label` (optional), `min` and `max` (`min` below `max`, both within ±1,000,000), `integer` (optional, `true` or `false`), `default` | a number from `min` to `max`, whole when `integer` |

There is no other kind: a knob whose `kind` is anything else is refused (`BAD_KNOB`). A yes-or-no setting is a choice
knob with two choices, such as `on` and `off`. A colour is a choice knob whose choices name colours the prepaint
table paints, never a free value. Every knob is painted by the prepaint table (below): a number knob only by a
numeric rule, which paints an alpha, so a size such as a corner radius is a choice knob whose choices paint the sizes.

Each knob has one `default`, a value of its own: it can't depend on another knob ("scan lines as the palette has
them"). Where two knobs go together, the presets carry it: each preset sets every knob, so a palette's preset turns
its own scan lines on, and a person who changes the palette keeps the scan lines they chose.

## A look, and the presets

A look is `{schema, interface, id, name, sub, <every knob>}`:

```json
{ "schema": "acme-harbour-look/v1", "interface": "harbour", "id": "paper", "name": "Paper", "sub": "Blue on paper",
  "ground": "paper", "accent": "blue", "corners": "round", "glow": 12 }
```

- `id`: 1 to 64 letters, digits, dashes or underscores, starting with a letter or digit; `name`: plain text of 1 to
  40 characters; `sub`: the same, or empty.
- Every knob has a value the knob accepts, and nothing else is in the look (`LOOK_UNKNOWN_FIELD`,
  `LOOK_BAD_VALUE`, `LOOK_WRONG_SCHEMA`, `LOOK_BAD_ID`, `LOOK_BAD_TEXT`).
- A preset is a look in `looks/presets/<id>.look.json`, and its `id` is its file name (`PRESET_ID_MISMATCH`).
  `theme.json` `look` names the default one. The host's boot carries at most 12 presets of at most 4 KB each: the
  default first, then the rest in file-name order. A preset that fails the schema is dropped.
- Every theme has a look editor, so every package ships `looks/schema.json` (`MISSING_FILE` without it) and at least
  one preset (`NO_PRESET`).

## `boot/prepaint.json`: the first paint

Before React runs, the host's boot script paints the active look from this table onto `<html>`, as CSS custom
properties set one by one. No theme code runs at that moment, so the table is data:

```json
{
  "knobs": {
    "ground": { "paper": { "--harbour-bg": "#f4efe6", "--background": "39 39% 93%" },
                "ink":   { "--harbour-bg": "#14181c", "--background": "210 17% 9%" } },
    "accent": { "blue": { "--harbour-accent": "#2f6fed" }, "green": { "--harbour-accent": "#1f8a5b" } },
    "corners": { "square": { "--harbour-radius": "2px" }, "round": { "--harbour-radius": "14px" } }
  },
  "pairs": [ { "a": "accent", "b": "ground", "table": {
    "blue":  { "paper": { "--harbour-accent-text": "#1f4fb8" }, "ink": { "--harbour-accent-text": "#8fb0f7" } },
    "green": { "paper": { "--harbour-accent-text": "#17694a" }, "ink": { "--harbour-accent-text": "#6fd3a5" } } } } ],
  "numeric": [ { "var": "--harbour-glow", "knob": "glow", "min": 0, "max": 40, "integer": true, "scale": 100,
                 "capTable": null, "caps": null, "template": "rgba-alpha",
                 "color": { "knob": "accent", "rgb": { "blue": "47,111,237", "green": "31,138,91" } } } ],
  "defaults": { "ground": "paper", "accent": "blue", "corners": "round", "glow": 12 },
  "tone": { "knob": "ground", "values": { "paper": "light", "ink": "dark" } }
}
```

- `knobs`: for each choice knob, each choice's variables. `pairs`: variables that depend on two knobs at once,
  read as `table[look[a]][look[b]]` (an accent's text colour on each ground), so a pair table needs a cell for every
  pair of choices. Later entries overwrite earlier ones.
- `numeric`: a number knob painted as data, `rgba(<colour>, <value / scale>)`, optionally capped by a pair table
  (Play's glow). Every field is required: `var`, `knob`, `min`, `max`, `integer`, `scale`, `capTable`, `caps`,
  `color`, and `template` `"rgba-alpha"`; the host drops a rule that lacks one.
- **Every knob of the schema is painted here.** The host's look runtime builds a theme's looks from this table alone:
  a choice knob for each table under `knobs`, a number knob for each numeric rule's knob. A schema knob the table
  never paints is left out, so every look that has it fails, the presets included, and the look editor changes
  nothing. A knob the table paints that the schema doesn't declare fails every look the same way. Core's reader
  refuses both on upload, and so do `pack`, `check` and `check design` (`KNOB_NOT_PAINTED`, `KNOB_NOT_IN_SCHEMA`).
- `defaults`: the look painted when no valid look is stored. A look that does not fit the table (a choice the table
  lacks, a number out of range) is painted as the defaults, whole.
- `tone`: optional. One choice knob and the tone of each of its choices, so the host sets light or dark from the look
  alone under `"tone": "from-look"`. Every choice needs `light` or `dark` (`BAD_TONE_RULE`).
- Names are `--` and lower-case letters, digits and dashes. A value is numbers with units, `#` colours, identifiers
  and a few CSS functions: never a URL, a quote or markup (`BAD_PREPAINT`, `BAD_CSS_VALUE`). The file is at most
  256 KB.
- **The browser keeps less than the server's check takes.** Its first paint keeps a value of at most 200 characters
  of letters, digits, spaces and `# % . , ( ) / + -` (no `_`), calling only `rgb()`, `rgba()`, `hsl()`, `hsla()`,
  `var()` and the filters `hue-rotate()`, `saturate()`, `brightness()`, `grayscale()`, `contrast()`, `sepia()` and
  `invert()`. Any other value is dropped without a word, a gradient or `color-mix()` among them, and every value
  built on it with `var()` is invalid too: a card whose background was `var(--x-card-hi), …` comes out transparent.
  Core's reader refuses it on upload, and so do `pack`, `check` and `check design` (`BAD_CSS_VALUE`, naming the
  variable, the look it paints for and why). Paint
  a gradient's colours, stops and positions here, and draw the gradient in the theme's CSS from them.

### Recolouring the host's pages

The host's own pages read Studio's colour tokens (`--background`, `--foreground`, `--card`, `--primary`, `--accent`,
`--muted`, `--border`, `--ring` and the rest, [contract.md](contract.md) lists all 24) as `H S% L%` triplets inside
`hsl(…)`. A look that paints them as triplets recolours every page the theme leaves to the host; a token painted as
`#rrggbb` paints nothing there. Keep the theme's own variables under its own prefix ([pitfalls.md](pitfalls.md)).

## Check the design before the code

`automatos-theme check design <theme folder>` reads the schema, the presets and the prepaint table with core's own
validators and codes, paints every preset as the host's first paint paints it, and measures the colour pairs the theme
declares in `design/contrast.json`:

```json
{ "schema": "automatos-theme-contrast/v1",
  "pairs": [ { "text": "--harbour-accent-text", "ground": "--harbour-bg" },
             { "text": "--harbour-accent", "ground": "--harbour-bg", "min": 3 } ] }
```

`min` defaults to 4.5 (WCAG AA for text); use 3 for a focus ring or an icon. A pair under its minimum, or one a preset
can't paint, is an error naming the preset, both variables and the ratio. `design/` is the kit's own file: `pack`
never packs it and the server never reads it.

The prepaint line also fails on what the browser would leave out: a value its first paint drops, and a schema knob
the table never paints (both above). The browser harness paints only what the first paint keeps, so `automatos-theme
dev` and `shots` show what a person sees.

## In the theme's code

The `looks` area ([sdk.md](sdk.md)): `useLook()` gives the active look, the saved ones, whether they loaded and
persisted, the tone the look forces, and `setLook`, `deleteLook`, `renameLook`; `saveLook`, `listLooks`,
`exportLook` and `importLook` save, list, export as a `.look.json` file and import pasted text. Every look a theme
hands in is checked against its schema first, and a refusal comes back as plain-word reasons, never a throw. Outside
a look runtime `useLook()` answers `available: false`.

The theme's look editor is its `lookEditor@1` component at `/looks`, and its style sheet is `styleSheet@1` at
`/looks/style` (Play's shows its type, colours, components and Auto's states).
