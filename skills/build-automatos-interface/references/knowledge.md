# Knowledge (documents)

Documents the owner adds so Auto and the agents can use them. Source of truth: `automatos-ai/orchestrator/api/documents.py`. Written against `main` on 14 Oct 2026.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/documents` | the list (pagination and filters as query params) |
| GET | `/api/documents/{id}` | one document, with its `status`. **Use this to check processing**; see below |
| GET | `/api/documents/{id}/content` | the full text, rebuilt from its chunks on every call. It can be large: fetch it only when the document is opened |
| GET | `/api/documents/{id}/download?mode=url` | with S3 storage: JSON `{url, filename}`, a presigned URL (`https:`, or `http:` for a local MinIO). With no storage: **the file's bytes themselves** (`application/octet-stream`, `Content-Disposition: attachment`), not JSON. See "Download" below |
| GET | `/api/documents/{id}/delete-impact` | chunk, embedding and reference counts. Show them before confirming a delete |
| DELETE | `/api/documents/{id}` | delete |
| POST | `/api/documents/upload` | multipart; see below |
| POST | `/api/documents/search` | the search box; see below |
| GET | `/api/documents/queue/status` | the processing queue: `{queue_depth, currently_processing, failed_count, processing: [{document_id, filename, progress, current_step, step_name, eta_seconds}], ...}` |

## Upload

- `multipart/form-data`: `file` (required), `description`, `tags` (comma-separated) and `team_access` (comma-separated), all optional.
- Types: pdf, docx, txt, md, csv, html, json and xlsx. The extension must match the detected type, or the backend returns 400.
- **50 MB maximum** (a fixed constant in the backend, not a setting). Check the size in the browser before sending.
- **Processing happens inside the upload request.** The response arrives after chunking and embedding finish, with `{document_id, filename, status, message}`, where `status` is `processed`, `failed` or `duplicate`. The same bytes again give `duplicate`; the same name with new bytes replaces the document and keeps its id.
- **Your page sends a custom header** (e.g. `X-Play-Upload: 1`) with the upload, and your proxy refuses an upload without it. This is the CSRF guard for the one non-JSON route (see "Proxy safety" in SKILL.md).
- **The proxy must stream the multipart body straight through:** pass the raw body and the `content-type` header (it carries the boundary) unchanged. Never parse and rebuild the form, and allow a long timeout (several minutes) because the backend is processing while it waits. Studio skips its own proxy for uploads for exactly this reason.

## Download

Ask for `mode=url` from your server and check the answer's `content-type`: JSON carries `{url, filename}`, anything else is the file. Never let the browser name a path or a URL. Send an `https:` URL to the browser as a redirect; fetch any other URL (an `http:` MinIO) on your server and stream it back, with `X-Content-Type-Options: nosniff`, the sandbox CSP and `Content-Disposition: attachment`, as you would the bytes the backend sends itself.

## Processing status

Poll `GET /api/documents/{id}` (or `GET /api/documents/queue/status` for the whole queue) every 5–10 s while something is processing. **Never** poll `POST /api/documents/{id}/reprocess`: that starts processing again. (Studio's unused `useProcessingStatus` hook does exactly this. Don't copy it.)

Status values: `uploaded`, `processing`, `processed`, `failed`, `duplicate`. The queue route also uses `pending` and `completed`, so treat `completed` as `processed`.

## Search

`POST /api/documents/search` with `{"query": "..."}` (`query` is required; the backend returns 422 without it). It returns:

```
{ query, total_results, execution_time_ms,
  results: [{ document_id, excerpt, similarity, chunk_index, chunk_count,
              source: {filename, file_type, file_size, upload_date},
              preview, preview_truncated, full_content_available }] }
```

This is what Studio's search box uses. Don't use `/api/documents/rag/retrieve`: that builds context for a model, not results for people.

Search works in the local edition without S3, because it falls back to the local vector store.

## Knowledge Graph

The Knowledge Graph routes are separate (`/api/knowledge/graph/...`): `communities`, `community/{id}`, `node/{id}/neighbors` and `search` are cheap reads. `graph/build` and `graph/import` are expensive: never call them from a page load. The pilot's Knowledge page does not need the graph.

## Mascot

Auto shows **reading** while an upload is processing and **searching** while a search runs, then **celebrate** when an upload finishes (`processed`) and **oops** when it fails. He is also on the empty state ("Give me something to read"). He is not on the document list itself.
