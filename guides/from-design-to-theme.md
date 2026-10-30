# From a design to an installed theme

The way a theme is made: a design session draws it, the kit checks the design, one prompt to an agent in a clone of
the kit builds it, the kit checks and packs it, and Automatos installs it. Each step is a sentence or two and the exact
commands. Nothing outside this repository is needed: the guides hold every fact, the skills the order of work.

## 1. Design

Start the design session with the prompt in [designing-a-theme.md](designing-a-theme.md#a-prompt-for-a-design-session),
then the theme's own description: what it is for, its mood, its pages, its looks, its mascot, whether it has a phone
skin. The session hands over one folder: a `README.md` of rules and pages, `looks.json` in the
`automatos-theme-handoff/v1` shape, and an HTML mock per screen ([designing-a-theme.md](designing-a-theme.md#the-handoff)).
The host's own parts (the approval cards, the voice button, the header utilities, the AI label's corner) are placed in
the mock as Studio draws them, never redrawn as the theme's.

## 2. Check the design

```sh
npx automatos-theme check handoff "path/to/handoff"
```

It reads `looks.json` with the host's own look rules (knob names and kinds, choices, defaults, presets, their names
and lines) and measures every declared colour pair on every preset. Fix the design until it passes: a knob the host
can't take, or a pair under its minimum, is cheaper to change in the design than in the theme.

## 3. Build

In a clone of the kit with its dependencies installed (`README.md`, "Make your own theme"), open an agent (Claude Code
reads `CLAUDE.md`, `AGENTS.md` and `skills/`) and give it one prompt:

```text
Build a new Automatos theme called <Name> (<publisher>/<name>) with this kit, from the design handoff in
<path/to/handoff> (README.md for the rules and pages, looks.json for the knobs, presets and colour pairs, the HTML
mock for the look and layout). First read README.md, AGENTS.md, guides/ and skills/build-automatos-theme/SKILL.md.
Start it with `npx automatos-theme new <publisher>/<name>`. The host's parts are placed, never restyled.
Show only data the SDK gives; where the design wants more, leave it out and say so in the theme's README.
When `npx automatos-theme check themes/<name>` passes, pack it with `npx automatos-theme pack themes/<name> --out out`.
```

The agent follows [skills/build-automatos-theme](../skills/build-automatos-theme/SKILL.md): the look data first
(`check design`), then the frame, the look editor and the style sheet, the pages, the mascot and the phone skin, each
with its tests on the kit's harness.

## 4. See it

```sh
npx automatos-theme dev themes/<name>
```

The kit's browser harness draws the theme on made-up data at `http://127.0.0.1:4319/`, every page and slot, in every
look, with `/phone` for the phone skin; it builds again after each change under `src/`.
`npx automatos-theme shots themes/<name>` photographs every view on Chromium and WebKit with an accessibility scan.

## 5. Check and pack

```sh
(cd themes/<name> && npm run build)
npx automatos-theme check themes/<name> --rebuild
npx automatos-theme pack themes/<name> --out out
```

`check` runs the server's review checks in the server's words; `--rebuild` rebuilds the package's `source/` and
compares it with `dist/` byte for byte, as the Marketplace's review does. `pack` writes
`out/<publisher>.<name>-<version>.autotheme`.

## 6. Install

Settings › Appearance › Themes › Install theme, with the `.autotheme` file, on any edition; or, on a local edition,
`npx automatos-theme install out/<publisher>.<name>-<version>.autotheme --to http://localhost:8000 --choose`. An upload
without a signature that verifies is private, and each member opts in to its code. Look at it at desktop and phone
width, in every look, and in Automatos Go when it carries a phone skin. A changed theme installs over the old one only
at a higher `version` in `theme.json`.

## 7. List

A Marketplace listing is a submission and a person's review ([pass-marketplace-review](../skills/pass-marketplace-review/SKILL.md),
`npx automatos-theme submit`). A listed version shows as **Official** only when its publisher is the reserved
`automatos` and its signature verifies with an Automatos key ([docs/OFFICIAL-LISTING.md](../docs/OFFICIAL-LISTING.md)).

## The kit's own proof

The proof protocol ([proof/README.md](../proof/README.md)) is the kit's test of itself, not the way to make a theme:
a fresh agent in a sandboxed clone at a tagged base builds a theme from a brief and a handoff
(`scripts/proof/launch.sh --design`), and every gap it finds is a fix to the kit. A proof branch never merges as it is;
a theme it built is released as Play and HUD are ([docs/releasing.md](../docs/releasing.md)) once the release workflow's
tag pattern admits it.
