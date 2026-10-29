---
name: design-a-mascot
description: Design an Automatos theme's mascot (Auto, or the theme's own character) as the kit and the host accept it - its states and what each one shows, the clips and stills in assets/mascot/ with their caps and codecs, theme.json's mascot block and the phone's mobile.mascot, the places it can go, and the pause and reduced-motion rules. Use when giving a theme a mascot, drawing or encoding its clips, adding or renaming a state, or when automatos-theme check refuses a mascot file.
---

# Design a mascot

A mascot is the theme's own: its clips and stills ship in the package, and its code decides which state shows. The
host serves the files and offers the places; it never picks a state. This skill is the order of work for one, Auto or
a character of the theme's own. The facts are in [guides/mascot-placement.md](../../guides/mascot-placement.md) and in
the three references here.

## When to use

- Giving a theme a mascot, or redrawing Auto for a theme ([build-automatos-theme](../build-automatos-theme/SKILL.md),
  step 8).
- Drawing, rendering or encoding the clips and stills; adding, renaming or dropping a state.
- `automatos-theme check` refuses a file in `assets/mascot/` or the `mascot` block: `CLIP_TOO_LARGE`,
  `FILE_TOO_LARGE`, `BAD_FILE_TYPE`, `SVG_NOT_ALLOWED`, `BAD_MASCOT`, or `MISSING_FILE` under `mobile.mascot`.

Not for the ring's and the glow's colours: they come from the look
([write-a-look-schema-and-presets](../write-a-look-schema-and-presets/SKILL.md)).

## Read first

1. [references/states.md](references/states.md): Auto's twelve states, when each shows, how it plays, and the rules
   for a theme's own state names.
2. [references/clip-specs.md](references/clip-specs.md): the files, their caps, what the reader checks, and the
   codecs each browser needs.
3. [references/placement.md](references/placement.md): where a mascot can go, the three placement slots, and what
   is never a place.
4. [guides/contract.md](../../guides/contract.md) (the files table, the `mascot` field, the `mobile` block) and
   [guides/sdk.md](../../guides/sdk.md) (`assetUrl`, `useMediaPreferences`, the `storage` area).

## Decide first: whose mascot

- **Auto, as Play draws him.** Name `@automatos/mascot` under `dependencies` in the theme's `package.json`, at its
  version, and ship Auto's 36 files. `automatos-theme new <publisher>/<slug> --template full` starts a theme from
  Play with them, and with their notice: Auto's clips and stills are (c) Automatos AI and are not covered by the code
  licence (the kit's `NOTICE`).
- **Your own drawing on Auto's states.** Keep `@automatos/mascot` (the state machine, the player's queue, the media
  chooser, the Pause control) and draw one file set for each of its twelve states, under the same names. Its
  captions (`captionFor`) speak as Auto ("Hi, I'm Auto."): keep them when the drawing is Auto, and write the theme's
  own words for the same states when it is not.
- **Drawn in code, on Auto's states.** A pixel sprite, an SVG figure or a canvas drawing, stepping through frames
  the theme draws, with `@automatos/mascot`'s state machine choosing the state. No clips: a one-shot ends on a timer
  the theme sets, one pause control stops every moving thing, and the phone's stills are drawn from the same code in a
  test with `@automatos/theme-harness/png` ([guides/mascot-placement.md](../../guides/mascot-placement.md), "A mascot
  drawn in code").
- **Your own states.** Up to 32 names in `theme.json` `mascot.states`, and your own code choosing among them. The
  kit's state machine knows only Auto's twelve.
- **None.** No `mascot` block and no files (`--mascot none` with the full template). The chat still says in words
  what Auto is doing.

## Steps

1. **The states.** Auto's twelve, or your list. Done when `theme.json` `mascot.states` lists them, each name valid
   ([states.md](references/states.md)).
2. **The poses.** For each state, a still that reads as that state on its own: it is the clip's poster, all there is
   under reduced motion, while the Pause control's saved choice is unknown, and when a clip won't play. Take it from
   the clip's first frame, so the swap from still to clip doesn't jump.
3. **The clips.** Render each state on a transparent ground, five seconds long, with no sound (the kit's player swaps
   clips at the five-second boundary, and Play's video autoplays muted). Encode each twice: `.webm` in VP9 with alpha
   and `.mp4` in HEVC with alpha ([clip-specs.md](references/clip-specs.md)). Done when every file is within its cap
   and the whole package is within its own.
4. **The files.** `assets/mascot/<state>.webm`, `<state>.mp4` and `<state>.png` for every state. The mascot's files
   live only there, and none is an SVG.
5. **The code.** Ask the host for each file's URL with `assetUrl('assets/mascot/<state>.<ext>')`; it answers null
   until the host knows the package, so draw the still or nothing until then. Choose the clip by browser with
   `videoFormat` from `@automatos/mascot/media`, never by `canPlayType`. Show the still when
   `useMediaPreferences().reducedMotion` is true. Put the Pause control beside every live, moving mascot
   (`MascotPauseButton` from `@automatos/mascot/mascot-pause-button`), its choice kept through the `storage` area.
   Give a live mascot one name and one caption, the caption a polite live region.
6. **The places.** Inside the theme's own surfaces, or in core's three placement slots
   ([placement.md](references/placement.md)).
7. **The phone** (optional). `mobile.mascot` is `clips`, `stills` or `none`: `clips` needs every state's `.mp4` and
   `.png`, `stills` every state's `.png` ([clip-specs.md](references/clip-specs.md), "The phone"). The rest of the
   block, its colours and fonts, is [design-a-skin](../design-a-skin/SKILL.md).
8. **The proof.** A theme test that holds every state to its three files, their byte signatures and their caps (Play's
   `test/assets.test.ts` holds each file to the sha256 and size in `test/fixtures/mascot-files.json`), then
   `automatos-theme check <theme folder>` and `automatos-theme shots <theme folder>`.

Done when every state in `mascot.states` has its files, `check` reports nothing about them, and the theme's tests
show the still under reduced motion and the Pause control beside every clip that moves.

## Rules

- **Motion can stop** (WCAG 2.2.2): a Pause control beside every looping clip; the still under reduced motion and
  until the saved choice is known.
- **One name, one caption.** A decorative copy (a style sheet's specimen) has no image role and reads nothing out.
- **Colours from the look.** A ring or glow in a fixed colour fails on some ground
  ([guides/pitfalls.md](../../guides/pitfalls.md)).
- **Never the AI label.** The host draws it beside every chat; no mascot covers, restyles or copies it.
- **Files from the package only**, through `assetUrl`: never a URL of another origin.
- **Verify by the check's output.** Never report a file within its cap without having seen `check` (or CI) pass, or a
  clip transparent without having seen it play in Chromium and in Safari.
