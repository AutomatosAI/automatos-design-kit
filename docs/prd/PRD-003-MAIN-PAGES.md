# PRD-003: The main pages (Missions, Agents, Knowledge, Board, Playbooks, Analytics)

Status: approved by Gerard 14 Oct 2026 ("go ahead on the rest of the pages") · Built in two waves on top of PRD-002 · Local edition only, no change to `automatos-ai`

## 1. Introduction

Play covers chat, conversations and Deliverables, in Ember, with Looks. This PRD adds Studio's other main pages, so Play becomes a full second interface on the same OS:
- **Wave 3:** Missions, Agents and Knowledge.
- **Wave 4:** the Command Center board, Playbooks and Analytics.

Gerard's direction (14 Oct): **no complete redesigns.** Each page keeps Studio's information architecture, so people know where things are, and is built from Play's Ember component kit (the live style page). Auto appears **only where he means something**.

The API knowledge for every page is in `skills/build-automatos-interface/references/` (`missions.md`, `agents-playbooks.md`, `knowledge.md`, `board-analytics.md`), written from the core source on 14 Oct.

## 2. Goals

- Six new pages, consistent with the existing ones, all following the active Look.
- Three reusable page patterns (grid, detail, live run), so the pages share structure and behaviour.
- Auto's mascot driven by real state on the pages where he belongs: a Mission's run, Auto's own crew card, Knowledge uploads and searches, Playbook runs you start, and "Needs you".
- No new load on the backend beyond Studio's own: gentle, visibility-aware polling, and the board's live stream instead of polling.
- Zero changes to `automatos-ai`.

## 3. Design rules (for every new page)

1. **Studio's structure, Play's look.** Use the same sections and the same data as Studio's page, built from the existing components (`ShelfCard`, `TypeBadge`, `DetailPanel`, tool lines, chips, buttons, `PageColumns`) and the Look variables. No new colours, and no literal colours (the existing test enforces this).
2. **Three patterns:**
   - **Grid page:** title, filter chips, search, card grid or list, load more, and the empty, error and loading states.
   - **Detail page:** back link, header (title, chips, actions), main column and side panel.
   - **Live run page:** a header with a state chip and the actions valid for that state, progress, a step list, an activity feed and a mascot slot.
3. **States are words.** Every state is a chip with a glyph and a word (● Running, ◆ Needs you, ✓ Done, ✕ Failed, ‖ Paused, ○ Queued), never colour alone.
4. **Auto only where he means something:**

| Page | Auto |
|---|---|
| Missions list | no |
| Mission run | yes: follows the Mission's state (`missions.md`) |
| Agents | yes: his own lead card, live from the fleet; other agents get no mascot |
| Agent detail | only on Auto's own page |
| Knowledge | yes: reading while uploading, searching while searching, celebrate or oops on the result, and on the empty state |
| Board | no; "Needs you" shows listening while something waits |
| Playbooks | only while a run you started is live |
| Analytics | no |

5. **Poll gently** (skill, "Poll gently"): only what is on screen, only while visible, Mission detail and the fleet at 10 s, lists at 30 s, analytics never. The board uses its live stream.
6. **Every action says what it does** ("Approve plan", "Cancel Mission", "Run now"). Destructive actions confirm in the page (no `confirm()` dialogs). Backend refusals (409, the board's move refusals) show their message in words.

## 4. Navigation

- **Desktop sidebar, grouped:**
  - Talk: Chat, Conversations
  - Work: Missions, Board, Playbooks
  - Crew: Agents
  - Library: Deliverables, Knowledge
  - Insights: Analytics
  - Look

  Counts sit next to items where Studio shows them.
- **Phone:** tabs Chats · Missions · Shelf · More. "More" opens a sheet with the rest, and Look.
- A nav item appears once its page exists: the wave 4 pages are hidden during wave 3 through one flag in `components/shell/nav.ts`.

## 5. Stories

The stories with their full acceptance criteria are in `scripts/ralph/prd.json` for each wave. In summary:
- **Wave 3:**
  - P-001 navigation;
  - P-002 the page patterns, `usePoll` and `StateChip`;
  - P-003 Missions routes and client;
  - P-004 the Missions list;
  - P-005 the Mission run page;
  - P-006 chat suggestion to Mission;
  - P-007 the Agents page;
  - P-008 Agent detail;
  - P-009 Knowledge routes, including the safe upload and download;
  - P-010 the Knowledge page;
  - P-011 docs.
- **Wave 4:**
  - B-001 Board routes and stream;
  - B-002 the live board hook;
  - B-003 the Board;
  - B-004 the Task drawer;
  - B-005 Needs you;
  - B-006 Playbooks;
  - B-007 Analytics;
  - B-008 docs.

## 6. Non-goals

These are for Gerard to revisit, not deferred decisions:
- Marketplace, Team, Settings, Tools and Admin pages.
- Creating or editing agents and Playbooks (Studio keeps these). Agents can be switched on and off; Playbooks can be run.
- The Knowledge Graph view.
- Editing Mission settings beyond the plan review (budgets, concurrency).

## 7. Technical considerations

- **Proxy safety** (skill): Host and `Sec-Fetch-Site` checks on every route; JSON-only bodies except the upload, which requires `X-Play-Upload: 1`; `nosniff` and a sandboxing CSP on every proxied answer; query allowlists per route.
- **Document download:** Play's route asks the backend for `mode=url`. An absolute `https:` URL (S3, presigned) is answered with a 302 to it. Anything else, Play's server fetches from the backend and streams it with the safety headers. The browser never names a backend path.
- **Board stream:** passed through unbuffered, read with `fetch` and a `ReadableStream`, reconnecting with backoff.
- **Charts:** simple SVG components drawn from the Look variables, each with a table fallback. No chart library.
- **Same execution contract as before:** nothing runs locally, CI is the gate, one push per wave.

## 8. Success metrics

- All six pages reachable from the nav, desktop and phone.
- No route polled faster than the skill allows (a unit test checks every `usePoll` interval against the skill's numbers).
- A Mission can be started from chat, approved, watched and finished in Play alone.
- 0 changes to `automatos-ai`.

## 9. Open questions (for Gerard)

1. **`awaiting_human`** Missions have no action route since the review route was removed. Should the core bring one back?
2. Studio's unused `useProcessingStatus` hook would POST `/reprocess` every 5 s if anything used it. Delete it in the core?
3. The Missions routes do blocking database work on the event loop (the AGENTS.md rule). Worth a core fix before more interfaces poll them?
4. The board links Tasks to Missions and Deliverables by id only. Embed titles in the list response?
