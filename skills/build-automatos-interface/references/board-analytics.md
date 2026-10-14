# The Board (Tasks) and Analytics

Source of truth: `automatos-ai/orchestrator/api/board_tasks.py`, `services/board_drag_rules.py`, `services/board_consent.py`, `api/approval_grants.py` and `api/llm_analytics.py`. Written against `main` on 14 Oct 2026.

## The Board

The canonical name of a card is a **Task**, shown with its number (e.g. #1636). The page is the **Command Center** board.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/tasks?finished_limit=20` | every open Task plus the 20 newest finished ones: `{tasks, total}`. Other params: `status` (comma list), `agent_id`, `priority`, `search`, `limit` (≤500), `offset` |
| GET | `/api/v1/tasks/{id}` | one Task, with a `cost` block |
| GET | `/api/v1/tasks/stream` | **live updates** as server-sent events; see below |
| POST | `/api/v1/tasks` | create: `{title (required), description?, assigned_agent_id?, priority?, tags?}`, with `source_type` left out (the backend uses `user`) |
| PATCH | `/api/v1/tasks/{id}` | edit any of `title, description, priority, assigned_agent_id, tags, note`. An unknown field returns 422. **A comment is `{note: "..."}`**: there is no separate comments route |
| PATCH | `/api/v1/tasks/{id}/status` | `{status, blocked_reason?}`: the drag-and-drop move; see the rules below |
| POST | `/api/v1/tasks/{id}/approve` | `{note?}`: only from `review`, moves it to `done` |
| POST | `/api/v1/tasks/{id}/reject` | `{feedback?}`: sends it back to the same agent |
| POST | `/api/v1/tasks/{id}/run-now` | start it now |
| POST | `/api/v1/tasks/{id}/cancel` | cancel |
| DELETE | `/api/v1/tasks/{id}` | delete |

Each Task carries `id, number, title, description, status, priority, assigned_agent_id, agent {id, name, agent_icon}, tags, result, error_message, blocked_reason, review_reason, times_sent_back, parent_task_id, source_type, orchestration_run_id (its Mission, if any), started_at, completed_at, created_at, updated_at`. `tags` are the labels. There is no due-date field.

**Columns, in order:** `inbox → assigned → in_progress → review → blocked → done`. Side states: `failed`, `cancelled`, `closed`.

### Move rules (the backend enforces them, so mirror them in the UI)

`board_drag_rules.py` refuses these moves, with a message. Disable the drop target, and show the backend's message if it refuses anyway:
- `review → done`: use **Approve**. `review → assigned`: use **Reject**.
- `→ in_progress` with no agent: "Assign an agent first". (A move to `in_progress` is the same as Run now.)
- A running Task (`in_progress`) can only be **cancelled**.
- `→ done` or `→ review` with an empty `result`: there is nothing to approve.
- A Mission's own Task can't be started by hand: its Mission runs it.
- A `blocked` Task waiting on a question: answer the question first.

In the local edition, assigning, dragging to `in_progress` and Run now count as the owner's approval, and the backend records it. That covers approvals only: an open question never gets answered by a drag.

### Live updates

`GET /api/v1/tasks/stream` is a server-sent-events stream for the workspace. On `event: board_changed`, refetch the list.
- Read it with `fetch` and a `ReadableStream` reader (as Studio's `use-board-event-stream.ts` does), not `EventSource`, so the `X-Workspace-ID` header goes with it.
- The proxy must pass the stream through unbuffered, with `Cache-Control: no-cache`.
- Reconnect with backoff (1 s, doubling up to 30 s), and keep a 60 s list refetch as a safety net.

### Needs you (approvals and questions)

`GET /api/v1/approval-grants?status=pending` lists what is waiting on the owner. `kind` is `approval` or `question`.
- An approval is `POST /api/v1/approval-grants/{id}/grant` or `/deny`.
- A question is answered with `POST /api/v1/approval-grants/{id}/answer` and `{answer_text?, option?}`. Answering is the only way to complete a question; deny only dismisses it.
- These routes need workspace admin, which the local operator is.

## Analytics

All of these work for the local operator.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/analytics/llm/summary?period=7d` | totals, cache share, the top 5 routes by cost, a split by provider, and a daily `cost_trend` |
| GET | `/api/analytics/llm/usage?period=7d&group_by=model` | `group_by`: `model`, `route`, `provider`, `agent`, `tier`, `request_type` or `execution`. Rows: `{key, label, request_count, input_tokens, output_tokens, total_tokens, total_cost, error_count, avg_latency_ms, provider, billing}` |
| GET | `/api/analytics/llm/costs?period=30d&breakdown=daily` | `breakdown`: `model`, `provider`, `agent` or `daily`. Rows: `{key, input_cost, output_cost, total_cost, request_count}` |
| GET | `/api/missions/stats?period=30d` | the Mission success rate and averages (see `missions.md`) |

- `period` is one of `1h`, `24h`, `7d`, `30d`, `90d`.
- **Spend by lane** (chat, Missions, board): use `group_by=execution` and group the keys by their prefix (`chat:`, `mission:`, `board_task:`). There is no lane parameter.
- Free routes and plan-billed session agents cost $0 and must still be listed, never hidden. A session agent shows its tokens with "on your plan", never a dollar figure.
- **Don't poll analytics.** Load on open, and refresh on a button or at most every 5 minutes. Avoid `/api/database/analytics/*` (heavy queries) and `/api/analytics/dashboard/system-load-trend` (it reads live CPU, which is meaningless as a chart).

## Mascot

- **Board:** no mascot on the board itself. In the "Needs you" panel, Auto shows **listening** while something waits on you.
- **Analytics:** no mascot. Dense data needs the space.
