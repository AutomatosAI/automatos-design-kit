# Endpoints an interface needs

Everything goes through your own proxy routes and carries `X-Workspace-ID`. Paths are on the backend (`AUTOMATOS_BACKEND_URL`). The full list of 914 routes is `automatos-ai/orchestrator/reports/route-manifest.json`. Written against `main` on 13 Oct 2026.

## Workspace

| Method | Path | Returns |
|---|---|---|
| GET | `/api/workspaces/current` | `{id, name, slug, …}` (`api/workspaces.py:62`). Call it once at start-up and send the `id` as `X-Workspace-ID` from then on |

## Conversations

| Method | Path | Returns / notes |
|---|---|---|
| POST | `/api/chat` | the streaming turn; see `chat-stream.md` |
| POST | `/api/chat/{chat_id}/cancel` | stops the running turn |
| GET | `/api/chat/history?limit=20` | `[{id, title, createdAt, updatedAt, visibility, lastMessagePreview, kind, …}]` (`api/chat.py:458`), newest `updatedAt` first (bumped by every saved message). See "Reading the history" below |
| GET | `/api/chat/{chat_id}/messages` | `[{id, role, parts, attachments, source, createdAt, …}]`, oldest first. A user message's `parts` has the shape you send; an assistant message's is below. 404 for an unknown id |
| PATCH | `/api/chat/{chat_id}` | rename: `{title}` |
| DELETE | `/api/chat/{chat_id}` | delete the conversation |

A conversation is created by the first `POST /api/chat` without an `id`. There is no separate create call. To continue one, send its `id` on the next `POST /api/chat`.

### Reading the history

- `lastMessagePreview` is the latest message's `text` parts joined, cut to 80 characters with `…` (`_last_message_previews` in `api/chat.py`), or null for a conversation with no messages. **It doesn't say who wrote it.** A finished turn and a failed one both end with an assistant message, so it is Auto's unless the last turn was stopped before Auto saved anything.
- `title` can be `"New Chat"` until the backend names the conversation.
- `limit` has no upper bound in the route; there is no search parameter, so a title search filters what you loaded.

### A saved assistant message

`parts` is written by `reply_parts` in `consumers/chatbot/narration.py`, in this order, each optional except the answer:

| Part | Fields | Show it as |
|---|---|---|
| `receipts` | `receipts: [...]` (same items as the stream's `receipts` frame) | the receipts list |
| `reasoning` | `reasoning: string` | the thinking channel, never the answer |
| `narration` | `narration: string` | the muted line above the answer |
| `text` | `text: string` | the answer (markdown) |

Tool calls are not saved. `source` is an object or null: a failed turn is saved as an assistant message whose `source` is `{origin: "turn_error", label: "Error", code}` and whose one `text` part starts with `⚠️ ` (`_persist_turn_error` in `consumers/chatbot/service.py`). Show it as an error, not as Auto's answer.

## Deliverables

| Method | Path | Returns / notes |
|---|---|---|
| GET | `/api/deliverables?limit=24&offset=0` | `{success, deliverables: [...], total, limit, offset}` (`services/deliverable_service.py`) |
| GET | `/api/deliverables/{id}?include_content=true` | `{success: true, deliverable: {…}}`, with `content` inline when asked (null for images and videos, which stream by URL; `content_error` when the file can't be read; `content_truncated` past the inline cap). A missing id is HTTP 404 (`api/deliverables.py:108`) |
| GET | `/api/deliverables/{id}/thumbnail` | the thumbnail image (`api/deliverable_thumbnails.py:37`) |
| GET | `/api/deliverables/stats` | counts for the workspace |

List filters (all optional): `artifact_type` (report, image, document, code, slide, spreadsheet, archive, audio, video), `source_type` (chat, task, mission, heartbeat, playbook, trigger, upload), `source_type_exclude` (comma list; `heartbeat` is a sensible default to hide), `source_id`, `agent_id`, `date_from`, `date_to`, `search`, `tag`. `limit` is 1–100.

Each Deliverable carries at least `id`, `title`, `summary`, `artifact_type`, `source_type`, `source_id`, `agent_id`, `file_path`, `preview_url` and `created_at`.

**Check `success`.** When the query fails, the list returns HTTP 200 with `success: false`, an `error` string and an empty list. Show an error state, not "no Deliverables yet".

There is no binary download route for Deliverables. Use `include_content=true`, or `preview_url` when it is set.

`preview_url` (and `content_url` on the detail) is a **backend-relative path** such as `/api/workspaces/{ws}/files/raw?path=…` for files in workspace storage (`_workspace_file_url` in `services/deliverable_service.py`). The browser can't open it directly: proxy it like any other route, or treat it as unavailable.

## Not used by the pilot (for later)

- Missions: `/api/missions` (create, list, detail, events, approve, cancel…). Status values are the `RunState` enum in `core/models/orchestration_enums.py:29-40`.
- Documents: `POST /api/documents/upload`, `POST /api/documents/search`.
