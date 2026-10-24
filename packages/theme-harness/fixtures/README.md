# Harness fixtures

What the harness's fake host answers a theme's tests with. **Fake data only**: this repo is public, and
`tests/fixtures-fake-data.test.ts` (kit root) fails on any file here that holds an e-mail address, a URL outside
`example.com` or `localhost`, a JWT-shaped string, or a key prefix (`sk-`, `ak_srv_`, `ak_pub_`, `ghp_`). Paths
inside the app (`/api/...`, `/deliverables?...`) are not URLs and are fine.

| Folder | What it holds | Read by |
|---|---|---|
| `streams/` | Recorded chat turns, by name | `host.scriptOf(host.recordedTurns(json), names)`, then `host.setChatScript` |
| `deliverables/` | Answers of `GET /api/deliverables`: a page of rows, and one with `success: false` | `host.setDeliverables` |
| `cards/` | The data each host card takes (`areas/cards.d.ts` props) | the card stand-ins |
| `health/` | The host's health as `useHealth` reports it: up and down | `host.setHealth(health.connection, health)` |
| `errors/` | The backend's error bodies (`404.json`: a Deliverable the workspace doesn't hold) | the Deliverables fake |
| `conversations/` | The conversations the backend holds, newest activity by `updatedAt`, each with its messages (a stored reply may name who wrote it, `provenance`, or be a failure the server saved, `savedError`) | `host.conversationsOf(json)`, then `host.setConversations` |
| `agents/` | The workspace's agents as `useAgents` gives them (`roster.json`: active, inactive and failing ones, with and without a team or tags) and their counts as `useAgentStats` gives them (`stats.json`) | `host.setPageQuery('useAgents', { data })`, `host.setPageQuery('useAgentStats', { data })` |

## The stream format

`streams/*.json` use the format of core's `e2e/browser/fixtures/play-parity/chat-turns.json`, the stream
`frontend/lib/chat/hooks.ts` reads:

```json
{ "chatId": "harness-chat", "turns": { "answer": { "frames": [{ "text": "Hi" }, { "data": { "type": "finish" } }] } } }
```

- `{ "text": ... }` is a `0:` line: words added to the reply.
- `{ "data": ... }` is a `d:` line, in the backend's payload shapes: `chat-id` names a new chat; `tool-start`,
  `tool-end`, `tool-data` (an approval, a task card, the receipts frame, a generated document), `mission-suggestion`,
  `progress`, `reasoning`, `withdraw_offer`, `limit_reached` and `finish`.
- `"hold": true` keeps the stream open after the frames, until Stop, or until the test goes on with it:
  `host.continueHeldTurn({ frames })` plays more frames, then ends the stream (or holds it again with `hold: true`).
- `"status"` other than 200 answers that status with no stream (a refused request).

Two additions of the harness's own, which core's recorded turns don't use: `{ "error": { "message", "code" } }` is an
`e:` line (the reply fails in words), and `"body"` is what a refused response says (`credits_exhausted` in it is the
code the chat reports).

Each send or Try again takes the next turn of the script; a send with none left is refused (status 500), and one
while the host's health is down never connects and takes none. A test reads what was sent with `host.chatSent()`.
`host` is `@automatos/theme-harness/host`; the fakes' own tests reach the same controls as `chatControls`,
`deliverablesControls` and `cardsControls` of `src/sdk/{chat,deliverables,cards}.ts`.
