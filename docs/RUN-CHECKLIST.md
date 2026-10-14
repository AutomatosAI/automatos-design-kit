# Run checklist: Play against a real local Automatos

CI proves the parser, the reducer and the screens against synthetic data. It can't see a browser, a video's alpha channel or a real backend. These checks are Gerard's local run (PRD-001, "Testing plan"). Tick them in a copy of this file or in the PR; anything that fails goes in the PR as a finding.

## Before you start

1. In `automatos-ai`: `docker compose up -d`. Wait until `curl http://localhost:8000/api/workspaces/current` answers JSON.
2. Use a workspace with **test data only**: the checks below send messages and make Deliverables in it.
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

- [ ] DevTools device toolbar at 390 px wide (iPhone 14): no sideways scrolling on the chat, Conversations, the shelf, a Deliverable, the asleep screen and the 404.
- [ ] Chat: the top bar shows, the sidebar doesn't, Auto is a small row above the message box.
- [ ] Conversations and the shelf: the tab bar at the bottom works.
- [ ] A Deliverable: the actions sit in a bar at the bottom.
- [ ] Optional, a real phone: run `npm run dev -- -H 0.0.0.0`, add your Mac's LAN name to `PLAY_ALLOWED_HOSTS` in `.env.local`, restart, and open `http://<that name>:3100` on the phone. Note this exposes Play, and through it Auto as the local super admin, to your network: stop it afterwards.

### Looks

The format and the numbers are in `docs/LOOKS.md`. Start from a clean slate: in the DevTools console run `localStorage.removeItem("automatos-play.looks"); localStorage.removeItem("automatos-play.look")`, then reload. Play opens in Ember (graphite page, molten accent, serif headings).

- [ ] **Switch each preset.** On the Looks page (Look in the sidebar, or the phone tab bar), pick Ember, Obsidian, Aurora, Workshop and Daylight in turn. Each time the preview *and* the sidebar, the page behind it and Auto's caption change at once, with no reload. The heading says the Look's name.
- [ ] **Edit.** Change the accent, the background, the type, Auto's shell, Auto's light and the glow (drag it to 0: "Off"). Each one changes the whole app at once; the heading says "· edited". Reset brings back the picked Look's values.
- [ ] **Save.** Edit a preset, press Save as new look: "My look 1" appears at the end of the Looks row and is picked. Rename it, Duplicate it ("… copy"), Delete the copy. Presets offer Duplicate but not Rename or Delete.
- [ ] **Reload, no flash.** With a saved Look picked (try Daylight-based, the biggest change from Ember), reload with the cache off (DevTools > Network > Disable cache) and on a throttled connection (Slow 4G). The page paints straight in the Look: never a frame of Ember's dark page first. Repeat with an unsaved edit: it survives the reload too.
- [ ] **Open other pages.** Chat, Conversations, the shelf, a Deliverable, the asleep screen and the 404 all follow the Look (no stray Ember colours).
- [ ] **Export.** Export downloads `<name>.look.json`. Open it: eleven fields, catalogue keys only, no colours. Copy JSON puts the same text on the clipboard.
- [ ] **Import.** Delete that saved Look, then import the file with "Or choose a .json file": it comes back under a new id and is picked. Paste the JSON into the box and Import pasted JSON: a second copy appears. Now edit the pasted text to `"accent": "#ff0000"` and import: the error names the six accents, and nothing is added. Paste `<b>hi</b>` as the name: the error or the name shows as plain text, never bold.
- [ ] **The style page numbers.** See the style sheet. Under Ember the contrast table reads text / bg 16.36:1, text-2 / bg 8.54:1 and ink / molten 6.74:1, each "✓ AA pass". Go back, pick Daylight, and open the style sheet again: the bg swatch is `#F4EEE8`, accent text is `#AA4C1C` with "darkened for reading on Paper", and error text is `#A54B49`. Copy tokens pastes a `:root { … }` block.
- [ ] **Daylight readability.** In Daylight, read a whole chat with a tool call and an error ("Hit a snag"), the shelf and a Deliverable. Every word is easy to read: links, serif highlights and error words are in the darker text colours, never raw orange or coral on the cream page. The focus ring is visible.
- [ ] **Auto's shell tint, Chrome.** With the mascot files in place, pick each shell (Bronze, Gold, Silver, Cobalt) on the Looks page. Auto's body takes the tint in the preview and in the mascot column, in the video and in the still (turn on reduced motion to see the still). His eyes and ring keep the light's colour.
- [ ] **Auto's shell tint, Safari.** The same in Safari, which plays the `.mp4`: the tint applies to the HEVC video with no black box and no flicker when the shell changes.
- [ ] **No storage.** In a private window with storage blocked (Safari: Settings > Privacy > Block all cookies), Play opens in Ember and the Looks page still re-themes the app; nothing is kept after a reload.

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
