# Changelog

Play's versions, newest first. A released version's files never change: a change to them is a new version.

## 1.1.1

- **The old markers are gone.** Play's motion stop now reads only the host's generic marker,
  `data-theme-motion="reduce"` on `<html>`, and its motion factor `--pl-motion-scale` only the host's
  `--theme-motion` (1 when the host sets none). The `data-pl-motion` selector and the `--pl-motion` fallback, which
  only builtin Play's own look code set, are removed. The heading of Make it yours and of the style sheet carries only
  `data-theme-heading`, the mark the host hands the focus to; `data-play-only-heading` is removed. Under core's host,
  which writes only the generic markers since builtin Play left core, nothing changes.
- **The look kit and Auto's player are kit packages.** `@automatos/look-kit` (the kit's `packages/look-kit`: the
  look's CSS variables, contrast and colour, Studio's tokens and the look validator, with the AA proofs) and
  `@automatos/mascot` (`packages/mascot`: Auto's state machine, his player, the media chooser and the Pause Auto
  control) replace Play's own copies. Play bundles both, and the package carries their source under
  `source/packages/<name>/src/`, so the Marketplace review rebuilds them with the rest.
- **The README.** "Where the code comes from" is one line pointing at the kit's `docs/PLAY-HISTORY.md`, which now
  holds the commit Play was copied from and every line changed. The section on keeping core's copy in step, which
  ended when builtin Play left core, is gone, and the build notes name the storage area Play's tests run on now.

## 1.1.0

The first release from the kit.

- **The phone.** `theme.json` has a `mobile` block: `fromLooks`, so a phone paints Studio's tokens from the look the
  user picked, and Auto's clips (`mascot: "clips"`). The AA proof holds ten pairs (eight text pairs at 4.5:1, two UI
  pairs at 3:1) on the first paint's defaults and on each of the five presets.
- **Auto's reply is marked AI-generated.** Its root carries `data-ai-generated="true"`, the machine-readable mark
  core's chat puts on each assistant message.
- **Seven listing previews** in `assets/previews/`: one per preset, and two more of Ember (Deliverables and Make it
  yours).
- **The SDK's storage area.** Play keeps Auto's pause, his hello and the seen Deliverables through the host's storage
  area, never browser storage.
- **The package.** Auto's clips and stills are committed in `assets/mascot/`; the package carries `src/` as
  `source/` for the Marketplace review; `boot/prepaint.json` carries the tone rule the host sets a look's tone from.
  The motion stop and the screen headings also answer the host's generic markers, `data-theme-motion` and
  `data-theme-heading`, beside builtin Play's own.
