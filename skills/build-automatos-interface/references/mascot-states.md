# Driving the Auto mascot

The mascot shows what Auto is doing, from real stream events. It is decoration on top of the chat, never a replacement for it: every state also has a text equivalent on screen (a typing indicator, a tool line, an error message).

## Assets

`public/auto/<state>.webm` (VP9 with alpha: Chrome, Edge, Firefox), `public/auto/<state>.mp4` (HEVC with alpha: Safari, iOS) and `public/auto/<state>.png` (a transparent still: the poster, and what plays when the user prefers reduced motion). All are 512×512, 24 fps, 5 s.

**Every clip starts and ends on the same rest pose**, so a switch at the end of a clip never jumps. The light ring under Auto is not in the video. Draw it in CSS so it can change colour per state.

Pick the file per browser: Safari (and every iOS browser) gets `.mp4`, everything else gets `.webm`. Safari can play WebM but drops the alpha channel, so it shows a black box. Chrome can play HEVC but also drops the alpha. Neither browser falls back for you.

How the clips were made, and how to make more, is in `mascot/README.md` at the repo root.

## States

| State | Kind | Comes from |
|---|---|---|
| `hello` | one-shot | first open of the app in a browser session |
| `idle` | loop | the default; also after `finish` once a one-shot has played |
| `listening` | loop | the message box has focus and the user is typing; also `tool-end` with `waiting: true` (Auto has asked something and waits for the answer) |
| `thinking` | loop | the message is sent and nothing has come back yet; `reasoning` events |
| `working` | loop | `tool-start` for any tool not listed under searching or reading; `progress`; `workflow-update`; `agent-assigned` |
| `searching` | loop | `tool-start` for a web or marketplace tool (list below) |
| `reading` | loop | `tool-start` for a document, knowledge or memory tool (list below); `memory-injected` |
| `celebrate` | one-shot | `finish` in a turn whose `receipts` include a `done` receipt, or when a new Deliverable appears |
| `oops` | loop | an `e:` line; `tool-end` with `success: false` (and not `skipped`); `limit_reached`; `tool-permission-denied`; `attachment_unavailable`; `receipts` with a `refused` receipt; a failed proxy call |
| `sleeping` | loop | no user input for 3 minutes, or the backend is unreachable |
| `lost` | loop | the 404 page |
| `loading` | loop | first data fetch and route changes taking longer than 300 ms |

Text deltas (`0:`) don't change the state. If the state is `thinking` when the first delta arrives, go to `idle`: the words on screen show that Auto is answering.

When a tool ends (`tool-end` with `success: true`, or `skipped`), go back to the state of a tool still running, or to `idle`. A turn that finishes while Auto is still `thinking`, `working`, `searching` or `reading` goes to `idle` (or `celebrate`). A turn that fails ends on its `e:` line: there is no `finish` frame after it.

### Tool names

Match the exact name first, then the patterns. Keep both lists in one config file, because the backend adds tools.

- **searching**: `platform_web_search`, `platform_web_fetch`, `search_images`, `platform_search_packages`, `platform_browse_marketplace_agents`, `platform_browse_marketplace_plugins`, `platform_browse_marketplace_skills`. Pattern: `/web_|browse_marketplace/`.
- **reading**: `platform_read_document`, `platform_search_documents`, `platform_grep_documents`, `platform_list_documents`, `search_knowledge`, `semantic_search`, `search_multimodal`, `search_tables`, `search_formulas`, `platform_search_memory`, `platform_browse_memories`, `platform_search_chat_history`, `platform_query_graph`, `platform_codegraph_search`. Pattern: `/document|knowledge|memor|semantic|graph/`.
- **working**: everything else (for example `platform_query_data`, `query_database`). Some writes match a reading pattern, so list them as exact **working** names, checked before the patterns: `generate_document`, `platform_upload_document`, `platform_delete_document`, `platform_reprocess_document`, `platform_store_memory`, `platform_delete_memory`, `platform_codegraph_index`, `platform_codegraph_reindex`, `platform_codegraph_set_auto_reindex`.

These names come from the tool definitions in `automatos-ai/orchestrator/modules/tools/` (13 Oct 2026).

## Switching rules

1. **Priority, when several events land at once:** oops > celebrate > listening (waiting) > searching = reading > working > thinking > listening (typing) > idle.
2. **Switch at the clip boundary.** Queue the next state and swap when the current clip ends (`ended`, or `timeupdate` within 80 ms of the end). Browsers fire `timeupdate` as rarely as every 250 ms, so the 80 ms window alone misses most clip ends, and a clip with the `loop` attribute never fires `ended`. Play loop clips without `loop`: at the boundary, swap to the queued clip or set `currentTime = 0` and `play()` again. Because every clip starts and ends on the rest pose, both are seamless.
3. **Except urgent states:** `oops` and `hello` swap immediately.
4. **Hold time.** A loop state stays on screen for at least one full clip. Tool calls that finish in 200 ms shouldn't flicker the mascot.
5. **One-shots return to `idle`** when they end, unless something newer is queued.
6. **Preload** the next likely clips (`thinking`, `working`, `celebrate`) when the user starts typing.
7. **Reduced motion:** show the PNG for the current state and swap it instantly. Don't play video.

Write the reducer as a pure function, `(state, event) => nextState`, with no timers or DOM inside it. Put timers and video handling in one small component around it, and unit-test the reducer with event sequences built from recorded streams.
