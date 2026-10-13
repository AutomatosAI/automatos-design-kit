# Chat with Auto: request and stream

Source of truth: `automatos-ai/orchestrator/api/chat.py` (route and request model) and `automatos-ai/orchestrator/consumers/chatbot/streaming.py` (frame formatters). Re-check both when the backend changes; this file was written against `main` on 13 Oct 2026.

## Request

`POST /api/chat`. The route needs workspace permission `agents:execute`, which the local operator has.

```json
{
  "id": "",
  "message": { "role": "user", "parts": [{ "type": "text", "text": "hello" }] },
  "selectedVisibilityType": "private"
}
```

- `id`: empty on the first message. The backend opens a conversation and sends its id back in a `chat-id` frame. Send that id on every later message in the conversation.
- `parts`: text parts are `{type:"text", text}`. Attachments carry `attachment_id`, `filename`, `mediaType` and `url` (`ChatMessageRequest` in `chat.py`).
- Optional: `agentId` (an integer; leave it out and Auto answers), `missionMode`, `planMode`, `context` (an object, used in the prompt only).
- Headers: `Content-Type: application/json` and `X-Workspace-ID: <id>`.

The response is `text/plain; charset=utf-8`, streamed. It is **not** SSE and not WebSocket.

## Line format

Split the body on `\n`, keep the incomplete tail for the next chunk, and dispatch each line by its prefix:

| Prefix | Meaning | Parse |
|---|---|---|
| `0:` | text delta of Auto's answer | `JSON.parse(rest)` gives a string |
| `d:` | data event | `JSON.parse(rest)` gives `{type, data?, …}` |
| `e:` | error | `JSON.parse(rest)` gives `{message, code?}` |
| `data:` | the older SSE-style frame, still handled by Studio | `JSON.parse(rest)` gives `{type, …}` with types `text-delta` (`delta`), `tool-data`, `data-usage`, `mission-suggestion`, `error`, `done` |

Studio's parser in `automatos-ai/frontend/lib/chat/hooks.ts:296-560` handles all four. Copy its behaviour, not its code shape.

## `d:` event types

Most events put their payload under `data`. **`chat-id`, `finish` and `agent-info` put their fields at the top level.**

| `type` | Payload | What it means |
|---|---|---|
| `chat-id` | `chatId` (top level) | the conversation id; store it |
| `agent-info` | `agent: {id, name, type, skills}` (top level) | which agent is answering |
| `agent-assigned` | `data: {agentId, agentName, routeMethod}` | the router picked an agent |
| `reasoning` | `data: {delta}` | the thinking channel. Never show it as the answer |
| `progress` | `data: {text}` | a progress line from inside a long tool call |
| `narration` | `data: {text, retracted?}` | the text just streamed was narration, not the answer; `retracted` means it is replaced |
| `tool-start` | `data: {toolCallId, toolName, input}` | a tool call began |
| `tool-end` | `data: {toolCallId, toolName, success, error?, durationMs?, summary?, skipped?, waiting?}` | a tool call ended; `waiting: true` means Auto is waiting on the user (an ask) |
| `tool-data` | `data: {…}` | the tool's result payload |
| `receipts` | `data: {receipts: [{action, kind, status, subject, effect, link, reason}], model?}` | what Auto actually did this turn; `status` is `done`, `refused`, `skipped` or `waiting` (`consumers/chatbot/receipts.py:64`) |
| `mission-suggestion` | `data: {goal, complexity, agent_id}` | Auto proposes a Mission. Nothing is created until `POST /api/missions` |
| `workflow-update` | `data: {workflowId, status, currentStep?, progress?}` | a running workflow moved |
| `memory-injected` | `data: {memories, totalMatched}` | memories were pulled into context |
| `memory-stored` | `data: {memory, reason}` | a memory was saved |
| `limit_reached` | `data: {limit, value, message}` | an agent stopped at a cap; show `message` |
| `tool-permission-denied` | `data: {toolName, agentId, reason}` | a tool was blocked |
| `attachment_unavailable` | `data: {attachments}` | an attachment couldn't be read |
| `withdraw_offer` | `data: {requests}` | retract a pending ask shown earlier |
| `budget-warning` | `data: {tokensUsed, tokenBudget, percentUsed}` | token budget warning |
| `usage` | `data: {promptTokens, completionTokens, totalTokens}` | token counts |
| `finish` | `finishReason` (top level) | the turn is over |

Treat any other `type` as unknown and ignore it.

## Cancel

`POST /api/chat/{chat_id}/cancel` stops the running turn. Also abort your own `fetch` with an `AbortController`.

## Test fixtures

Record a real turn once from a local install (save the raw body as a `.txt` file) and keep it in `tests/fixtures/`. Record at least: a plain answer, a turn with a tool call, a turn with an error, and a turn that ends in an ask (`waiting: true`). Record only from a workspace holding test data, and read the recording before committing it: it contains everything Auto said and every tool input. Gold or eval sets are never committed.
