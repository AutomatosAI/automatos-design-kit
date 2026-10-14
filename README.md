# Automatos Play

A fun second interface for your local Automatos, with Auto as an animated mascot that reacts to what Auto is doing: thinking, searching the web, reading your documents, making a Deliverable.

Play is a pilot. Studio stays your main interface. Play works with the **local edition** of Automatos only (`docker compose up` in `automatos-ai`, no accounts), and changes nothing in Automatos itself.

- Chat with Auto, watch tool calls and receipts as they happen, and stop an answer.
- Reopen your conversations.
- Browse the Deliverables shelf and open a Deliverable.
- Run **Missions** (`/missions`): start one from a goal or from Auto's suggestion in a chat, review and approve its plan, watch it run step by step with Auto following along, pause, resume, cancel or replan it, and open its Deliverables.
- Meet your crew on the **Agents** page (`/agents`): Auto leads, every agent shows its live state, runtime and model, and you can switch an agent off and on. An agent's page (`/agents/<id>`) has its skills, tools and performance, and Chat with opens a chat with that agent.
- Give Auto documents on the **Knowledge** page (`/knowledge`): upload PDF, Word, text, Markdown, CSV, HTML, JSON or Excel files up to 50 MB, search them, and open, download or delete one (`/knowledge/<id>`).
- The sidebar groups the pages (Talk, Work, Crew, Library, Look); on a phone the tab bar has Chats, Missions, Shelf and More.
- Make it yours: the **Looks page** (`/looks`, Look in the sidebar) re-themes the whole app live: background, accent, type, Auto's shell and light, and the glow. Start from five presets (Ember is the default), save your own, and export or import them as `.look.json` files. Looks are kept in your browser only.
- See the numbers: the **style page** (`/looks/style`, "See the style sheet" on the Looks page) shows the active Look's colours with their contrast ratios, its type, spacing, radii, components and Auto's 12 ring colours, and copies its CSS variables.

## Prerequisites

1. **A running local Automatos.** In your `automatos-ai` folder run `docker compose up` and wait until the backend answers:

   ```sh
   curl http://localhost:8000/api/workspaces/current
   ```

   You should get JSON with an `id`. The local edition (`AUTH_EDITION=local`, the default in `automatos-ai/envs/api.defaults`) needs no login, and Play sends no credentials.
2. **Node.js 22.22.2 or newer** (`node --version`). Or Docker only: see [Run Play in Docker](#run-play-in-docker).

## Run Play

```sh
git clone <this repo> automatos-play
cd automatos-play
npm install
cp .env.example .env.local
npm run dev
```

Open **http://localhost:3100**. Auto says hello.

`.env.local` holds two settings, both read on Play's server only (the browser never calls the backend; Play's own `/api/*` routes forward every request):

| Setting | Default | When to change it |
|---|---|---|
| `AUTOMATOS_BACKEND_URL` | `http://localhost:8000` | Your backend is on another port (`API_PORT` in `automatos-ai`) or host. In a container on the Automatos network it is `http://backend:8000`. |
| `PLAY_ALLOWED_HOSTS` | (empty) | You open Play on a host name other than `localhost`, `127.0.0.1` or `[::1]`. Comma separated. Play has no login, so it refuses other host names (a guard against DNS rebinding). |

For a production build: `npm run build`, then `npm start` (also on port 3100).

## The mascot files

The Auto animations are not in this repository (see `NOTICE`). Without them Play shows a placeholder where Auto stands, and everything else works.

If you have them, put them in `public/auto/` (git-ignored), three files per state:

```
public/auto/<state>.webm   VP9 with alpha: Chrome, Edge, Firefox
public/auto/<state>.mp4    HEVC with alpha: Safari and every iOS browser
public/auto/<state>.png    transparent still: the poster, and what shows under reduced motion
```

The 12 states: `hello`, `idle`, `listening`, `thinking`, `working`, `searching`, `reading`, `celebrate`, `oops`, `sleeping`, `lost`, `loading`. Restart is not needed: reload the page.

## Run Play in Docker

Optional. `docker-compose.yml` runs Play in a container on the Docker network the Automatos compose file creates (`automatos_network`), with `AUTOMATOS_BACKEND_URL=http://backend:8000`. Nothing in `automatos-ai` changes.

```sh
# 1. In automatos-ai: start Automatos first, it creates the network.
docker compose up -d

# 2. In automatos-play:
docker compose up
```

Open **http://localhost:3100**. The first start runs `npm install` inside the container and takes a few minutes. The port is bound to `127.0.0.1` only; set `PLAY_PORT` to use another one. The mascot files are read from your `public/auto/`.

## Troubleshooting

**"Automatos is asleep" (the backend is down).** Play can't reach `AUTOMATOS_BACKEND_URL`; the screen shows the address it tried. Start Automatos (`docker compose up` in `automatos-ai`) and press Check again, or wait: Play checks every 10 seconds. If Automatos is running:
- Check the URL: `curl <AUTOMATOS_BACKEND_URL>/api/workspaces/current`.
- Play in Docker must use `http://backend:8000`, not `localhost` (inside a container, `localhost` is the container).
- Play on your machine with Automatos in Docker uses `http://localhost:8000`. The backend publishes its port on `127.0.0.1` only (`BIND_ADDRESS`), so use the same machine.
- `docker compose up` for Play says `network automatos_network declared as external, but could not be found`: start Automatos first.

**Wrong port.**
- `npm run dev` says port 3100 is in use (`EADDRINUSE`): stop what holds it (`lsof -i :3100`), or run Play on another port with `npx next dev -p 3200`.
- Your backend isn't on 8000 (you set `API_PORT` in `automatos-ai`): set `AUTOMATOS_BACKEND_URL=http://localhost:<API_PORT>` in `.env.local` and restart `npm run dev`.
- Every request fails with "Open Play at http://localhost:3100" (HTTP 403): you opened Play on another host name. Use `localhost`, or add the name to `PLAY_ALLOWED_HOSTS`.
- Don't point `AUTOMATOS_BACKEND_URL` at Studio (port 3000): Studio is a web page, not the API.

**Workspace 400.** Pages say they couldn't load, and the browser console shows `[api] /api/workspace failed with 400` with the backend's reason. Play asks `GET /api/workspaces/current` with no credentials, so the backend must resolve its one local workspace by itself:
- `Workspace not resolved. Send X-Workspace-ID header or configure DEFAULT_WORKSPACE_ID.`: the backend runs without login but not as the local edition, and has no default workspace. Set `AUTH_EDITION=local` (the default in `automatos-ai/envs/api.defaults`, which also sets `DEFAULT_WORKSPACE_ID`); check your `automatos-ai/.env` doesn't override either, then restart the backend.
- `Invalid workspace_id`: `DEFAULT_WORKSPACE_ID` names a workspace the database doesn't have. In the local edition the backend creates it when it starts; restart the backend and look for `Ensuring local workspace` in its log.
- HTTP 401 or 403 instead of 400: the backend expects a login, so it isn't the local edition. Play has no login.

**Auto is a black box.** Your browser got the wrong video file (Safari needs `.mp4`, everything else `.webm`). Check both files exist for that state. Please report it with your browser and version.

**Auto is a placeholder.** The mascot files aren't in `public/auto/` (see [The mascot files](#the-mascot-files)).

**A document won't download in Docker** ("Automatos couldn't hand over that file"). The local edition stores documents in MinIO and hands Play a link to `http://localhost:9000`. Play's server fetches that link for you, which works when Play runs on your machine. Inside a container, `localhost` is the container, and the link is signed for that exact address, so Play can't swap it for `minio:9000`. Run Play with `npm run dev` to download documents; everything else works in Docker.

## For contributors

- The specs are `docs/prd/PRD-001-FUN-UI-PILOT.md` (the pilot), `docs/prd/PRD-002-LOOKS-POC.md` (Looks) and `docs/prd/PRD-003-MAIN-PAGES.md` (Missions, Agents, Knowledge, and the pages still to come). The Look format, its catalogue and the contrast rules: `docs/LOOKS.md`. The API knowledge is `skills/build-automatos-interface/`; `docs/SKILL-GAPS.md` lists where it was wrong during the build.
- Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (CI runs all four).
- The manual checks against a real install, and how to record stream fixtures: `docs/RUN-CHECKLIST.md`.

## Licence

Code: Apache-2.0 (see `LICENSE`). The Auto mascot assets are not covered by the code licence and are not in this repository (see `NOTICE`).
