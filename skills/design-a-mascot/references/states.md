# The mascot's states

A state is a name in `theme.json` `mascot.states` and a set of files under `assets/mascot/` with that name. The host
only checks the names ([guides/contract.md](../../../guides/contract.md), the `mascot` field); the theme's code
decides which one shows.

## The names theme.json accepts

- `mascot` is null or `{"states": [...]}`, and `states` is its only field (`BAD_MASCOT` otherwise).
- At most 32 names, all different.
- Each name is a lower-case letter, then at most 31 lower-case letters, digits or dashes.
- The same names, with `.webm`, `.mp4` and `.png`, are the file names in `assets/mascot/`.

The kit's reader takes the block as core's does (`packages/theme-cli/src/core/package-manifest.ts`, from core's
`orchestrator/services/themes/manifest.py`).

## Auto's states

These are the states of `@automatos/mascot`, in the order of its `MASCOT_STATES` (`packages/mascot/src/types.ts`).
A theme that bundles the package lists exactly these in `mascot.states` and ships the three files of each. Its
reducer picks the state from the chat's events and the page's; the player plays it.

| State | Shows when | Plays | Swaps in | Ring |
|---|---|---|---|---|
| `hello` | The first open in this browser session; a busier state waits behind it | once | at once | light |
| `idle` | Nothing is happening: where Auto rests | loops | at the clip's end | light |
| `listening` | The message box has focus, an approval card waits for the owner, or a tool asks the owner | loops | at the clip's end | light |
| `thinking` | A message was sent, or the reply is reasoning, before its words or a tool | loops | at the clip's end | accent |
| `working` | A tool other than a search or a read runs, or the turn reports progress, a workflow step or an agent | loops | at the clip's end | accent |
| `searching` | A web or Marketplace tool runs | loops | at the clip's end | accent |
| `reading` | A document, knowledge or memory tool runs, or memories are brought into the turn | loops | at the clip's end | accent |
| `celebrate` | A Deliverable lands, or a turn with a done receipt finishes | once | at the clip's end | light |
| `oops` | The turn, a request or a tool fails, a limit is reached, a tool or a receipt is refused, or an attachment is unavailable | loops | at once | error |
| `sleeping` | Automatos can't be reached, or nothing has happened for a while | loops | at the clip's end | dusk |
| `lost` | The 404 page | loops | at the clip's end | dusk |
| `loading` | The page is loading | loops | at the clip's end | quiet |

- **Plays.** `once` is a one-shot (`ONE_SHOTS`): it plays to its end, then Auto goes to what was queued meanwhile,
  or back to where he rests (usually `idle`). The rest loop until the state changes.
- **Swaps in.** `at once` (`URGENT`) replaces the clip on screen straight away; the rest wait for the clip on screen
  to reach its end, so a tool call that is over before then may never show.
- **Ring.** The tone of the light ring under Auto (`ringTone`, `packages/mascot/src/ring.ts`); its colour comes from
  the look. `light` is his calm light, `accent` the look's accent, `error` the error colour, `dusk` a colour made
  from the ground, `quiet` the ground's secondary text.

## What this means for the drawing

- Every clip is five seconds (`CLIP_MS`, `packages/mascot/src/player.ts`), and a loop starts again from its first
  frame: draw a loop's last frame to meet its first.
- A clip starts at its first frame when it swaps in: start every clip from a pose close to `idle`, and the swaps
  read as one character moving.
- A one-shot ends on its last frame and the next state starts from its first: end `hello` and `celebrate` close to
  `idle`, which usually follows.
- The still is the clip's poster and stands in for it under reduced motion, while the Pause choice is unknown, and
  when the clip won't play: one frame that says the state without motion.
- A caption says the state in words (`captionFor`, `packages/mascot/src/media.ts`): the drawing never has to carry
  the meaning alone.

## A theme's own states

A theme with its own state names (up to 32) writes its own code to choose among them: the kit's reducer, player and
captions know only Auto's twelve. A phone gets every listed state's files by name ([clip-specs.md](clip-specs.md),
"The phone").
