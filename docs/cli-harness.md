# `automatos-theme`: the harness commands

The commands that run the kit's browser harness (`packages/theme-harness`), the mock host page that draws a theme
from its folder with nothing of Automatos running: `dev` serves it as a local app, `shots` photographs every view on
Chromium and WebKit with an axe scan, and `previews` copies picked shots (or Automatos Go screenshots) into the
theme's listing. The rest of the
command line (running it, the commands table, the environment) is in [cli.md](cli.md).

## `dev`

```text
usage:    automatos-theme dev <theme folder> [--port <n>]
example:  npx automatos-theme dev themes/harbour --port 5000
```

Serves the kit's browser harness (the mock host page `shots` photographs) for one theme, as a local app to build it
in, with nothing of Automatos running (`src/dev.ts`, `src/dev-server.ts`).

1. It listens first, on `127.0.0.1` only, on `--port` (default 4319; `0` picks a free port; at most 65535). A port it
   can't serve is refused before anything is built.
2. It builds the harness for the folder (`vite build --config vite.harness.config.ts` from the harness's folder,
   with `AUTOMATOS_HARNESS_THEME` naming the theme), each build into a fresh folder under the harness's `dist/`.
   Until one build has passed, every request is answered 503.
3. It serves the last build that passed and nothing else: GET and HEAD only, `Cache-Control: no-store`, a `Host`
   other than `127.0.0.1`, `localhost` or `[::1]` refused (421), any path outside the build, through a link, to a
   folder or to a dotfile answered 404.
4. Each change under `src/` builds again, taken as `pack --watch` takes changes. A failed build is printed and the
   last good one stays served; reload the page to see a new one.

The harness draws the folder's look data (`looks/`, `boot/`) as the theme's own build last wrote it: after changing
the looks, run that build (or keep `pack --watch` running beside `dev`).

Two pages: `/`, the mock host, and `/phone`, the phone view (the toolbar's **Phone view** link). The phone view
draws the theme's skin, its `theme.json` `mobile` block, on Automatos Go's Studio layout at 390 × 844 (Chat,
Command Centre, First open), light or dark, or through each look preset under `fromLooks`. Beside it are the
`mobile` block's contrast pairs, measured exactly as `check` measures them, and where each token lands. A theme
without a skin is drawn in Studio's own colours. For Play and HUD, which Automatos Go draws with its built-in Play
and HUD layouts and none of the block, it says so: those layouts are part of the app
(`packages/theme-harness/README.md`, "The phone view"). For any other theme the skin designer sits beside it: a draft
of the block, from the theme's own, Studio's colours or a look's, repainted and measured at each change, kept in the
address, with a one-click nearest passing colour for a failing pair, and downloaded as `skin.json` for
[`skin`](cli-design.md#skin) only when that command would write it.

Exit codes: 0 once stopped (Ctrl-C); 1 no `theme.json` (or not JSON) or no `src/entry.ts`, a default look with no
`looks/presets/` yet, or a port that can't be served; 2 usage error.

## `shots`

```text
usage:    automatos-theme shots <theme folder> [--out <folder>]
example:  npx automatos-theme shots themes/harbour --out shots
```

Draws the theme in the browser harness and shoots it on Chromium and WebKit with an axe scan of every shot
(`src/shots.ts`, the harness's `shots/`). Two steps, the second only when the first passed, both from the harness's
folder with the theme folder in `AUTOMATOS_HARNESS_THEME` and the out folder in `AUTOMATOS_HARNESS_OUT`:

1. `vite build --config vite.harness.config.ts`: the harness app with the theme's `src/entry.ts` in it;
2. `playwright test --config shots/playwright.config.ts`, whose web server previews that build on
   `http://127.0.0.1:4318`.

The out folder (default `./shots`) gets `<browser>/<preset>/<width>/<view>.png`: one PNG per slot, page and route the
theme both declares and registers, for each preset at 1440 and 1024 px and once just below its own `minWidth`, with
reduced motion, and an `axe.json` beside each set. A theme with a `/chat` page gets that page twice more in its
default look at 1440 px: with motion allowed, in `<preset>/1440-motion/` (Auto's clip and the Pause Auto control,
which reduced motion never draws), and on a made-up transcript, in `<preset>/1440-transcript/` (the owner's words,
Auto's reply with a tool line and a Deliverable). A theme whose own `minWidth` is at most 390 px, so it draws at a
phone's width, is shot at a phone's 390 × 844 too, with reduced motion: each preset in `<preset>/390/` and, with a
`/chat` page, that page on the transcript in its default look, in `<preset>/390-transcript/`. A theme whose `minWidth`
is wider gets no 390 set: below `minWidth` the host draws its own pages, which the set just below it shows. A theme
whose `theme.json` `uses` names the SDK's `voice` area (SDK 1.2.0) gets its voice states too: its `/chat` page (or every
view, with none) on the transcript in its default look at 1440 px, in each phase of a made-up voice session on that
conversation, in `<preset>/1440-voice-listening/`, `-thinking/`, `-speaking/` and `-error/`, with the voice levels held
still and the session's words at the end of the conversation, as core's chat adds them. A theme whose `uses` names the
SDK's `proactive` area (SDK 1.3.0) gets the day with no brief too: its `/chat` page (or every view) in its default look
at 1440 px with the brief off, in `<preset>/1440-no-brief/`; every other set has the harness's sample brief. Each set's
browser window is sized to the set's width (900 px tall, or the phone's 844), so the theme's own media queries see the
width it is shot at. The harness draws the theme on core's base layer (Tailwind's preflight and core's base styles),
the looks pages full bleed and the 404 with no frame, as core does, and answers the page areas' reads with made-up
data. A set fails on a missing shot, on any request to another origin than the harness's, and on a critical axe
violation. The browsers come from `npx playwright install chromium webkit`.

Exit codes: 0 every shot passed; the failing step's own exit code; 1 no `theme.json` (or not JSON) or no
`src/entry.ts`, or a default look with no `looks/presets/` yet; 2 usage error.

### The showcase shots

`shots` is a regression set: every view of every preset on the local edition, at one pixel per CSS pixel, scanned
with axe. The showcase is a separate, short set of clean images of the kit's own themes, HUD, Play, Arcade and Candy, for READMEs,
docs and the product site. It is not a command: kit CI's `harness` job runs it after the shots, and it runs the same
way from the kit's root:

```text
npx playwright test --config packages/theme-harness/shots/showcase.config.ts
```

The config serves each theme with `dev` on a port of its own (HUD on `http://127.0.0.1:4320`, Play on `:4321`). Each
shot is one view in one look, at 1440 × 900 or a phone's 390 × 844, drawn as the hosted edition draws it
(`edition=saas` in the harness's address, so core's local-only first-run nudge is not over the chat), at twice the
pixel density, with reduced motion, a fixed clock (14 Oct 2026, 10:24 UTC, inside the fixtures' made-up day) and the
harness's own made-up data: the laptop-shortlist conversation and its Deliverable, the running Mission and the board's
cards, and the made-up voice session, with the demo extras a workspace in use shows (`demo=` in the address): every
agent active, Play's hello already played on each of its conversations (its first open keeps it), and five older
conversations on Play's Conversations. The day's brief is on, as the harness page opens, but for HUD's chat, voice and
panel shots, which draw its screen once the brief has folded back (`brief=off`). A shot may take one step first: open
the theme's phone menu, press the host's Listen for the brief and wait until Auto reads it, or scroll a panel's
heading into view. The harness's labelled stand-in for core's floating Auto widget is hidden for
the shot. The images are Chromium's alone and get no axe scan: the regression shots cover WebKit and the scans.

The PNGs go to `packages/theme-harness/dist/showcase/`, each named `<theme>-<width>-<what>-<look>.png` (for example
`hud-1440-voice-listening-arc.png`), with a failed test's trace in its `test-results/`. CI uploads that folder as the
`kit-showcase` artifact on every pull request and every push to `main`, apart from the `kit-harness` artifact. The
list is `SHOWCASE_SHOTS` in `packages/theme-harness/src/host/showcase.ts`:

| Theme | Width | Shots |
|---|---|---|
| HUD | 1440 | `chat-arc`, `chat-forge`, `chat-ghost`, `chat-nova`, `chat-signal` (one per look: HUD's listing previews), `voice-listening-arc`, `voice-speaking-forge`, `look-editor-arc`, `briefing-arc`, `briefing-forge`, `briefing-ghost`, `briefing-nova`, `briefing-signal` (BRIEFING in the right column, one per look), `briefing-speaking-arc` (Listen pressed: `▸ SPEAKING`), `missions-arc`, `systems-arc` (each panel scrolled into view) |
| HUD | 390 | `chat-arc`, `voice-listening-forge`, `look-editor-arc`, `voice-speaking-arc`, `briefing-arc`, `briefing-forge`, `briefing-ghost`, `briefing-nova`, `briefing-signal` (BRIEFING in the last exchange's slot, one per look), `briefing-speaking-arc` |
| Play | 1440 | `first-open-ember`, `chat-ember`, `voice-speaking-ember`, `chat-daylight`, `look-editor-ember` |
| Play | 390 | `chat-ember`, `menu-ember` (its phone menu open), `conversations-ember`, `voice-listening-ember` |
| Arcade | 1440 | `chat-overworld`, `chat-dungeon`, `chat-neon`, `chat-nightcity`, `chat-handheld`, `quests-overworld`, `inventory-overworld`, `look-editor-overworld` |
| Arcade | 390 | `chat-overworld`, `chat-handheld` |
| Candy | 1440 | `today-blush`, `today-lilac`, `today-nightbloom` (one per look: Candy's listing covers), `chat-blush`, `deliverables-blush`, `team-blush`, `look-editor-blush`, `chat-nightbloom` |
| Candy | 390 | `today-blush`, `chat-blush` |

HUD draws no Command Centre page of its own (the host's page stands in its frame there), so the set has none.

## `previews`

```text
usage:    automatos-theme previews <theme folder> (--from <shots folder> | --phone <screenshots folder>) [--pick <name>=<file>]...
example:  npx automatos-theme previews themes/harbour --from shots \
          --pick day=chromium/day/1440/slot-frame-1.png --pick day-looks=chromium/day/1440/slot-lookEditor-1.png
example:  npx automatos-theme previews themes/harbour --phone phone-shots \
          --pick day-chat=IMG_0412.PNG --pick night-chat=IMG_0415.PNG
```

Copies the shots you pick into the theme's listing previews and sets `theme.json` `previews` to them, in the order
given (`src/previews.ts`); with `--phone`, copies phone screenshots into its phone screenshots and sets
`phonePreviews` (`src/previews-phone.ts`). The Marketplace listing keeps each list's order, and its cover is the first
preview and its phone cover the first phone screenshot, so the first pick is the cover.

| Argument | Meaning |
|---|---|
| `--from <shots folder>` | The folder `shots` wrote: the picks are web previews. One of `--from` and `--phone` is required. |
| `--phone <screenshots folder>` | A folder of Automatos Go screenshots, PNG or JPEG: the picks are phone screenshots. |
| `--pick <name>=<file>` | Repeatable. `<name>` is the file stem, `<preset>` or `<preset>-<screen>`. With `--from` it is written as `assets/previews/<name>.png` and `<file>` is a PNG path under the shots folder; with `--phone` it is written as `assets/previews/phone/<name>.png` or `.jpg`, the extension the file's bytes give (a `.jpeg` or an `IMG_0412.PNG` is fine), and `<file>` is a path under the screenshots folder. |

With no `--pick` and `--from`, each preset gets `<preset>.png`: its first view (slots, then pages, then routes) on
Chromium at 1440 px, the default look first. With no `--pick` and `--phone`, every `.png`, `.jpg` or `.jpeg` file right
in the folder is a pick, named by its file name without the extension: name the screenshots `<preset>.png` or
`<preset>-<screen>.jpg` as you save them. They are listed by look, the default look's first, then by name.

The phone screenshots come from the phone, not from the harness: install the theme, open Automatos Go, and take
each screen in each look with the phone held upright (the storefront draws them in a portrait phone frame, about
9:19.5). Keep each under 512 KB: save a large screenshot as a JPEG.

Every pick is checked before anything is written, and every reason is printed: a name core's reader would not take
as a path in the list's folder, a name no preset claims (the longest matching preset id wins) or picked twice, a file
outside the folder given, missing, over 512 KB or not a PNG (with `--phone`, not a PNG or a JPEG), and more than 24
in the list. `theme.json` keeps its own layout: only `previews`, or with `--phone` only `phonePreviews`, is
rewritten, and the other list and its files are left alone. A file in `assets/previews/` (with `--phone`,
`assets/previews/phone/`) the new list no longer names stays where it is, with a warning, since `pack` still packs
it. A phone screenshot wider than it is tall is written with a warning; core checks no size.

Exit codes: 0 written; 1 refused (nothing written); 2 usage error.
