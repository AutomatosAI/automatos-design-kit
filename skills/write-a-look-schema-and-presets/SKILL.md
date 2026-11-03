---
name: write-a-look-schema-and-presets
description: Write an Automatos theme's look data - looks/schema.json with its choice and number knobs, the presets in looks/presets/, the first-paint table boot/prepaint.json with its tone rule, and design/contrast.json - and prove every preset readable with automatos-theme check design before any theme code exists. Use when designing or changing a theme's looks, knobs, presets, colours, tone or contrast, or when check design reports an error.
---

# Write a look schema and presets

A look is one set of values for a theme's knobs. The theme owns the knobs; the host keeps the looks, paints the active
one before any code runs and hands it to the theme. This skill writes that data and proves it readable, before the
look editor or any other code is written. The format, field by field, is [guides/looks.md](../../guides/looks.md).

## When to use

- A new theme, after its brief and before its code ([build-automatos-theme](../build-automatos-theme/SKILL.md), step 2).
- Adding a knob, a choice or a preset; changing a colour, a ground or the tone.
- `automatos-theme check design` or `automatos-theme check` reports a look, prepaint or contrast error.

## Steps

1. **List the knobs.** For each thing a person may change, one knob. A knob is a `choice` (a set of named options:
   grounds, accents, type pairs, on and off) or a `number` (a range painted as an alpha: a glow). There is no other
   kind. A size, such as a corner radius, is a choice of sizes.
   A colour the person picks is a choice of named colours, never a free value. At most 32 knobs, 64 choices each.
2. **Write `looks/schema.json`.** Schema `automatos-look-schema/v1`, a `look.schema` id for the theme's looks (such as
   `acme-harbour-look/v1`), an optional `look.interface`, and the knobs with their labels and defaults.
3. **Name the variables.** Every variable the theme paints starts with its own prefix (`--harbour-*`), never a Studio
   token's name by accident. Decide which of Studio's tokens the look paints too, so the host's own pages take the
   look: write those as `H S% L%` triplets ([looks.md](../../guides/looks.md), "Recolouring the host's pages").
4. **Write `boot/prepaint.json`.** For each choice knob, each choice's variables; a pair table for each variable that
   depends on two knobs, with a cell for every pair of choices; a numeric rule for each number knob; the `defaults`, a
   complete look. Every knob of the schema is painted here, or the host's looks leave it out and every look fails
   (`KNOB_NOT_PAINTED`). A value calls no gradient and no `color-mix()`: the browser's first paint drops it
   (`BAD_CSS_VALUE`), so paint colours and stops, and compose gradients in the theme's CSS. Under `"tone": "from-look"`, add the tone rule: the choice knob that sets
   light or dark (usually the ground) and the tone of each of its choices.
5. **Derive the text colours.** A colour that shows as text gets its own variable per ground, readable on that ground
   and on its surfaces; the raw colour stays for fills and icons. Do the same for the focus ring (3:1) and for every
   fixed colour (rings, glows, badges): each one comes from the look ([pitfalls.md](../../guides/pitfalls.md)).
6. **Write the presets.** One `looks/presets/<id>.look.json` per preset: `schema`, `interface` (when the schema has
   one), `id` (the file's name), `name`, `sub` and a value for every knob. Name the default in `theme.json` `look`.
   The host carries at most 12 presets of at most 4 KB each.
7. **Declare the pairs.** In `design/contrast.json`, every text-on-ground pair the theme draws, and every ring or icon
   on its ground with `"min": 3`. Declare Studio's pairs too when the look paints Studio's tokens (Play's file,
   `themes/play/design/contrast.json`, is a full list).
8. **Check.** Run `automatos-theme check design <theme folder>`. Fix the data, never the check: a pair under its
   minimum is fixed by a better derived colour, a preset that doesn't fit the table by the table or the preset. Each
   prepaint code, what it means and its fix, is in [First-paint refusals](../../docs/cli.md#first-paint-refusals).

Done when `check design` prints no error on any preset, every preset has the values its knobs accept, and the defaults
paint every variable the theme's CSS reads.

## In the theme's code

The look editor (`lookEditor@1`) and the style sheet (`styleSheet@1`) read the look through the SDK's `looks` area:
`useLook()` for the active look, its saved looks and their actions, and `saveLook`, `exportLook` and `importLook` for
the editor's buttons. Every look the theme hands in is checked against its schema first; a refusal comes back as
plain-word reasons to show. Never keep looks anywhere else: the host keeps them for the person, per workspace.

## Rules

- **Data, not code.** The first paint runs before any theme code: everything it needs is in the table, and a value is
  never a URL, a quote or markup.
- **Every preset readable.** AA on every ground the look can pick, not only the default.
- **Change a knob, change the version.** A knob removed or renamed changes the looks people have saved: raise the
  theme's version and say so in its `CHANGELOG.md`.
- **Verify by the check's output.** Never report a preset readable without having seen `check design` (or CI) pass on
  it.
