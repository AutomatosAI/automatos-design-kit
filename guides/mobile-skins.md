# Phone skins

A phone skin is how a theme looks in Automatos Go, the Automatos phone app: the optional `mobile` block of its
`theme.json`. It is data and nothing else: colours, font files and Auto's clips or stills. The app paints it onto a
layout built into the app, because an app store allows no downloaded code: the phone never loads `dist/entry.js` or
`dist/theme.css`, and the server never gives it the address of a JS or CSS file.

This guide is the block field by field as the kit's vendored validator takes it
(`packages/theme-cli/src/core/mobile-manifest.ts`, core's own TypeScript twin at the commit
[its README](../packages/theme-cli/src/core/README.md) names), what a phone draws from it, the contrast it must pass,
and the work from the harness's skin designer to a packed theme. [contract.md](contract.md) has the block's summary
among the rest of `theme.json`. When this guide and core disagree, core wins and this guide is fixed.

## What a skin is, and isn't

- **It is** colours for Studio's colour tokens, for Light and optionally Dark (`tokens`), or the theme's own looks
  painted for the phone (`fromLooks`); a font file for any of three roles; and which of Auto's files the phone shows.
- **It is not** code, CSS, a layout or a page. The phone's screens are the app's own Studio layout, the same for every
  theme with a skin: a skin recolours it, sets its type and swaps Auto's pictures. It can't move, add or hide anything.
- **Automatos's own themes read none of it** where the app has their layout: `automatos/play`, `automatos/hud` and
  `automatos/arcade` switch the phone to its built-in Play, HUD or Arcade layout, painted from the member's looks
  (below, "The phone's layouts"). `automatos-theme skin` refuses a theme of the `automatos` publisher, and the harness
  offers no skin designer for one.
- **A theme with no skin** (no block, or a block that paints no ground and text) is not offered on the phone, which
  draws Studio's own colours instead.

## The phone's layouts

Every screen in Automatos Go is drawn by one of four layouts built into the app. A theme can't add a layout or change
one: the app downloads no code, so a layout ships only in an app release, through the App Store's review.

| Layout | What it draws | Which theme gets it |
|---|---|---|
| Studio | The app's own screens: the chat thread with Auto's replies and the host's cards, the Command Centre, Settings | Every theme not named below, through its skin: the skin recolours Studio, sets its type and swaps Auto's pictures |
| Play | Play's companion: Auto on a stage over the chat, with conversations and a shelf of Deliverables | `automatos/play` |
| HUD | HUD's command deck: Auto in the voice core, the transcript, square bracketed panels, a grid and scan lines | `automatos/hud` |
| Arcade | Arcade's 16-bit game: Auto as a pixel sprite in a dialogue box, the story, pixel faces and windows | `automatos/arcade` |

What that means for a theme of your own:

- **The phone draws your theme on the Studio layout**, whatever your web theme's layout is. Design the phone as a skin:
  your colours, up to three fonts and Auto's stills or clips on Studio's screens. The harness's phone view shows it.
- **A layout is matched by theme id**, from a fixed list in the app. A package can't name a layout, and a theme that
  copies Play's, HUD's or Arcade's look on the web still gets Studio on the phone.
- **A new layout needs an app release.** If your design needs a phone layout of its own, describe it (each screen, and
  the host data it shows) and propose it to Automatos in an issue on this repository. Until an app release carries it,
  your theme's skin on Studio is what members see.
- **Older app versions fall back to the skin.** An app version from before a layout existed paints that theme's
  `mobile` block on the Studio layout instead, which is why Play, HUD and Arcade each keep one.

The harness's phone view and `automatos-theme skin` follow the app's list at the Automatos Go commit
[the theme CLI's README](../packages/theme-cli/README.md) names, so they learn a new layout when the kit moves to an app
release that has it.

## The block

```jsonc
"mobile": {
  "tokens": {
    "light": { "--background": "40 33% 97%", "--foreground": "215 40% 14%", "--primary": "186 72% 28%" },
    "dark": { "--background": "#0f1720", "--foreground": "#e8edf2", "--primary": "#3cc4cf" }
  },
  // or, instead of "tokens":
  "fromLooks": true,
  "fonts": { "serif": "assets/fonts/mobile/harbour-display.ttf" },
  "mascot": "stills"
}
```

The harness's made-up sample,
[`fixtures/phone-skin/theme.json`](../packages/theme-harness/fixtures/phone-skin/theme.json), is a whole one: Light
in triplets, Dark in `#rrggbb`, every pair below set and passing, and Auto as stills.

| Field | What the validator takes | Refused as |
|---|---|---|
| the block | An object of `tokens`, `fromLooks`, `fonts` and `mascot` only, with exactly one of `tokens` and `fromLooks` | `UNKNOWN_FIELD` for any other key; `BAD_MOBILE` at `mobile` for neither or both |
| `tokens` | `light` (required) and `dark` (optional), no other key | `BAD_MOBILE` at `mobile.tokens.<key>` |
| `tokens.light`, `tokens.dark` | Only the 24 token names below, each with a colour, and always `--background` and `--foreground` | `BAD_MOBILE` at the token, or at the scheme for a missing one |
| a colour | `H S% L%`: three numbers of up to three digits and two decimals, the hue below 360 and the other two at most 100 (`186 72% 28%`, `0 0% 100%`); or `#rrggbb`, six hex digits in either case | `BAD_MOBILE` at `mobile.tokens.<scheme>.<token>` |
| `fromLooks` | Only ever `true` | `BAD_MOBILE` at `mobile.fromLooks` |
| `fonts` | Any of `sans`, `serif` and `mono`, each `assets/fonts/mobile/<name>.ttf` or `.otf` (a letter or digit, then up to 127 letters, digits, `.`, `_` or `-`), each role its own file | `BAD_MOBILE` at the role, or at `mobile.fonts` for one file under two roles |
| `mascot` | `clips`, `stills` or `none`; absent is `none`. `clips` and `stills` need the top-level `mascot` with its `states` | `BAD_MOBILE` at `mobile.mascot` |
| `engines.automatos` | A range that admits no host below 1.1.0, such as `^1.1.0`: an older host refuses the field | `BAD_MOBILE` at `engines.automatos` |

The 24 tokens a scheme may name are Studio's: `--background`, `--foreground`, `--card`, `--card-foreground`,
`--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`,
`--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`,
`--border`, `--input`, `--ring`, `--background-gradient-from`, `--background-gradient-to`, `--glass-border-hover`,
`--cc-hover` and `--cc-hover-border`.

### What the package must hold

`automatos-theme pack` and `automatos-theme check` read the block's files as core's reader does
(`packages/theme-cli/src/check-package.ts` and `files.ts`):

- **`fromLooks`** paints from `boot/prepaint.json`, so the package must have it, and the table's `defaults` must fit
  it (an option of every knob table, a cell of every pair table, every number rule's value in range) and paint
  `--background` and `--foreground` as `H S% L%` triplets. Otherwise `MOBILE_CANNOT_PAINT`. [looks.md](looks.md) has
  the table.
- **Each font** the block names is in the package (`MISSING_FILE`) and is one face: TrueType or CFF outlines, not a
  collection, 1 to 64 tables, every one inside the file (`BAD_FILE_TYPE`), at most 400 KB (`FILE_TOO_LARGE`). A
  `.woff2` in `assets/fonts/mobile/`, or a `.ttf` beside the web's fonts in `assets/fonts/`, is no file a package may
  hold (`NOT_ALLOWED`).
- **Where the phone's fonts come from.** The web's fonts are `.woff2` (Fontsource packages on npm ship only those), and
  the phone takes none, so the phone's come from a second source: the family's TrueType file, such as the Google Fonts
  repository's `ofl/<family>/<Family>-Regular.ttf`. A variable font (`<Family>[wght].ttf`) is one face, but only one under
  400 KB fits, and many are larger: take a static weight's file then. Rename
  it to the block's pattern (letters, digits, `.`, `_` and `-`: no brackets) and keep its licence beside the web's in
  `assets/fonts/`. Each role takes its own file, so one face can't fill two roles: give the face to the role it reads
  best in and leave the other roles to Studio's.
- **`clips`** needs `assets/mascot/<state>.mp4` and `<state>.png` for every state of the top-level `mascot.states`;
  **`stills`** needs the `.png`. Each missing file is `MISSING_FILE`. A clip is at most 1 MB and a still 512 KB; the
  phone plays no `.webm` ([mascot-placement.md](mascot-placement.md) has the web's files).

## What the phone draws

Core serves an installed theme's block to the phone as `GET /api/themes/mobile/<install id>`, the colours and the
file URLs with no code. The kit builds the same answer from a theme's own files
(`packages/theme-cli/src/mobile-answer.ts`, a port of core's `services/themes/mobile.py`); who may fetch it is the
server's business.

| The answer's | Under `tokens` | Under `fromLooks` |
|---|---|---|
| `source` | `tokens` | `fromLooks` |
| `tone` | `null`: the phone follows its own Light / Dark setting | the tone the member's look is drawn in |
| `tokens.light`, `tokens.dark` | the schemes exactly as `theme.json` writes them; one left out is `null` | the member's look painted as the web's first paint paints it, under its tone; the other scheme `null` |
| `fonts` | a URL for each role whose file the package holds | the same |
| `mascot` | the mode and, under `clips` or `stills`, each state with its still's URL, and under `clips` its clip's | the same |

Under `fromLooks` the painting keeps only the 24 tokens painted as `H S% L%` triplets (the web reads them as
`hsl(var(--x))`, so a `#rrggbb` there paints nothing) and leaves out a number rule's variable. A look that doesn't fit
the table paints the defaults, as does one whose painting gives no `--background` or `--foreground`; defaults that
lack either give no answer, and the phone draws Studio. The tone is `theme.json`'s `tone` when that is `light` or
`dark`; under `from-look`, the table's tone rule at the painted look; otherwise dark when the painted `--background`
is darker than its `--foreground`.

The app paints the answer onto its Studio layout (the kit's port is `packages/theme-cli/src/phone/`, from Automatos Go
at the commit the [theme CLI's README](../packages/theme-cli/README.md) names):

- **Colours.** The theme's colours lie over Studio's for the same scheme, so a token the skin leaves out keeps Studio's
  colour. Three tokens have no colour in the Studio layout and are dropped: `--background-gradient-from`,
  `--background-gradient-to` and `--glass-border-hover`. A scheme without `--background` and `--foreground` is not
  painted. With Light alone, the phone draws Light's colours under Dark too.
- **Light and Dark.** Under `tokens` the member's Light / Dark picks the scheme; under `fromLooks` the painting's tone
  does.
- **Type.** A role's file takes that role's text at every weight; sizes and spacing stay Studio's. `serif` is the
  titles' face (Studio's Newsreader), `sans` the body's and the chat's (Geist), and `mono` the eyebrows', labels' and
  figures' (Geist Mono). A role the skin leaves out keeps Studio's face.
- **Auto** shows on First open, saying hello. Under `clips` the phone plays his clip, and shows the still under Reduce
  Motion; under `stills` it shows the still; under `none` there is no Auto, as on Studio. A state the theme has no
  still for keeps the app's own Auto.

The harness's phone view draws all of this: Chat, the Command Centre and First open at an iPhone's 390 × 844, in Light
or Dark, or through each look under `fromLooks`, beside where each token lands
([the harness's README](../packages/theme-harness/README.md), "The phone view").

## Contrast

A phone must be able to read a theme that claims it, so the block's colours are measured, pair by pair, as the review
measures them (`packages/theme-cli/src/check/mobile-contrast.ts`, a port of core's `mobile_contrast.py`):

| Pair | Kind | Minimum |
|---|---|---|
| `--foreground` on `--background` | text | 4.5:1 |
| `--card-foreground` on `--card` | text | 4.5:1 |
| `--popover-foreground` on `--popover` | text | 4.5:1 |
| `--secondary-foreground` on `--secondary` | text | 4.5:1 |
| `--muted-foreground` on `--muted` | text | 4.5:1 |
| `--primary-foreground` on `--primary` | text | 4.5:1 |
| `--accent-foreground` on `--accent` | text | 4.5:1 |
| `--destructive-foreground` on `--destructive` | text | 4.5:1 |
| `--primary` on `--background` | UI mark | 3:1 |
| `--ring` on `--background` | UI mark | 3:1 |

- **What is measured.** Under `tokens`, each scheme the block gives, Light then Dark. Under `fromLooks`, the table's
  defaults (what a member with no stored look gets) and then each preset, each painted as above.
- **How.** The WCAG 2.x ratio of the two colours as the phone reads them (a triplet turned into its `#rrggbb`), held
  unrounded to the minimum; the report writes it to two decimals.
- **What counts.** A pair whose two tokens are not both set is not measured. A colour set that gives no `--background`
  or `--foreground` fails outright. So set both tokens of every pair you change: the phone fills a token you leave out
  with Studio's colour, and the measure does not.
- **Where it stops you.** `automatos-theme check` reports a failing pair, or a set with no ground or text, as an error
  in its `contrast` line (the verdict is `blocked`, exit 1); the Marketplace's review measures the same, and a failing
  pair blocks the listing. `automatos-theme skin` writes no block with a failing pair, and the skin designer offers no
  file for one. `pack` does not measure contrast: it refuses what core's reader refuses.

## The work: design, write, check, pack

1. **Open the phone view.** Run `automatos-theme dev <theme folder>` and open `/phone` on the address it prints (or the
   toolbar's **Phone view** link). A theme whose `theme.json` names a default look needs its own build first
   ([docs/cli-harness.md](../docs/cli-harness.md#dev)).
2. **Design.** The skin designer beside the phone starts a draft from `theme.json`'s own block, from Studio's colours,
   or from one of the theme's looks. Pick where the colours come from (`tokens` or `fromLooks`, which needs
   `boot/prepaint.json`), Light alone or Light and Dark, each token's colour (a picker, or a field that takes exactly
   `H S% L%` or `#rrggbb`), a font for each role from the theme's `assets/fonts/mobile/`, and Auto's mode. The phone
   and the contrast panel follow every change, and the draft stays in the address, so a reload keeps it.
3. **Fix every pair.** The contrast panel marks each failing pair and offers its nearest passing colour in one click:
   the pair's first token with only its lightness moved, as little as passes
   (`packages/theme-cli/src/phone/nearest-passing.ts`). Check Light and Dark: the panel shows the scheme on screen.
4. **Download skin.json.** The designer checks the draft's block with the checks `automatos-theme skin` runs on a
   block (`packages/theme-cli/src/skin-check.ts`). Once it passes, the designer offers **Download skin.json**
   (exactly the block), **Copy** and the text; until then it lists every reason, in the command's words.
5. **Write it.** `automatos-theme skin <theme folder> --from skin.json` checks the block again (the validator, the
   files it names, the contrast) and writes it into `theme.json` as `mobile`, the file's layout kept. It alone also
   refuses a folder inside the kit's `themes/play` or `themes/hud` and a theme of the `automatos` publisher, which the
   browser can't tell. A refusal writes nothing and prints every reason, with the nearest passing value of each
   failing pair ([docs/cli-design.md](../docs/cli-design.md#skin)). `dev` builds again only after a change under
   `src/`, so restart it to see `theme.json`'s new block, or a font or still just added under `assets/`, as the
   phone's own.
6. **Check.** `automatos-theme check <theme folder>`: the `contrast` line measures the block as the review will.
7. **Pack.** `automatos-theme pack <theme folder>` refuses what core refuses, the block's files included, and writes
   the `.autotheme` file.
