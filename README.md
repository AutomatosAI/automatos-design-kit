# Automatos Skin Kit

Make skins for Automatos Studio. The kit is a separate app you run locally: design a skin in the editor (or with Claude Code or Codex and the kit's skills), preview it on Studio-shaped components, export a `.autoskin` file, and load it into your Studio or submit it to the Marketplace. Auto, the mascot, is optional in a skin. The spec is `docs/prd/PRD-004-SKIN-KIT.md`; Studio's side is core PRD-259 (`docs/prd/core/PRD-259-SKINS-IN-STUDIO.md`).

The repo is still called `automatos-play`. The kit is being built in one wave (PRD-004, stories K-001 to K-009), so some pages are placeholders until their story lands.

## The pages

- **Editor** (`/`): the skin editor. Start from Studio, Classic or an example skin; set the details (name, slug, author, version, licence, description, base and tones); change any of Studio's colour tokens, grouped as Surfaces, Text, Brand, Status, Charts and Studio aliases, with light and dark side by side (a tone the skin drops has no column). Every colour shows a contrast badge for each text pair it is part of (a glyph, the ratio and "AA pass" or "AA fail"), and a failing pair offers "Use suggestion", a readable colour. Radius (0–24 px) and glow (0–40 px) are sliders. Undo and Redo are buttons and keys (Ctrl or Cmd + Z, add Shift to redo). The draft is kept in this browser and survives a reload. A live preview beside it shows a few Studio-shaped components with the skin applied, made by the same CSS generator Studio uses. **Fonts:** for sans, serif and mono, pick Geist, Geist Mono or Newsreader (the fonts Studio ships) or drop a `.woff2` file of at most 400 KB (checked by its first bytes, not its name); the previews load it through `@font-face`. **Mascot:** Off, Auto (pick his shell tint and light colour; his clips play when they are in `public/auto/`, else his stand-in) or Custom (drop files or a folder with the 12 states as `.webm`, `.mp4` and `.png`, at most 8 MB together; the editor lists what the set is still missing). A state picker plays each state. Font and mascot files are kept in this browser's IndexedDB beside the draft, so a reload keeps them.
- **Preview** (`/preview`): the editor's draft on a gallery of Studio-shaped components: the sidebar, a page header with the stats bar and filter tabs, the chat ledger (your message, Auto's tool lines and answer, the receipts, a Deliverable card, the composer), cards, a table with status badges, the five button kinds, fields, a modal, toasts and two small charts. They are drawn only with Studio's token names, coloured by the same CSS Studio will generate. Switch the base (Studio or Classic) and the tone (Light or Dark), or turn on "Compare with Studio" to see Studio as it ships beside your skin. Corners follow the skin's radius and the glow shows on focused fields and live states. The page follows the editor as you change the draft in another tab, and loads the draft's own font files.
- **Style sheet** (`/style`): the active Look's colours with their contrast ratios, its type, spacing, radii, components and Auto's 12 ring colours, and a copy of its CSS variables.
- **Examples** (`/examples`): Ember, Daylight, Workshop and Neon to start from. Not built yet (K-008).

The kit needs no running Automatos. Only Load into my Automatos and Submit (K-007) talk to one, through the kit's own server.

## What was retired

Before PRD-004 this repo was Automatos Play, a second interface that rebuilt Studio's pages: the chat, Conversations, the Deliverables shelf, Missions, Agents and Knowledge. Those pages, their components, hooks, client code, proxy routes and tests were removed in K-001: the kit previews a skin on Studio-shaped components instead of rebuilding Studio. They stay in git history (PRs #1 and #3). The last commit that has them is `378e98f`; to read one, for example the chat: `git show 378e98f:components/chat/ChatScreen.tsx`, or restore a folder into a scratch branch with `git checkout 378e98f -- components/chat`.

What the kit kept: the Look engine (`lib/looks/`, `components/looks/`), Auto's mascot player (`lib/mascot/`, `components/mascot/`), the proxy safety code (`lib/server/`), and `skills/build-automatos-interface/` as a reference for anyone building a whole interface.

## Prerequisites

1. **A running local Automatos, to load a skin into.** In your `automatos-ai` folder run `docker compose up` and wait until the backend answers:

   ```sh
   curl http://localhost:8000/api/workspaces/current
   ```

   You should get JSON with an `id`. The local edition (`AUTH_EDITION=local`, the default in `automatos-ai/envs/api.defaults`) needs no login, and the kit sends no credentials. You only need it to load or submit a skin; designing one needs nothing running.
2. **Node.js 22.22.2 or newer** (`node --version`). Or Docker only: see [Run the kit in Docker](#run-the-kit-in-docker).

## Run the kit

```sh
git clone <this repo> automatos-play
cd automatos-play
npm install
cp .env.example .env.local
npm run dev
```

Open **http://localhost:3100**. The editor opens.

`.env.local` holds two settings, both read on the kit's server only (the browser never calls the backend; the kit's own `/api/*` routes forward every request):

| Setting | Default | When to change it |
|---|---|---|
| `AUTOMATOS_BACKEND_URL` | `http://localhost:8000` | Your backend is on another port (`API_PORT` in `automatos-ai`) or host. In a container on the Automatos network it is `http://backend:8000`. |
| `PLAY_ALLOWED_HOSTS` | (empty) | You open the kit on a host name other than `localhost`, `127.0.0.1` or `[::1]`. Comma separated. The kit has no login, so it refuses other host names (a guard against DNS rebinding). |

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

**Auto is a black box.** Your browser got the wrong video file (Safari needs `.mp4`, everything else `.webm`). Check both files exist for that state. Please report it with your browser and version.

**Auto is a placeholder.** The mascot files aren't in `public/auto/` (see [The mascot files](#the-mascot-files)).

## For contributors

- The spec is `docs/prd/PRD-004-SKIN-KIT.md` (the kit). The earlier ones describe what the kit grew from: `docs/prd/PRD-001-FUN-UI-PILOT.md` (the pilot), `docs/prd/PRD-002-LOOKS-POC.md` (Looks) and `docs/prd/PRD-003-MAIN-PAGES.md` (the retired pages). The Look format, its catalogue and the contrast rules: `docs/LOOKS.md`. The API knowledge is `skills/build-automatos-interface/`; `docs/SKILL-GAPS.md` lists where it was wrong during the build.
- Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (CI runs all four).
- Layout: `spec/` (the `automatos-skin/v1` schema), `skins/` (example skin sources), `scripts/` (the `validate` and `pack` CLI), `dist/` (packed `.autoskin` files, git-ignored).
- The manual checks against a real install, and how to record stream fixtures: `docs/RUN-CHECKLIST.md` (its page sections describe the retired pages).

## Licence

Code: Apache-2.0 (see `LICENSE`). The Auto mascot assets are not covered by the code licence and are not in this repository (see `NOTICE`).
