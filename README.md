# Automatos Skin Kit

Make skins for Automatos Studio. A skin changes how Studio looks, never how it works: Studio's colours for light and dark, its fonts, its corners and glow, and optionally a mascot in the chat. It is data only (a `skin.json` plus font and mascot files) that Studio validates and turns into CSS itself.

The kit is a separate app and command line you run on your own machine. Design a skin in the visual editor, or with Claude Code or Codex and the kit's skill; preview it on components shaped like Studio's; check it with the same rules Studio uses; pack it into a `.autoskin` file; then load it into your Studio or submit it to the Marketplace. The repo is still called `automatos-play`. The spec is `docs/prd/PRD-004-SKIN-KIT.md`; Studio's side is core PRD-259 (`docs/prd/core/PRD-259-SKINS-IN-STUDIO.md`).

**Who it's for:** designers, who can do everything in the editor without touching a file, and developers, who can write `skin.json` by hand or with an AI assistant and use the CLI.

## Your first skin in 15 minutes

1. **Run the kit** (Node.js 22.22.2 or newer; [Run the kit](#run-the-kit) has the details):

   ```sh
   git clone <this repo> automatos-play
   cd automatos-play
   npm install
   cp .env.example .env.local
   npm run dev
   ```

   Open **http://localhost:3100**. The editor opens.
2. **Start from something.** Under the editor's start options pick "Start from Studio", "Start from Classic", or one of the four examples (also on the Examples page, `/examples`: "Start from this").
3. **Change the colours.** Pick a group (Surfaces, Text, Brand, Status, Charts, Studio aliases) and change a colour with the picker, or type a hex or HSL value. Every colour shows a badge for each contrast pair it is part of, with the verdict Studio's validator will give: "AA pass", "AA fail" (with "Use suggestion", a readable colour), "Incomplete pair" (the skin sets one side only: "Set … too") or "Base colours, not checked". Start with `background`, `foreground`, `primary` and `primary-foreground`: they carry most of the look.
4. **Look at it.** The live preview beside the editor follows every change; `/preview` shows the full gallery, in both bases and tones, and side by side with Studio as it ships.
5. **Name it.** Under the details give it a name, a slug, your name as author and a version.
6. **Export .autoskin**, then in Studio: Style → Add a skin… and pick the file. Or press "Load into my Automatos" with your local Automatos running.

The same with the command line, for a developer or an AI assistant:

```sh
cp -r skins/ember skins/my-skin        # start from an example
# edit skins/my-skin/skin.json: slug, name, author, the colours
npm run validate skins/my-skin         # repeat until it prints ✓
npm run pack skins/my-skin             # writes dist/my-skin-<version>.autoskin
```

## Make a skin with Claude Code or Codex

The skill `skills/build-automatos-skin/` teaches an assistant the whole job: the format, what each of Studio's tokens colours, the contrast rules and how to fix a failing pair, fonts, the mascot pipeline, and packaging. Its workflow: start from an example or a base, edit `skin.json`, run `npm run validate` until it is clean, `npm run pack`, load it into a local Automatos. It never writes CSS or JavaScript into a skin.

Point the assistant at it ("use skills/build-automatos-skin to make a skin that feels like …"). Claude Code picks it up from the folder; for Codex, name the file in your prompt. The references:

- `references/tokens.md`: the 47 allowed tokens, what each colours in Studio and in the kit's preview.
- `references/contrast.md`: the 14 pairs, the ratios, readable text.
- `references/fonts.md`: Studio's fonts and your own woff2 files.
- `references/mascot.md`: off, Auto or your own: the 12 looping clips and how Auto was made.
- `references/packaging.md`: validate, pack, load, submit.

## The editor and the other pages

- **Editor** (`/`): the skin editor. Start from Studio, Classic or an example skin; set the details (name, slug, author, version, licence, description, base and tones); change any of Studio's colour tokens, grouped as Surfaces, Text, Brand, Status, Charts and Studio aliases, with light and dark side by side (a tone the skin drops has no column). Every colour shows a contrast badge for each text pair it is part of (a glyph, the ratio and "AA pass" or "AA fail"), and a failing pair offers "Use suggestion", a readable colour. Radius (0–24 px) and glow (0–40 px) are sliders. Undo and Redo are buttons and keys (Ctrl or Cmd + Z, add Shift to redo). The draft is kept in this browser and survives a reload. A live preview beside it shows a few Studio-shaped components with the skin applied, made by the same CSS generator Studio uses. **Fonts:** for sans, serif and mono, pick Geist, Geist Mono or Newsreader (the fonts Studio ships) or drop a `.woff2` file of at most 400 KB (checked by its first bytes, not its name); the previews load it at once. **Mascot:** Off, Auto (pick his shell tint and light colour; his clips play when they are in `public/auto/`, else his stand-in) or Custom (drop files or a folder with the 12 states as `.webm`, `.mp4` and `.png`, at most 8 MB together; the editor lists what the set is still missing). A state picker plays each state. Font and mascot files are kept in this browser's IndexedDB beside the draft, so a reload keeps them. **Export and share:** Export .autoskin downloads `<slug>-<version>.autoskin`, the same file `npm run pack` writes; Import a .autoskin loads one back (validated first; its font and mascot files replace yours; a preview picture isn't kept). Load into my Automatos and Submit to the Marketplace are below. Every way out validates the skin first, and the problems are listed in words.
- **Preview** (`/preview`): the editor's draft on a gallery of Studio-shaped components: the sidebar, a page header with the stats bar and filter tabs, the chat ledger (your message, Auto's tool lines and answer, the receipts, a Deliverable card, the composer), cards, a table with status badges, the five button kinds, fields, a modal, toasts and two small charts. They are drawn only with Studio's token names, coloured by the same CSS Studio will generate. Switch the base (Studio or Classic) and the tone (Light or Dark), or turn on "Compare with Studio" to see Studio as it ships beside your skin. Corners follow the skin's radius and the glow shows on focused fields and live states. The page follows the editor as you change the draft in another tab, and loads the draft's own font files.
- **Style sheet** (`/style`): the kit's own Look (Ember unless another is saved in this browser; PRD-002, see `docs/LOOKS.md`): its colours with their contrast ratios, its type, spacing, radii, components and Auto's 12 ring colours, and a copy of its CSS variables. It describes the kit's interface, not your skin.
- **Examples** (`/examples`): Ember (warm graphite and molten, light and dark, Auto), Daylight (paper and molten, light only, molten darkened wherever it is text), Workshop (the original Play indigo night, on Classic, Auto) and Neon (a dark-only HUD look: void ground, arc cyan). Each card shows the skin's preview picture and "Start from this", which opens the editor on it (`/?start=<slug>`, one step Undo takes back). Each is a folder in `skins/` that passes `npm run validate`; copy one to start your own.

The kit needs no running Automatos. Only Load into my Automatos and Submit to the Marketplace talk to one, through the kit's own server.

## The command line

```sh
npm run validate skins/<folder>     # or a .autoskin file: the same rules as Studio, each problem with its JSON path
npm run pack skins/<folder>         # validates, then writes dist/<slug>-<version>.autoskin
npm run sync-schema                 # refreshes spec/ from a running Automatos (GET /api/skins/schema)
npm run previews                    # redraws the example skins' preview pictures
```

- `validate` prints `✓ <name> (<slug> <version>) is a valid automatos-skin/v1 skin.`, or one `✗ <path>  <problem>` line per problem. Exit code 0 when valid, 1 when not, 2 when the path doesn't exist.
- `pack` takes a skin source folder (`skin.json` plus `assets/`) and writes nothing when the skin is invalid. The same skin always packs to the same bytes.
- `sync-schema -- --from <automatos-ai checkout>` reads the schema from a local checkout instead. Until Studio publishes its schema, `spec/automatos-skin.v1.schema.json` is the kit's draft of PRD-259 §3 (`spec/README.md` lists its choices).
- `previews` (or `npm run previews -- <slug>` for one) draws `skins/<slug>/assets/preview.png`: a 960 × 540 picture of Studio-shaped parts in the skin's own colours, drawn by plain Node with no dependencies.

More in `scripts/README.md`.

## The skin format

`automatos-skin/v1`, owned by Studio (PRD-259 §3). A `.autoskin` is a zip of `skin.json` and an optional `assets/` folder:

```json
{
  "schema": "automatos-skin/v1",
  "slug": "my-skin",
  "name": "My skin",
  "version": "1.0.0",
  "author": "You",
  "description": "What it looks like, in a sentence.",
  "licence": "CC-BY-4.0",
  "base": "studio",
  "tones": ["light", "dark"],
  "tokens": {
    "light": { "primary": "20.3 71.7% 38.8%", "primary-foreground": "0 0% 100%" },
    "dark": { "primary": "#FF6A1A", "primary-foreground": "20 85.7% 5.5%" }
  },
  "fonts": { "sans": "geist", "serif": "newsreader", "mono": "geist-mono" },
  "shape": { "radius": 10, "glow": 12 },
  "mascot": { "mode": "auto", "shell": "bronze", "light": "mint" },
  "preview": "assets/preview.png"
}
```

Colours are HSL triplets or `#rrggbb` for Studio's 47 allowed tokens, with a set of colours for each tone in `tones` (`{}` keeps the base's). Of the 14 pairs, every one a skin touches must have both sides set and read at 4.5:1 (the focus ring at 3:1), checked on the skin's own colours only. Fonts are Studio's keys (`geist`, `geist-mono`, `newsreader`) or a woff2 in `assets/fonts/`; Auto's `light` is `mint`, `amber`, `ice` or `rose`. Never CSS, JavaScript, SVG, HTML or URLs. The full rules are in the skill's references and `spec/`.

## How Studio loads a skin

From core PRD-259 §4 and §5 (Studio's side, being built in `automatos-ai`):

- **Style list.** Studio's appearance menu lists Classic, Studio, then the workspace's installed skins under "Skins", plus "Add a skin…" (load a `.autoskin`) and "Browse skins" (the Marketplace).
- **Choosing a skin** sets the `automatos-style` cookie to `skin:<id>`. The server puts the skin's base class on `<html>` (`studio`, or none for Classic) and `data-skin="<id>"`, so Studio's layouts are untouched.
- **The CSS** is written by Studio from the validated numbers only: `html[data-skin="<id>"]{…light tokens…}` and `html.dark[data-skin="<id>"]{…dark tokens…}`, plus `--radius`, `--skin-glow` and the font variables, cached and applied before the first paint, so there is no flash. The kit's preview uses the same generator (`lib/skins/css.ts`).
- **Tones.** A dark-only skin forces Dark while it is active (a light-only one Light); leaving the skin restores the user's tone.
- **Files** (fonts, mascot clips, the preview) are served by Studio only from the validated package. If a skin is uninstalled or broken, Studio falls back to its base and says so quietly.

**Load into my Automatos** (the editor's button) posts the file to your local Automatos (`POST /api/skins/import`) through the kit's server: it is installed in your workspace at once, with no review, for you to pick in Studio under Style, Skins. It needs an Automatos with skins (PRD-259); an older one answers "Your Automatos doesn't support skins yet (it needs PRD-259)".

## The Marketplace

1. **Submit:** "Submit to the Marketplace" in the editor, or Submit from a file on Studio's Marketplace page. The kit sends it to `POST /api/marketplace/skins` through its own server.
2. **Review:** an admin approves or rejects it with a reason (in the local edition, you are the admin). Authors with five approved skins skip the queue.
3. **Install:** other workspaces find it under the Marketplace's Skins tab (preview pictures, light and dark), press Install, and pick it in their Style list. Uninstall takes it out again.
4. **Remix:** with a skin's `.autoskin` file, anyone can open it in the kit ("Import a .autoskin"), change it, and submit their own version under their own slug, as its licence allows.

"Open my Automatos Marketplace" in the editor opens the page (`NEXT_PUBLIC_AUTOMATOS_STUDIO_URL`).

## What was retired

Before PRD-004 this repo was Automatos Play, a second interface that rebuilt Studio's pages: the chat, Conversations, the Deliverables shelf, Missions, Agents and Knowledge. Those pages, their components, hooks, client code, proxy routes and tests were removed in K-001: the kit previews a skin on Studio-shaped components instead of rebuilding Studio. They stay in git history (PRs #1 and #3). The last commit that has them is `378e98f`; to read one, for example the chat: `git show 378e98f:components/chat/ChatScreen.tsx`, or restore a folder into a scratch branch with `git checkout 378e98f -- components/chat`.

What the kit kept: the Look engine (`lib/looks/`, `components/looks/`) behind the editor's contrast maths and the kit's own look, Auto's mascot player (`lib/mascot/`, `components/mascot/`), the proxy safety code (`lib/server/`), the chat stream parser that drives the mascot (`lib/stream/`), and `skills/build-automatos-interface/` as a reference for anyone building a whole interface on the Automatos API.

## Run the kit

### Prerequisites

1. **Node.js 22.22.2 or newer** (`node --version`). Or Docker only: see [Run the kit in Docker](#run-the-kit-in-docker).
2. **Only to load or submit a skin: a running local Automatos.** In your `automatos-ai` folder run `docker compose up` and wait until the backend answers:

   ```sh
   curl http://localhost:8000/api/workspaces/current
   ```

   You should get JSON with an `id`. The local edition (`AUTH_EDITION=local`, the default in `automatos-ai/envs/api.defaults`) needs no login, and the kit sends no credentials. Designing a skin needs nothing running.

### Start it

```sh
git clone <this repo> automatos-play
cd automatos-play
npm install
cp .env.example .env.local
npm run dev
```

Open **http://localhost:3100**. The editor opens.

`.env.local` holds three settings. The first two are read on the kit's server only (the browser never calls the backend; the kit's own `/api/*` routes forward every request); the third is only a link address, built into the page:

| Setting | Default | When to change it |
|---|---|---|
| `AUTOMATOS_BACKEND_URL` | `http://localhost:8000` | Your backend is on another port (`API_PORT` in `automatos-ai`) or host. In a container on the Automatos network it is `http://backend:8000`. |
| `PLAY_ALLOWED_HOSTS` | (empty) | You open the kit on a host name other than `localhost`, `127.0.0.1` or `[::1]`. Comma separated. The kit has no login, so it refuses other host names (a guard against DNS rebinding). |
| `NEXT_PUBLIC_AUTOMATOS_STUDIO_URL` | `http://localhost:3000` | Studio (the Automatos web app) runs somewhere else. Only the editor's "Open my Automatos Marketplace" link uses it (`<url>/marketplace`); restart `npm run dev` after changing it. |

For a production build: `npm run build`, then `npm start` (also on port 3100).

## The mascot files

The Auto animations are not in this repository (see `NOTICE`). Without them the kit shows a placeholder where Auto stands, and everything else works.

If you have them, put them in `public/auto/` (git-ignored), three files per state:

```
public/auto/<state>.webm   VP9 with alpha: Chrome, Edge, Firefox
public/auto/<state>.mp4    HEVC with alpha: Safari and every iOS browser
public/auto/<state>.png    transparent still: the poster, and what shows under reduced motion
```

The 12 states: `hello`, `idle`, `listening`, `thinking`, `working`, `searching`, `reading`, `celebrate`, `oops`, `sleeping`, `lost`, `loading`. Restart is not needed: reload the page.

## Run the kit in Docker

Optional. `docker-compose.yml` runs the kit in a container on the Docker network the Automatos compose file creates (`automatos_network`), with `AUTOMATOS_BACKEND_URL=http://backend:8000`. Nothing in `automatos-ai` changes.

```sh
# 1. In automatos-ai: start Automatos first, it creates the network.
docker compose up -d

# 2. In automatos-play:
docker compose up
```

Open **http://localhost:3100**. The first start runs `npm install` inside the container and takes a few minutes. The port is bound to `127.0.0.1` only; set `PLAY_PORT` to use another one. The mascot files are read from your `public/auto/`.

## Troubleshooting

**"Automatos isn't running."** Loading or submitting a skin needs your local Automatos at `AUTOMATOS_BACKEND_URL`; the message shows the address the kit tried. Everything else in the kit works without it. Start Automatos (`docker compose up` in `automatos-ai`), then:
- Check the URL: `curl <AUTOMATOS_BACKEND_URL>/api/workspaces/current`.
- The kit in Docker must use `http://backend:8000`, not `localhost` (inside a container, `localhost` is the container).
- The kit on your machine with Automatos in Docker uses `http://localhost:8000`. The backend publishes its port on `127.0.0.1` only (`BIND_ADDRESS`), so use the same machine.
- `docker compose up` for the kit says `network automatos_network declared as external, but could not be found`: start Automatos first.

**Wrong port.**
- `npm run dev` says port 3100 is in use (`EADDRINUSE`): stop what holds it (`lsof -i :3100`), or run the kit on another port with `npx next dev -p 3200`.
- Your backend isn't on 8000 (you set `API_PORT` in `automatos-ai`): set `AUTOMATOS_BACKEND_URL=http://localhost:<API_PORT>` in `.env.local` and restart `npm run dev`.
- A request fails with "Open Play at http://localhost:3100" (HTTP 403): you opened the kit on another host name. Use `localhost`, or add the name to `PLAY_ALLOWED_HOSTS`.
- Don't point `AUTOMATOS_BACKEND_URL` at Studio (port 3000): Studio is a web page, not the API.

**"Your Automatos doesn't support skins yet (it needs PRD-259)."** Load into my Automatos and Submit reached your Automatos, but it has no skin routes (HTTP 404). Update `automatos-ai` to a version with PRD-259, or use Export .autoskin and keep the file until then.

**Auto is a black box.** Your browser got the wrong video file (Safari needs `.mp4`, everything else `.webm`). Check both files exist for that state. Please report it with your browser and version.

**Auto is a placeholder.** The mascot files aren't in `public/auto/` (see [The mascot files](#the-mascot-files)).

## For contributors

- The spec is `docs/prd/PRD-004-SKIN-KIT.md` (the kit). The earlier ones describe what the kit grew from: `docs/prd/PRD-001-FUN-UI-PILOT.md` (the pilot), `docs/prd/PRD-002-LOOKS-POC.md` (Looks) and `docs/prd/PRD-003-MAIN-PAGES.md` (the retired pages). The Look format, its catalogue and the contrast rules: `docs/LOOKS.md`. The skin knowledge is `skills/build-automatos-skin/` (kept in step with `lib/skins/format.ts` by `tests/skins/skill-docs.test.ts`); the API knowledge is `skills/build-automatos-interface/`. `docs/SKILL-GAPS.md` lists where either, or core PRD-259, was wrong during the build.
- Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (CI runs all four).
- Layout: `lib/skins/` (the format, validator, CSS generator, packer and editor model), `components/skins/` (the editor), `components/preview/` (the gallery), `spec/` (the `automatos-skin/v1` schema), `skins/` (example skin sources), `scripts/` (the CLI), `skills/` (the assistant skills), `dist/` (packed `.autoskin` files, git-ignored).
- The manual checks against a real install, and how to record stream fixtures: `docs/RUN-CHECKLIST.md` (its page sections describe the retired pages).

## Licence

Code: Apache-2.0 (see `LICENSE`). The Auto mascot assets are not covered by the code licence and are not in this repository (see `NOTICE`).
