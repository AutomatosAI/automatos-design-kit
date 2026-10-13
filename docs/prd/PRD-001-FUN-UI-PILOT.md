# PRD-001: Automatos Play, a fun second interface on the local OS (pilot)

Status: draft for review · 13 Oct 2026 · Repo: `automatos-play` (working name, local only, not pushed)

## 1. Introduction

Automatos is a headless OS: the backend does the work and Studio is the interface everyone uses today. The claim "one OS, any interface" has no proof yet, because Studio is the only interface there is.

This pilot builds a second one: **Automatos Play**, a playful web UI aimed at younger open-source users, with **Auto** as an animated 3D mascot that reacts to what Auto is actually doing. It runs next to a local install (`AUTH_EDITION=local`, `docker compose up`), lives in its own repo, and changes **nothing** in `automatos-ai`.

It is also a test of the build skill: Play is built **only from** `skills/build-automatos-interface/`, so every gap in the skill is a gap in what an outside developer can learn about the API.

Studio stays the default. Play is an experiment, for the local edition only.

## 2. Goals

- A second working interface on the same OS, with **zero changes** to `automatos-ai`.
- Chat with Auto, with streaming text, tool activity, receipts and errors, through the existing `POST /api/chat`.
- The mascot's 12 states driven by real stream events, with seamless switching between clips.
- A Deliverables shelf showing what Auto has made.
- An open-source user can run Play next to their local install in under 10 minutes, following the README.
- The build skill is accurate: every place it was wrong or missing is fixed in the skill during the build.

## 3. User stories

### Part 1: Foundations

#### US-001: Repo scaffold
**Description:** As a contributor, I want a small, standard project so I can build and check it the same way every time.

**Acceptance criteria:**
- [ ] Next.js 15 (App Router) + TypeScript (strict) + vitest + ESLint; `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` all exist.
- [ ] A GitHub Actions workflow runs those four on every push and pull request (it takes effect once the repo is pushed).
- [ ] Fonts are self-hosted with `next/font/local`; no `next/font/google` (it broke `next build` in the core).
- [ ] Apache-2.0 `LICENSE` for the code. Mascot assets carry a separate notice (see Open questions).

#### US-002: Backend proxy routes
**Description:** As a user, I want Play to reach my local Automatos without CORS changes or secrets in the page.

**Acceptance criteria:**
- [ ] Server routes forward to `AUTOMATOS_BACKEND_URL` (default `http://localhost:8000`): `POST /api/chat` (streamed straight through), `POST /api/chat/[id]/cancel`, `GET /api/chat/history`, `GET /api/chat/[id]/messages`, `GET /api/workspace` (→ `/api/workspaces/current`), `GET /api/deliverables`, `GET /api/deliverables/[id]`, `GET /api/deliverables/[id]/thumbnail`.
- [ ] Each route forwards `X-Workspace-ID`, the query string and the JSON body, and returns the backend status code unchanged.
- [ ] No `Authorization` header and no `ORCHESTRATOR_API_KEY` anywhere in the repo.
- [ ] When the backend is unreachable, the route returns 502 with `{error: "Automatos isn't running at <url>"}`, and the UI shows it as a friendly message.
- [ ] Unit tests cover header forwarding and the 502 path, with a mocked backend.
- [ ] Typecheck and lint pass.

#### US-003: Stream parser
**Description:** As a developer, I want the chat stream turned into typed events so the chat and the mascot read the same thing.

**Acceptance criteria:**
- [ ] A pure function turns chunks into events for `0:`, `d:`, `e:` and `data:` lines, as specified in `references/chat-stream.md`. It keeps partial lines across chunks.
- [ ] Handles the top-level fields of `chat-id`, `finish` and `agent-info`, and the `data` payload of every other type.
- [ ] Ignores unknown types and malformed lines without throwing.
- [ ] Tests run over at least four recorded fixtures: a plain answer, a tool call, an error, and an ask (`waiting: true`). They include a split across chunk boundaries.
- [ ] Typecheck and lint pass.

#### US-004: Mascot state reducer
**Description:** As a user, I want the mascot to match what Auto is doing.

**Acceptance criteria:**
- [ ] A pure reducer `(state, event) => state` implements the table, tool-name lists and priority order in `references/mascot-states.md`.
- [ ] The tool-name lists live in one config file.
- [ ] Tests replay the recorded fixtures and assert the state sequence, e.g. plain answer: `thinking → idle`; tool call: `thinking → working → idle → celebrate`; error: `thinking → oops`.
- [ ] Typecheck and lint pass.

### Part 2: The interface

#### US-005: Mascot player
**Description:** As a user, I want Auto to move smoothly between states, never jumping or flickering.

**Acceptance criteria:**
- [ ] Plays `.mp4` in Safari and iOS browsers and `.webm` everywhere else, from `public/auto/`.
- [ ] Queues a new state and swaps at the clip boundary. `oops` and `hello` swap at once. A loop state holds for at least one full clip.
- [ ] Draws the light ring in CSS, with its colour set per state.
- [ ] With reduced motion on, shows the state's PNG and plays no video.
- [ ] Verify in a browser against a local install: Chrome and Safari both show Auto with a transparent background (no black box) on a light and a dark background.

#### US-006: Chat screen
**Description:** As a user, I want to talk to Auto in a fun, clear chat.

**Acceptance criteria:**
- [ ] Sends with the request body in `references/chat-stream.md`, and keeps the `chat-id` for later messages.
- [ ] Streams Auto's text as it arrives. Model output is rendered as text or sanitised markdown, never raw HTML.
- [ ] Shows one line per tool call (from `tool-start` and `tool-end`), the `receipts` list at the end of a turn, `narration` and `progress` as muted lines, and errors in words.
- [ ] A Stop button cancels the turn (`POST /api/chat/{id}/cancel` and aborts the fetch).
- [ ] The mascot sits beside the chat and follows the reducer.
- [ ] Verify in a browser against a local install: "hello" streams an answer; a request that runs a web search shows `searching`; stopping mid-answer works.

#### US-007: Conversations
**Description:** As a user, I want to go back to earlier chats.

**Acceptance criteria:**
- [ ] A list from `GET /api/chat/history` shows title, last message preview and time.
- [ ] Opening one loads `GET /api/chat/{id}/messages` and continues that conversation.
- [ ] A "New chat" button starts one.
- [ ] Verify in a browser against a local install.

#### US-008: Deliverables shelf
**Description:** As a user, I want to see what Auto has made for me.

**Acceptance criteria:**
- [ ] A card grid from `GET /api/deliverables` (heartbeat outputs hidden by default) shows thumbnail, title, type and date. Filter chips by `artifact_type`. "Load more" pages with `offset`.
- [ ] `success: false` shows an error state, never "nothing here yet".
- [ ] Opening a card shows the detail: text and markdown inline (`include_content=true`), images full size, everything else by `preview_url` when it is set.
- [ ] A Deliverable that appears while the shelf is open plays `celebrate` once.
- [ ] Verify in a browser against a local install.

#### US-009: Visual identity
**Description:** As a younger user, I want Play to feel fun but not childish.

**Acceptance criteria:**
- [ ] Theme tokens (colour, type, spacing, radius) live in one CSS file; components use the tokens, not literal colours.
- [ ] Usable at 390 px wide, with no horizontal scroll.
- [ ] Focus states are visible, and contrast is at least WCAG AA for text.
- [ ] Copy uses the canonical terms: Auto, Deliverable, Mission.
- [ ] Verify in a browser at phone and desktop widths.

#### US-010: The small pages
**Description:** As a user, I want the edges of the app to have Auto's personality too.

**Acceptance criteria:**
- [ ] `hello` plays on the first open in a browser session.
- [ ] The 404 page shows `lost`.
- [ ] `loading` shows while the first data loads or a route takes longer than 300 ms.
- [ ] `sleeping` shows after 3 minutes without input, and when the backend is unreachable, with a "Start Automatos" hint and the command.
- [ ] Verify in a browser against a local install.

### Part 3: Proof

#### US-011: Setup for open-source users
**Description:** As an open-source user, I want to run Play next to my Automatos in minutes.

**Acceptance criteria:**
- [ ] The README covers: prerequisites (a running local install), `npm install`, `AUTOMATOS_BACKEND_URL`, `npm run dev` on port 3100, and the troubleshooting cases (backend down, wrong port, workspace 400).
- [ ] An optional `docker-compose.yml` runs Play on the core's `automatos_network` with `AUTOMATOS_BACKEND_URL=http://backend:8000`, without editing the core's compose file.
- [ ] A fresh run, following only the README, works in under 10 minutes (Gerard's run).

#### US-012: Skill accuracy log
**Description:** As the maintainer, I want to know where the build skill misled the builder.

**Acceptance criteria:**
- [ ] `docs/SKILL-GAPS.md` lists every place the skill was wrong, missing or unclear during the build, each with the fix.
- [ ] Each fix lands in `skills/build-automatos-interface/` in the same change.
- [ ] No change made to `automatos-ai`. A needed core change is written up as an open question for the maintainer, not patched.

## 4. Functional requirements

- FR-1: Play must reach the backend only through its own server routes. The browser never calls `AUTOMATOS_BACKEND_URL`.
- FR-2: Play must send `X-Workspace-ID` from `GET /api/workspaces/current` on every backend call.
- FR-3: Play must parse the chat stream with one shared parser used by both the chat and the mascot.
- FR-4: The mascot state must follow `references/mascot-states.md`, including priority and switching at the clip boundary.
- FR-5: Every mascot state must have a text equivalent on screen.
- FR-6: Play must treat stream lines and Deliverable content as untrusted: no HTML injection, no `eval`.
- FR-7: Play must keep working when the backend adds unknown event types.
- FR-8: Play must show a clear message when the backend is down, the workspace can't be resolved, or a list call returns `success: false`.

## 5. Non-goals

The pilot leaves out the items below. Each is a choice for Gerard to revisit, not a deferral.

- The hosted (SaaS) edition and any login.
- Starting or managing Missions (a `mission-suggestion` shows as a hint only).
- Document upload, voice, Playbooks and settings.
- Any change to Studio or the core repo.
- A Marketplace listing for Play.
- A native mobile app.

## 6. Design considerations

- The mascot assets are in `public/auto/`: 12 states × (WebM, MP4, PNG), 4.5 MB in total. The concept page is `mascot/preview/index.html`, and the live version is the Motion Kit artifact.
- Layout idea: Auto stays visible beside the chat on desktop and above the message box on phones. The Deliverables shelf is a second tab.
- Fun, not childish: bold display type, a deep night background with bright accents. Avoid toy-like rounded-everything.
- The mascot never blocks text, and the chat must be fully usable with the mascot hidden.

## 7. Technical considerations

- Auth: the local edition forces `REQUIRE_AUTH` off (`automatos-ai/orchestrator/config.py:204-209`). A request with no credentials becomes the local operator (`core/auth/hybrid.py:1003-1026`).
- CORS: not involved, because the proxy is same-origin. The backend's `CORS_ALLOW_ORIGINS` stays untouched.
- Streaming: the proxy must pass the body through without buffering (see the core's `frontend/app/api/chat/route.ts`).
- Ports: the backend binds `127.0.0.1:8000` by default (`API_PORT`); Studio is on 3000; Play takes 3100.
- Browser alpha: VP9 alpha for Chromium and Firefox, HEVC alpha for Safari. Choose by browser, not by `canPlayType`.
- The skill is the only spec for the API. When the code and the skill disagree, the code wins, and the skill is fixed (US-012).

## 8. Success metrics

- 0 lines changed in `automatos-ai`.
- An open-source user is running in under 10 minutes from the README.
- The mascot reducer produces the expected state sequence on 100% of the recorded fixtures.
- 0 black-box (lost alpha) renders in Chrome and Safari.
- Every skill gap from the build is logged and fixed (US-012). The count itself is the finding.
- The first screen is interactive in under 2 s on a local install, with the mascot assets under 5 MB.

## 9. Open questions

1. **Mascot rights.** The hero image came from Higgsfield's free plan (Nano Banana Pro) and the clips from the paid API (Kling 3.0 Pro). Do both plans' terms allow use in a public open-source repo and in marketing? Check before pushing anywhere public.
2. **Mascot licence.** Should the code be Apache-2.0 and the mascot assets a separate trademark notice ("Auto and the Auto mascot are trademarks of Automatos AI Ltd")?
3. **The hosted edition later** needs a scoped key the core chat, Mission and Deliverable routes accept. Today only `/api/widgets/*` takes workspace keys (`core/auth/hybrid.py:699-706`). This is a core change, and Gerard's call.
4. **One event schema.** Should the core publish a single list of stream event types? The strings in `streaming.py` and the enum in `core/models/stream_events.py` disagree today.
5. **A `talking` clip.** Text streaming has no clip of its own (the reducer uses `idle`). Worth one more $0.56 clip?
6. **Weak clips.** listening, working and oops barely move. Re-render them (about $1.70)?
7. **Name.** Automatos Play, or something else?
8. **Marketplace.** List Play later as the first item in an "Interfaces" category?

## 10. Testing plan

- CI (once the repo is pushed): typecheck, lint, unit tests (proxy, parser, reducer), build.
- Recorded fixtures from a test-data workspace, read before committing (they contain everything Auto said).
- Gerard's local run, against `docker compose up` in `automatos-ai`: the browser checks in US-005 to US-011, in Chrome and Safari, at phone and desktop widths.
- No new night runs: this is a pilot and doesn't touch the core.

## Related

- Skill: `skills/build-automatos-interface/` (SKILL.md and `references/`)
- Mascot pipeline: `mascot/README.md`
- Core files the skill relies on: `automatos-ai/orchestrator/api/chat.py`, `consumers/chatbot/streaming.py`, `consumers/chatbot/receipts.py`, `api/deliverables.py`, `core/auth/hybrid.py`, `frontend/app/api/chat/route.ts`, `frontend/lib/chat/hooks.ts`
