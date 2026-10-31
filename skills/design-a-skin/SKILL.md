---
name: design-a-skin
description: Give an Automatos theme a phone skin - theme.json's mobile block, the colours, font files and Auto's stills or clips that Automatos Go paints onto its own Studio layout - designed in the kit's phone view and skin designer, every contrast pair fixed, downloaded as skin.json, written with automatos-theme skin, then checked and packed. Use when a theme needs a phone look, when changing its mobile block, or when automatos-theme check reports a contrast error or automatos-theme skin refuses a block.
---

# Design a skin

A phone skin is a theme's look in Automatos Go: `theme.json`'s `mobile` block, data only. The app paints it onto a
layout of its own, and runs none of the theme's code. This skill is the order of work, from the harness's phone view
to a packed theme. The facts (every field, what the phone draws, the ten contrast pairs and their minimums) are in
[guides/mobile-skins.md](../../guides/mobile-skins.md).

## When to use

- A theme should look like itself on a phone, or its `mobile` block changes.
- `automatos-theme check` reports an error in its `contrast` line, or `automatos-theme skin` refuses a block.
- `automatos-theme pack` refuses the block: `BAD_MOBILE`, `MOBILE_CANNOT_PAINT`, or `MISSING_FILE` for a font or one
  of Auto's files.

Not for Play or HUD: Automatos Go draws both in its own built-in layouts and reads none of their block, and `skin`
refuses them. A skin paints the Studio layout alone; [guides/phone-layouts.md](../../guides/phone-layouts.md) maps every
layout and which theme gets each. Not for drawing or encoding Auto's files: that is [design-a-mascot](../design-a-mascot/SKILL.md). Not
for the web theme's looks: that is [write-a-look-schema-and-presets](../write-a-look-schema-and-presets/SKILL.md).

## Read first

1. [guides/mobile-skins.md](../../guides/mobile-skins.md): what a skin is and isn't, the block, what the phone draws,
   the contrast pairs and the workflow.
2. [guides/contract.md](../../guides/contract.md), "The `mobile` block": the block among the rest of `theme.json`.
3. The harness's sample skin,
   [`fixtures/phone-skin/theme.json`](../../packages/theme-harness/fixtures/phone-skin/theme.json): a whole block,
   Light in triplets and Dark in `#rrggbb`, every pair passing.

## Decide first: where the colours come from

- **`tokens`: the skin's own colours.** A Light scheme, and a Dark one if the phone should change with the member's
  Light / Dark (with Light alone, the phone draws Light under Dark too). Pick this when the theme has no looks, or
  when the phone should look one way whatever look the member picked.
- **`fromLooks`: the member's look.** The phone paints the look the member picked, through the theme's
  `boot/prepaint.json`, as the web's first paint does. Pick this when the looks already paint Studio's tokens as
  `H S% L%` triplets. Every preset is measured, and the table's defaults too, so every one must pass.

## Steps

1. **The theme can take a skin.** Its id is not `automatos/play`, `automatos/hud` or another of the `automatos`
   publisher's; `engines.automatos` admits no host below 1.1.0 (`^1.1.0`). Done when both hold.
2. **Open the phone view.** If `theme.json` names a default look, run the theme's own build once (it writes `looks/`).
   Run `automatos-theme dev <theme folder>`, open the address it prints, and follow **Phone view** (`/phone`). Done
   when the phone and the skin designer are on screen.
3. **Start a draft.** From `theme.json`'s block, from Studio's colours, or from one of the theme's looks. Set the
   source (`tokens` or `fromLooks`) and the schemes (Light alone, or Light and Dark).
4. **The colours.** Under `tokens`, set each token you want on the scheme on screen, then switch Light / Dark and do
   the other. Set both tokens of every pair you touch: the phone fills a token you leave out with Studio's colour, and
   the measure doesn't. Look at Chat, the Command Centre and First open in each scheme. Done when every screen reads
   as the theme in both schemes (or in every look, under `fromLooks`).
5. **The fonts** (optional). One `.ttf` or `.otf` face per role (`serif` for titles, `sans` for body and chat text,
   `mono` for labels and figures), at most 400 KB, in `assets/fonts/mobile/`; a font's licence file goes in
   `assets/fonts/`, as the web's do. The web's `.woff2` files don't fit: take the family's TrueType file from its own
   source (the Google Fonts repository has one for every family it serves), renamed to letters, digits, `.`, `_` and
   `-` ([guides/mobile-skins.md](../../guides/mobile-skins.md), "Where the phone's fonts come from"). `dev` lists
   `assets/` when it builds, so restart it to offer a file you just added. Pick each role's file in the designer.
6. **Auto** (optional). `none`, `stills` (each state's `.png`) or `clips` (each state's `.mp4` and `.png`), for every
   state of the top-level `mascot.states`. The designer lists each file the mode needs and whether the theme has it.
   The phone shows Auto on First open.
7. **Fix every pair.** The contrast panel marks each failing pair; take its nearest passing colour in one click, or
   pick your own and watch the ratio. Check the panel in Light and in Dark (each preset, under `fromLooks`). Done
   when the panel's outcome is pass and the export offers **Download skin.json**. Until then it lists every reason
   the command would give: fix each.
8. **Write it.** Download `skin.json`, keep it outside the folders `pack` packs (`dist/`, `boot/`, `looks/`,
   `assets/`), and run `automatos-theme skin <theme folder> --from skin.json`. Done when it says the block is written;
   a refusal writes nothing and prints every reason, with the nearest passing value for each failing pair.
9. **See theme.json's block.** Restart `dev` (it builds again only after a change under `src/`), open the phone view
   and pick **Start from theme.json's block**: the phone now shows the block as `theme.json` has it. Done when it
   looks as the draft did.
10. **Check and pack.** Build the theme, then run `automatos-theme check <theme folder>` and
    `automatos-theme pack <theme folder>`. Done when the `contrast` line passes with no error, and `pack` writes the
    package. A changed `theme.json` changes the package: before submitting, raise the theme's version and say what
    changed in its `CHANGELOG.md`.

## Rules

- **Data only.** A skin is colours, font files and Auto's files. Nothing in the theme's code or CSS reaches the phone.
- **Every pair at its minimum**, in every scheme or preset the phone can be served: 4.5:1 for text, 3:1 for the
  primary colour and the focus ring on the ground. Fix the colour, never the check.
- **Files from the package only.** Every font and every one of Auto's files is the theme's own, in the folders the
  guide names.
- **The designer and `skin` agree on the block.** The designer runs `skin`'s own checks of the block before it offers
  `skin.json`; `skin` alone also refuses Play's and HUD's folders and the `automatos` publisher. Don't hand-edit the
  block around a refusal: fix what it names.
- **Verify by the output.** Never report a skin as passing without having seen `check` (or CI) pass it, or as
  looking right without having seen it in the phone view, in both schemes.
