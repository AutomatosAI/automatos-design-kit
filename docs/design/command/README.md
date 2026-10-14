# Automatos Command: design package

A voice-first, HUD-style interface for a **local** Automatos install. It shows the idea of one OS with any interface: the same agents, Missions, Deliverables and Auto as Studio and Play, with a different shell.

This README is written for the agent (or person) who builds it. Read it top to bottom before writing code.

## Files

| File | What it is |
|---|---|
| `Automatos Command HUD.dc.html` | **Core** screen: desktop 1440×900 plus phone 390×844. Working **Looks** drawer (click LOOK). |
| `Automatos Command Pages.dc.html` | Static pages C1 Agents (Forge), C2 Missions (Nova), C3 Vault (Ghost), C4 Analytics (Signal), C5 Knowledge (Arc). |
| `Mascot.dc.html` | Auto mascot slot: 12 states, page-drawn ring, `light` / `busy` / `tint` props. |
| `looks.json` | Machine-readable Look schema and the 5 presets. Build the theme system from this. |
| `support.js` | Runtime for the `.dc.html` files. Keep it in the same folder and open the files in a browser. |

To show the mascot, put `auto-hero.png` in this folder. The mascot assets stay out of git until the rights question in PRD-001 is closed.

## Ground rules (same as automatos-play)

- **Own repo:** it never requires a change in `automatos-ai`. If it needs one, write it up as an open question.
- **Proxy only:** the browser never calls the backend directly. Use proxy routes to `AUTOMATOS_BACKEND_URL` (default `http://localhost:8000`). No secrets in the page, and never `ORCHESTRATOR_API_KEY`.
- **API knowledge:** comes from `skills/build-automatos-interface/` only. When the core and the skill disagree, the core wins: fix the skill and log it in `docs/SKILL-GAPS.md`.
- **Fonts:** vendor them with `next/font/local`: Rajdhani, Chakra Petch, Geist, Geist Mono. Never `next/font/google`.
- **Deliverables list:** check `success`. It can return HTTP 200 with `success: false`.
- **Words:** "Auto" is a name. Say "Deliverable" (never "file", "output" or "artifact") and "Mission" (never "workflow" or "job"). The HUD uses UPPERCASE mono for labels only; sentences stay in sentence case.

## Theme system ("Looks")

One Look applies to every page. A Look is a small object (see `looks.json`):

```json
{ "ground": "void", "accent": "arc", "font": "raj", "grid": 14, "glow": 22, "scan": true, "auto": true, "motion": true }
```

Derived CSS variables. Compute them once at the root; every component reads only these:

| Variable | Derivation |
|---|---|
| `--bg` | `ground.bg` |
| `--accent` / `--accent-ink` | `accent.hex` / `accent.ink` (button text on the accent) |
| `--accent-line` | accent at 45% alpha (borders of live things) |
| `--accent-fill` | accent at 12% alpha (selected / pressed fills) |
| `--panel-fill` | accent at 3.5% alpha |
| `--grid` | accent at `grid/300` alpha, 40px squares (32px on phone) |
| `--glow` | accent at `glow/100` alpha. A radial behind the core (640×520 at 50% 46%). |
| `--text` / `--text-2` | fixed `#E6F1F5` / `#93A6AF` (keeps AA on every ground) |
| `--line` / `--track` | fixed `rgba(230,241,245,.10)` / `.08` |
| `--error` | fixed `#FF6B6B`. Never themeable. |

- **Display font:** used for brand, panel labels and big numbers. Body text is always Geist and mono labels are always Geist Mono.
- **Scanlines:** an overlay of `repeating-linear-gradient(0deg, rgba(0,0,0,.18) 0 1px, transparent 1px 3px)` with `pointer-events:none`.
- **Saved looks:** saved to `localStorage` key `automatos-command.looks` as an array, and the active id to `automatos-command.look`. This needs no change in the core.
- **Reduced motion:** `prefers-reduced-motion: reduce` forces `motion:false` whatever the Look says.

## Layout system

- **Frame:** a 56px top bar, then the content area with 20–24px padding and 16–20px gaps.
- **Top bar:**
  - A diamond mark (10px square rotated 45°, 1.5px accent border plus glow) and `AUTOMATOS // COMMAND`.
  - Nav tabs CORE · AGENTS · MISSIONS · VAULT · ANALYTICS · KNOWLEDGE in Geist Mono 12px, letter-spacing .14em. The active tab is accent-coloured with a 2px inset bottom bar.
  - On the right, the clock and mic state, with `white-space: nowrap`.
- **Panel (the one container):**
  - Fill is `--panel-fill` with a 1px border at accent 14–20% alpha.
  - Corner brackets are 14px × 1.5px L-shapes on the top-left and bottom-right, drawn with background gradients.
  - The header row is the display font at label size, letter-spacing .2em, in `--text-2`, with a right-aligned value.
  - A selected or live panel gets a 1.5px accent border plus a soft accent glow.
- **Status:** always a glyph plus a WORD (● ROUTING, ○ QUEUED, — IDLE, ◆ WATCHING, ✓, ▸, ✕). Never colour alone.
- **Buttons:**
  - Primary is solid `--accent` with `--accent-ink` text.
  - Secondary is a 1px accent-line outline.
  - Labels are Geist Mono 12px uppercase, tracked .14em. Height is 44px minimum (46px in panels).
- **Radii:** 0 everywhere. HUD panels are square. Circles are used only for the core, gauges and the donut.

## Screens and their data

All data comes through the proxy. The endpoint names below are concepts; resolve the exact routes from the skill.

### Core (voice)
- **Voice core:** 420px desktop, 290px phone.
  - Built from concentric rings: tick ring 60s, arc 7s, segmented ring 16s reverse, dashed 30s, inner arc 5s reverse, pulse 2.4s.
  - Auto's mascot sits in the centre when `auto:true`, with `light`/`busy` set to the accent.
  - Under the core, a state chip names the state in words ("SEARCHING THE WEB").
- **Transcript:**
  - YOU and AUTO rows. AUTO streams with a blinking block cursor.
  - Source: the chat stream for the current conversation. Tool events map to the state chip and the agent panel.
- **Waveform:** 72 bars desktop, 44 phone. Live mic level while held; idle shimmer while Auto speaks.
- **Voice rules:**
  - Push-to-talk only: hold Space, or the HOLD TO TALK button on the phone.
  - "MIC LIVE" is visible whenever the mic is open.
  - "Auto, stop" or the STOP button cancels the turn (same as Studio's Stop).
  - Typing is always available.
  - Use the browser speech APIs for the pilot; no audio leaves the machine except to the user's chosen model route.
- **Left panels:**
  - AGENTS: agent list with status, detail line and progress.
  - MISSION: the active Mission's steps (✓ / ▸ / ○) and elapsed time.
- **Right panels:**
  - SPEND · 7 DAYS: analytics cost per day, today highlighted, plus the free-route share.
  - LATENCY · LAST HOUR: per-request latency line and the top 3 model routes with price tier and latency.
  - THIS MACHINE: CPU/MEM/GPU gauges. **These need a local metrics source.** If the core has none, hide the panel; it's an open question, not a core change.
  - DELIVERABLES: the newest 2–3, with live state ("WRITING…").

### C1 Agents (shown in Forge)
- **Agent grid:** 3×2 cards.
  - Each card shows name, `● STATUS`, role, model route (e.g. "Kimi K3 · NVIDIA (free)"), an 8-day activity sparkline, tasks today and success %.
  - Session agents (your own Claude Code) have a dashed border and show the workspace path, "PLAN · tokens" instead of $, and OPEN CANVAS.
- **Filter chips:** ALL / API / SESSION.
- **Detail panel:** persona line, a 5-axis skill radar (SEARCH, READ, ANALYSE, WRITE, CODE; derived from installed skills and outcomes), tokens and cost today, skill chips, and ASSIGN TASK (files a board ticket) / EDIT.

### C2 Missions (shown in Nova)
- **Board counts:** INBOX · ASSIGNED · IN PROGRESS · REVIEW · DONE TODAY. In progress is highlighted.
- **Agent timeline:** 09:00–18:00, one lane per agent.
  - Bars: solid accent = running, 35% fill = done, dashed = planned. ◇ marks a heartbeat.
  - A NOW line shows the current time, with its label under the lanes.
- **Active Mission panel:** prompt, steps with the owning agent, ETA, cost so far, OPEN MISSION / PAUSE.
- **NEEDS YOU:** approval cards from session agents (ALLOW / DENY). This maps to the permission questions Studio shows as approval cards.
- **SCHEDULED:** calendar items (heartbeats, scheduled board tasks).

### C3 Vault (shown in Ghost)
- **Table:** NAME · TYPE · MADE BY · SIZE · MADE from the Deliverables list, with filters ALL / REPORTS / DOCUMENTS / IMAGES / SPREADSHEETS / SLIDES / CODE.
- **Search:** "/ search the vault" uses the Deliverables search, not RAG.
- **Preview:** shows the selected Deliverable with source chat, sources count, Mission time and cost. Buttons are OPEN, ASK AUTO (starts a chat with the Deliverable attached) and REVEAL (opens it in Deliverables → Explorer, i.e. `AUTOMATOS_WORKSPACE_DIR`).

### C4 Analytics (shown in Signal)
- **KPIs:** this month, projected month end, free-route share, cache reads with the saving.
- **COST BY ROUTE · 30 DAYS:** one line per route. Free routes are dashed at $0.
- **BY PROVIDER:** donut. NVIDIA (free) and Claude Code (plan) are listed at $0.00, never hidden.
- **SPEND BY LANE:** chat, Missions, board, retrieval, heartbeats.
- **BY AGENT:** session agents show "PLAN · tokens", never a dollar figure they didn't spend. Failed-calls count in the header.

### C5 Knowledge (shown in Arc)
- **Sources:** list with chunk counts and sync state. The tabs GRAPH / CODE / MEMORY match the core's Knowledge tabs.
- **Graph:** entities and links from the Knowledge Graph.
  - The selected node is solid accent with a dashed orbit, and its edges are drawn in solid accent.
  - Has ZOOM − / ZOOM + / RE-CENTRE.
- **Entity panel:** type, description, relations (PART OF / DEFINED BY / USED IN / SEEN IN with page ref), confidence bar with source agreement. Buttons are QUIZ ME ON THIS (a chat prompt) and ASK AUTO.

## Mascot contract

`<Mascot state size light busy tint>`:
- **States:** hello, idle, listening, thinking, working, searching, reading, celebrate, oops, sleeping, lost, loading.
- **Ring colour:**
  - Calm states (hello, idle, listening, celebrate) use `light`.
  - Busy states (thinking, working, searching, reading) use `busy`.
  - oops is coral, sleeping and lost are dusk, loading is violet.
- **Tint:** a CSS filter on the video (shell recolour).
- **Video:** `.webm` (VP9 alpha) everywhere, `.mp4` (HEVC alpha) for Safari and iOS. The wrong one shows a black box.

## Accessibility

- Text contrast is AA or better on every ground, because text colours are fixed rather than themeable.
- Every animated signal has a text twin: state chip, status words, transcript.
- Focus ring: 2px accent outline with a 2px offset on every control.
- Tap targets are 44px minimum.
- The mic never opens without a press, and MIC LIVE is always visible while it does.

## Open questions

1. A local machine-metrics source for THIS MACHINE (hide the panel without one).
2. Exact proxy routes for agent activity sparklines and the latency series.
3. Speech-to-text and text-to-speech provider for the pilot: the browser built-in, or a route in the provider registry?
4. Looks sharing via the Marketplace (see the proposal below).

## Proposal: Automatos Play as a UI kit and Marketplace category

**Idea:** Play becomes the kit. People design an interface or a Look and publish it to the Marketplace, and others sync it and use it as their front end.

**Two publishable things:**
- **Looks:** a JSON object like `looks.json`. It's data only, so it's safe, tiny and reviewable. Ship this first.
- **Interfaces:** a full front end (Play, Command, Studio). This is code, so it needs a sandbox, permissions ("reads chat, reads Deliverables, files tickets"), signing and review.

**Why it fits:** the Marketplace already ships agents, skills, widgets and workspace templates, so "interfaces" is a natural fifth shelf. The interface talks only to the API through the proxy, so an interface can never need a core change.
