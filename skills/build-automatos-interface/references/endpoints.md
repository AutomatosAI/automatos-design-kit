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
| GET | `/api/chat/history?limit=20` | `[{id, title, createdAt, updatedAt, visibility, lastMessagePreview, kind, …}]` (`api/chat.py:458`) |
| GET | `/api/chat/{chat_id}/messages` | `[{id, role, parts, attachments, source, createdAt, …}]`. `parts` has the same shape you send |
| PATCH | `/api/chat/{chat_id}` | rename: `{title}` |
| DELETE | `/api/chat/{chat_id}` | delete the conversation |

A conversation is created by the first `POST /api/chat` without an `id`. There is no separate create call.

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
