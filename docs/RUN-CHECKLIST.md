# Run checklist: Play against a real local Automatos

> **PRD-004 (Skin Kit):** the chat, Conversations, Deliverables, Missions, Agents and Knowledge pages were retired in K-001 (they stay in git history at `378e98f`). Their sections below describe that code and no longer apply to the kit. The Looks checks still apply: the Looks page is now the Editor at `/`, and the style page is `/style`.

CI proves the parser, the reducer and the screens against synthetic data. It can't see a browser, a video's alpha channel or a real backend. These checks are Gerard's local run (PRD-001, "Testing plan"). Tick them in a copy of this file or in the PR; anything that fails goes in the PR as a finding.

## Before you start

1. In `automatos-ai`: `docker compose up -d`. Wait until `curl http://localhost:8000/api/workspaces/current` answers JSON.
2. Use a workspace with **test data only**: the checks below send messages, make Deliverables, start Missions, switch agents off and on, and upload and delete documents in it.
3. In this repo: the mascot files are in `public/auto/` (12 states × `.webm`, `.mp4`, `.png`), then `npm install`, `cp .env.example .env.local`, `npm run dev`.
4. Open http://localhost:3100 in Chrome, and later in Safari. Auto says hello once per browser session: open a new window to see it again.

Time the fresh run from step 3 (PRD success metric: under 10 minutes following only the README).

## Checks

### Auto has no black box (Chrome and Safari)

- [ ] **Chrome, dark ground.** On the first open, Auto plays hello with no square behind it: the dark page shows through around its outline. Chrome loads `.webm` (DevTools > Network, filter `auto/`).
- [ ] **Chrome, light ground.** In the DevTools console run `document.querySelectorAll("video").forEach((v) => { v.parentElement.style.background = "white"; })`. Still no square, no dark fringe.
- [ ] **Safari, dark ground.** Same as Chrome; Safari loads `.mp4` (Web Inspector > Network).
- [ ] **Safari, light ground.** Same console line in the Web Inspector.
- [ ] **iPhone Safari (optional).** See "Phone width" for how to reach Play from a phone. Auto loads `.mp4`, no black box.
- [ ] **Reduced motion.** Turn on "Reduce motion" (macOS: System Settings > Accessibility > Display), reload: Auto is a still picture, the caption under it still changes.

### "hello" streams

- [ ] Type `hello` and press Enter. Your bubble appears at once; Auto goes to thinking (the caption says so).
- [ ] Auto's answer appears word by word, not all at the end. If it arrives in one block, something buffers the stream: note the browser and whether Play runs in Docker.
- [ ] When the first words arrive Auto goes back to idle, and the cursor at the end of the answer disappears when it finishes.
- [ ] The conversation appears under Recent in the sidebar and on the Conversations page; opening it there shows the same messages.

### A web search shows searching

- [ ] Ask `Search the web for the latest news about electric bikes`. A tool line says Auto is searching the web (with the query), and Auto plays searching (the ring in the accent, molten in Ember; caption "Searching the web").
- [ ] The tool line turns done with its time; Auto goes back to idle, then celebrates on finish if a receipt says done.
- [ ] "What Auto did" lists the receipts once (not twice).

### Stop works

- [ ] Ask for something long (`Write a 2,000-word story about a lighthouse`). Press Stop while words are streaming.
- [ ] The words stop, the reply says "You stopped this answer.", and Auto leaves thinking.
- [ ] Send another message right away: it streams normally (the backend took the cancel). In the backend log, the first turn was cancelled, not finished.

### The shelf and detail load

- [ ] Ask `Write a one-page report about electric bikes as a document`. Auto works, then celebrates; a Deliverable card appears in the reply with Open.
- [ ] Open goes to the Deliverable: title, type badge, date, "Made by Auto…", and the content rendered as text (headings, lists, tables), no raw HTML.
- [ ] Ask Auto about this opens a new chat with the box filled in.
- [ ] The shelf (`/deliverables`) shows the new one first, with a thumbnail or a type-coloured tile. Auto celebrates once for it, not again on reload.
- [ ] The type chips filter the shelf; Load more appears when you have more than one page.
- [ ] Open a PDF or spreadsheet Deliverable if you have one: "Play can't preview this … here." with Download the file, and the download opens the right file.
- [ ] Open an image Deliverable if you have one: the picture shows full width.

### The not-running screen

- [ ] In `automatos-ai`: `docker compose stop backend`. Reload Play: the "Automatos is asleep" screen, Auto sleeping, the command `docker compose up` with Copy (pastes correctly), and the line "Automatos isn't running at http://localhost:8000".
- [ ] `docker compose start backend`. Within about 10 seconds of the backend answering, Play comes back on its own (or press Check again).
- [ ] Stop the backend again while a chat is open (no reload): the next message ends in "I hit a snag" saying Automatos isn't running, and Auto sleeps. Start it again; Try again works.

### Phone width

- [ ] DevTools device toolbar at 390 px wide (iPhone 14): no sideways scrolling on the chat, Conversations, the shelf, a Deliverable, Missions and a Mission run (Auto above the steps), Agents and an agent, Knowledge and a document, the asleep screen and the 404.
- [ ] Chat: the top bar shows, the sidebar doesn't, Auto is a small row above the message box.
- [ ] Conversations, Missions and the shelf: the tab bar at the bottom works (Chats · Missions · Shelf · More). More opens a sheet with Agents, Knowledge and Look; Escape or Close shuts it and focus lands back on More.
- [ ] A Deliverable: the actions sit in a bar at the bottom.
- [ ] Optional, a real phone: run `npm run dev -- -H 0.0.0.0`, add your Mac's LAN name to `PLAY_ALLOWED_HOSTS` in `.env.local`, restart, and open `http://<that name>:3100` on the phone. Note this exposes Play, and through it Auto as the local super admin, to your network: stop it afterwards.

### Looks

The format and the numbers are in `docs/LOOKS.md`. Start from a clean slate: in the DevTools console run `localStorage.removeItem("automatos-play.looks"); localStorage.removeItem("automatos-play.look")`, then reload. Play opens in Ember (graphite page, molten accent, serif headings).

- [ ] **Switch each preset.** On the Looks page (Look in the sidebar, or More in the phone tab bar), pick Ember, Obsidian, Aurora, Workshop and Daylight in turn. Each time the preview *and* the sidebar, the page behind it and Auto's caption change at once, with no reload. The heading says the Look's name.
- [ ] **Edit.** Change the accent, the background, the type, Auto's shell, Auto's light and the glow (drag it to 0: "Off"). Each one changes the whole app at once; the heading says "· edited". Reset brings back the picked Look's values.
- [ ] **Save.** Edit a preset, press Save as new look: "My look 1" appears at the end of the Looks row and is picked. Rename it, Duplicate it ("… copy"), Delete the copy. Presets offer Duplicate but not Rename or Delete.
- [ ] **Reload, no flash.** With a saved Look picked (try Daylight-based, the biggest change from Ember), reload with the cache off (DevTools > Network > Disable cache) and on a throttled connection (Slow 4G). The page paints straight in the Look: never a frame of Ember's dark page first. Repeat with an unsaved edit: it survives the reload too.
- [ ] **Open other pages.** Chat, Conversations, the shelf, a Deliverable, Missions and a Mission run, Agents and an agent, Knowledge and a document, the asleep screen and the 404 all follow the Look (no stray Ember colours).
- [ ] **Export.** Export downloads `<name>.look.json`. Open it: eleven fields, catalogue keys only, no colours. Copy JSON puts the same text on the clipboard.
- [ ] **Import.** Delete that saved Look, then import the file with "Or choose a .json file": it comes back under a new id and is picked. Paste the JSON into the box and Import pasted JSON: a second copy appears. Now edit the pasted text to `"accent": "#ff0000"` and import: the error names the six accents, and nothing is added. Paste `<b>hi</b>` as the name: the error or the name shows as plain text, never bold.
- [ ] **The style page numbers.** See the style sheet. Under Ember the contrast table reads text / bg 16.36:1, text-2 / bg 8.54:1 and ink / molten 6.74:1, each "✓ AA pass". Go back, pick Daylight, and open the style sheet again: the bg swatch is `#F4EEE8`, accent text is `#AA4C1C` with "darkened for reading on Paper", and error text is `#A54B49`. Copy tokens pastes a `:root { … }` block.
- [ ] **Daylight readability.** In Daylight, read a whole chat with a tool call and an error ("Hit a snag"), the shelf and a Deliverable. Every word is easy to read: links, serif highlights and error words are in the darker text colours, never raw orange or coral on the cream page. The focus ring is visible.
- [ ] **Auto's shell tint, Chrome.** With the mascot files in place, pick each shell (Bronze, Gold, Silver, Cobalt) on the Looks page. Auto's body takes the tint in the preview and in the mascot column, in the video and in the still (turn on reduced motion to see the still). His eyes and ring keep the light's colour.
- [ ] **Auto's shell tint, Safari.** The same in Safari, which plays the `.mp4`: the tint applies to the HEVC video with no black box and no flicker when the shell changes.
- [ ] **No storage.** In a private window with storage blocked (Safari: Settings > Privacy > Block all cookies), Play opens in Ember and the Looks page still re-themes the app; nothing is kept after a reload.

### Missions

Missions cost real tokens: use a small goal in the test workspace. Play asks the open Mission every 10 s and the list every 30 s, only while the tab is visible (PRD-003, "Poll gently").

- [ ] **Start from chat.** Ask Auto for something that needs several agents (`Research three electric bike brands, compare their prices and write a one-page report`). When the answer has finished, a "Mission suggestion" card shows under it with the goal, how complex it is ("Multi-step" or "Complex, several agents") and **Start this Mission**. If no card comes, the core judged the message simple: ask for more steps. Not now hides the card for that reply only.
- [ ] Press Start this Mission: Play opens `/missions/<id>`. Auto thinks ("Working out a plan"), the chip says Planning, and the only button is Cancel Mission. In the backend log, `POST /api/missions` carried `config.source: "chat"`, the `chat_id` and the context messages.
- [ ] **Start from the list.** On `/missions`, New Mission opens the composer in the page. An empty goal or one over 10,000 characters can't be sent; Start Mission opens the new Mission. Close puts focus back on New Mission.
- [ ] **Approve a plan.** When the chip says Needs approval, Auto listens ("Your plan is ready to look over") and the plan shows its steps in order, each with a title and an agent. Change a title and an agent, press Save changes, reload: the change is kept. Change another title and press Approve plan straight away: that change is saved too before the approval.
- [ ] **Reject** (on another Mission, or Replan after a failure to get a fresh plan): Reject… asks why in the page (no browser dialog); an empty reason can't be sent; Keep the plan closes it and puts focus back on Reject….
- [ ] **Watch it run.** After Approve plan: chip Running, Auto working ("The crew is on it"), the progress bar and the step chips move without a reload (within about 10 s of each change). Each step shows its agent's name (never a bare number), tokens, and its output excerpt as plain text. The activity feed is newest first; Show older loads more.
- [ ] Switch to another tab for a minute, then back: in DevTools > Network, `/api/missions/<id>` was not asked while the tab was hidden, and is asked again at once when you come back.
- [ ] Pause shows only while Running; Pause, then Resume, and the chip follows. When it ends: chip Done, Auto celebrates once, then idles (a finished Mission celebrates once each time its page is opened), the side panel shows the cost in tokens and "about $…", the times, and the Mission's Deliverables as cards that open.
- [ ] **Cancel.** Start a third small Mission and press Cancel Mission while it runs: it asks in the page ("Cancel this Mission? …"), Keep it going changes nothing, Cancel Mission stops it: chip Cancelled, Auto idle, and the buttons left are Delete Mission only. Delete Mission asks again, then goes back to `/missions` and the card is gone.
- [ ] **A refused move.** Open the same awaiting-approval Mission in Studio and in Play, approve it in Studio, then press Approve plan in Play: Play says in words that the Mission is already running (no raw error, no code), and the page refreshes to Running.
- [ ] **The list.** Each card shows the state chip, the goal (two lines at most), its age and tokens. The chips All, Active, Needs you, Done and Failed filter it; Load more appears past 20 Missions. The strip at the top shows the last 30 days (Missions, Success rate, Average time), and the success rate matches Studio's. No Auto on the list.

### Agents

The test workspace needs at least one agent of its own besides Auto, ideally one API agent and one session (Claude Code) agent.

- [ ] **Auto first.** On `/agents` Auto leads in his own card at the top ("Leads your crew") with his mascot, whatever his database id. He reads idle with "Nothing in hand. Ask me in chat.": the core's fleet leaves him out (PRD-003, open question 5). He has no on/off switch.
- [ ] **The crew.** Every other agent is a card with no mascot: its glyph, name, "Category · Job title", state chip, the runtime (API or Session), the model route (for example "Anthropic · claude-sonnet-4-5"), what it is working on, and "Last active … · cost". A session agent's cost is in tokens "on your plan", never dollars. The names and models match Studio's Agents page.
- [ ] The chips All, API and Session filter the cards; the search box filters by name; "No agents match." when nothing does.
- [ ] **Fleet state.** Give an agent a Task on the board in Studio. Within about 10 s its card says Working on that Task, without a reload. With the tab hidden, `/api/fleet` isn't asked (DevTools > Network).
- [ ] **Switch an agent off and on.** Press its switch: the card asks in place ("Switch <name> off? …"), Keep on changes nothing and puts focus back on the switch. Switch off: the switch reads off, and Studio shows the agent inactive after a reload. Switch it back on the same way. In the backend log the `PUT /api/agents/<id>` body was `{"status": …}` and nothing else.
- [ ] **Agent detail.** A card's name opens `/agents/<id>`: About, Performance (figures only once the agent has done tasks, never the core's made-up 99.8 % uptime or 85 score), Skills, Tools, and on the side the model and the last 24 hours. No mascot, except on Auto's own page.
- [ ] **Chat with an agent.** "Chat with <name>" opens a new chat that says "Talking to <name>" and a box labelled "Message <name>"; the answer comes from that agent (the backend log shows its `agentId` on each turn). A session agent has no Chat with, a note says why, and its Live session section shows what its session is doing (or that there is none).
- [ ] Auto's own page (his card's name): his mascot is there, and Chat with goes to the normal chat with him.

### Knowledge

Make a small set of test files first: one each of `.pdf`, `.docx`, `.txt`, `.md`, `.csv`, `.html`, `.json` and `.xlsx` with harmless text, plus one file over 50 MB (`mkfile -n 51m /tmp/big.txt` on macOS) and one `.exe` or `.zip`. Upload into the test workspace only: everything you upload is something Auto and the agents can read.

- [ ] **Empty state.** In a workspace with no documents, `/knowledge` shows Auto idle beside "Give me something to read."
- [ ] **Upload each type.** Drop each test file on "Give Auto a document" (and use Choose a file at least once). While it sends, the line shows "Sending <name>: n%" with a bar; then Auto reads ("Auto is reading <name>…"); then "<name> is read. Auto can use it now." and Auto celebrates once. Open it goes to the document. The list shows each one with its type spelled out (the HTML file says HTML, though the core files it as unknown), its size, a Ready chip and the date.
- [ ] **A duplicate.** Upload one of the same files again: "Auto already has <name>, so nothing changed.", Auto doesn't celebrate, and no second row appears. Change the file's text, keep its name and upload it: it replaces the old one (same row, new text), and if the core answers that it is still reading, the line keeps saying so until it is Ready.
- [ ] **A too-big file and a wrong type.** The 51 MB file: "That file is 51 MB. Auto can read files up to 50 MB." The `.exe`: the list of types Auto reads. Neither is sent (no `/api/documents/upload` in DevTools > Network) and Auto doesn't play oops. Rename a `.txt` to `.pdf` and upload it: the backend refuses it, the line says why in words and Auto plays oops.
- [ ] **Search.** Search for a phrase from one of the files and press Enter (or Search): Auto searches while it runs, then the results replace the list, each with its excerpt as plain text, a % match and the file's name linking to it. Clear search brings the list back. A word in none of them: "Nothing in your documents matches …".
- [ ] **Open a document.** Its page shows the name, the Ready chip, type, size, the date and the passages; a Markdown file shows headings and lists, the others plain text. No HTML from the HTML file is ever drawn as a page (its tags show as text, or not at all).
- [ ] **Download.** Download saves the original file with its own name, and it opens. With Play on your machine this works with the local MinIO (the core hands Play an `http://localhost:9000` link, which Play's server fetches). With Play in Docker it can't reach that address: expect "Automatos couldn't hand over that file" (see the README's troubleshooting).
- [ ] **Delete.** Delete first counts what goes with the document ("Deleting it removes … stored passages …"), then Delete document removes it and goes back to the list; Keep it changes nothing and puts focus back on Delete. The document is gone from Studio's Documents page too.
- [ ] While a document is being read, Play asks `/api/documents/<id>` every 7 s only while the tab is visible and stops once it is Ready or failed. It never calls `/reprocess` (DevTools > Network).

### Also worth a look

- [ ] `/nope` shows the 404 with Auto lost, and Back to chat works.
- [ ] Leave the chat alone for 3 minutes: Auto naps ("Having a little nap"); moving the mouse wakes it.
- [ ] Press Tab through the chat, the shelf and the asleep screen: every stop has a visible ring in the accent text colour (molten in Ember), and nothing is skipped.
- [ ] VoiceOver (Cmd+F5) reads Auto's caption when it changes, and doesn't read the video.

## Recording real stream fixtures

The tests replay five **synthetic** streams in `tests/fixtures/` (each says so in its header), written by hand to match the core's formatters. Real recordings are better: they catch what the core sends that the skill doesn't say.

**Privacy first.** A recording holds everything Auto said and every tool input and result. Record only in a workspace holding test data, read the whole file before committing it, and never record from a real workspace. Gold or eval sets are never committed.

### Record

Record against the backend directly, with the same request Play sends, so the file is exactly what Play's proxy passes through:

```sh
BACKEND=http://localhost:8000
WS=$(curl -s "$BACKEND/api/workspaces/current" | python3 -c 'import json, sys; print(json.load(sys.stdin)["id"])')

record() {  # record <fixture name> <message>
  python3 -c 'import json, sys; print(json.dumps({"id": "", "message": {"role": "user", "parts": [{"type": "text", "text": sys.argv[1]}]}, "selectedVisibilityType": "private"}))' "$2" \
    | curl -sN "$BACKEND/api/chat" -H 'Content-Type: application/json' -H "X-Workspace-ID: $WS" --data-binary @- \
    > "/tmp/$1.txt"
}

record plain-answer "hello! Answer in one sentence that uses the word café, a dash — and a 🎉"
record web-search "Search the web for the latest news about electric bikes"
record ask-waiting "Rename the agent Scout to Scout Two"
```

- `-N` turns off curl's buffering; `--data-binary` keeps the body exact. The files land in `/tmp` first, so nothing unread gets near the repo.
- **plain-answer:** a hello that makes Auto answer with non-ASCII characters, because the byte-split tests in `tests/stream/fixtures.test.ts` need some (`\uXXXX` escapes on the wire). Expect `chat-id`, `0:` lines, `receipts`, `finish`.
- **web-search:** expect `tool-start` / `tool-end` for `platform_web_search`, then receipts.
- **ask-waiting:** a change that needs the owner's click (on an agent you made in the test workspace). Expect a `tool-end` with `"waiting": true`. If Auto just does it, try another write, and say which message worked in the header.
- **error-turn:** hard to cause on purpose. One way, in a test install only: give the chat model a wrong provider key, send `hello`, then put the key back. Expect an `e:` line and no `finish`. If you can't cause one, keep the synthetic file.
- **reasoning-narration:** with a reasoning model selected, ask something that needs a tool (`Look up today's weather in Dublin and explain your plan first`). Expect `reasoning` and `narration` events.

Each recording opens a conversation in the test workspace; delete them afterwards if you like.

### Check, then replace

1. Read each file end to end. Don't edit the stream lines: a fixture must stay byte for byte what the core sent. If it holds anything private, throw it away and record again from cleaner test data.
2. Add a header line at the top (the parser skips lines that start with `#`, and `tests/stream/fixtures.test.ts` accepts `# SYNTHETIC fixture` or `# RECORDED`):

   ```
   # RECORDED 2026-10-20 from a test workspace, automatos-ai main @ <commit>: "hello"
   ```

3. Copy it over the synthetic file of the same name in `tests/fixtures/`.
4. `npm test`, and read the failures. They are the point of the exercise:
   - `tests/stream/fixtures.test.ts` "parses to the expected events" compares against a hand-written table (`EXPECTED`). Check the new events against what you saw in the browser, then update the table. An `{type: "unknown"}` event means the core sends something the skill doesn't list.
   - `tests/mascot/fixtures.test.ts` replays each turn through the mascot reducer (plain answer `thinking → idle`; tool call `… searching → idle → celebrate`; error ends `oops`; ask ends `listening`). A failure here is a real question: either Play reads the turn wrong, or the expectation was (for example, a search whose receipts have no `done` line doesn't celebrate). Decide which before changing the test.
   - Chat tests that assert Auto's exact words from a fixture (`grep -rn "fixtureAnswer\|fixtureEvents" tests`) need the new words.
5. Any gap between the recording and the skill: fix `skills/build-automatos-interface/references/chat-stream.md` and add a row to `docs/SKILL-GAPS.md`.
6. Read the final diff of `tests/fixtures/` once more before committing.
