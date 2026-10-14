# Missions

A **Mission** is a goal Automatos plans and carries out with several agents. Source of truth: `automatos-ai/orchestrator/api/missions.py` and `core/models/orchestration_enums.py`. Written against `main` on 14 Oct 2026.

## Endpoints

All go through your proxy with `X-Workspace-ID`. In the local edition every permission check passes.

| Method | Path | Body / params | Returns |
|---|---|---|---|
| POST | `/api/missions` | `{goal (1–10000 chars, required), config?, template_id?, plan_only?, staffing?}` | the Mission (`state` starts at `pending`, then `planning`) |
| GET | `/api/missions` | `state?`, `limit` 1–100 (default 20), `offset` | `{missions: [...], total, limit, offset}` |
| GET | `/api/missions/stats` | `period` = `7d`, `30d`, `90d` or `all` | `{total_missions, success_rate, avg_duration_minutes, avg_tokens_used, avg_tasks_per_mission, top_agents, common_failure_reasons, period}` |
| GET | `/api/missions/{id}` | — | the Mission plus `tasks`, `recent_events` (the latest 50, newest first), `task_progress {total, done, active, verified, failed, skipped, all_terminal}`, `permission_denials` |
| GET | `/api/missions/{id}/events` | `event_type?`, `limit` 1–200 (default 50), `offset` | `{events, total, limit, offset}`, newest first. No cursor: page with offset |
| GET | `/api/missions/{id}/cost` | — | `{total_tokens, estimated_cost, cost_per_1k_tokens, tasks: [{task_id, title, tokens_used}]}` |
| PATCH | `/api/missions/{id}/plan` | `{task_edits: [{task_id?, temp_id?, sequence_number?, agent_id?, agent_role?, title?, description?}]}` | the Mission. Only from `awaiting_approval` |
| POST | `/api/missions/{id}/approve` | `{note?}` (optional overrides exist; never send a `modifications` key, it is rejected) | the Mission. Only from `awaiting_approval` |
| POST | `/api/missions/{id}/reject` | `{reason}` (1–2000 chars, required) | the Mission. Only from `awaiting_approval` |
| POST | `/api/missions/{id}/pause` | — | only from `running` |
| POST | `/api/missions/{id}/resume` | optional `{additional_tokens?, additional_cost?}` | from `paused` (also retries a `failed` Mission) |
| POST | `/api/missions/{id}/cancel` | — | from any state that hasn't ended |
| POST | `/api/missions/{id}/replan` | `{notes?}` | only from `failed`, a limited number of times |
| DELETE | `/api/missions/{id}` | — | 204. Only once it has ended (completed, failed, cancelled) |

A move that isn't allowed from the current state is refused. The route checks the state first and answers **400** naming it (`Mission is in 'running' state, expected 'awaiting_approval'`, `Mission is already in terminal state 'completed'`, `Cannot delete mission in state 'paused'. Cancel it first.`); a move that loses a race with another change answers **409** (`Invalid run transition: running → paused (…)`, or an optimistic-lock conflict that names no state). Treat both the same: show it in words ("This Mission is already running, so it can't be approved"), then refresh the Mission. Other 400s keep their own words (`Mission has been replanned 3 times, maximum is 3`).

## States

`pending → planning → awaiting_approval → running ⇄ paused → verifying → completed`, with `failed`, `cancelled`, `replanning` and `awaiting_human` on the side. The ended states are `completed`, `failed` and `cancelled`.

| State | What the user sees | What the user can do |
|---|---|---|
| `pending`, `planning`, `replanning` | Auto is working out a plan | Cancel |
| `awaiting_approval` | the plan, with its tasks and agents | Edit the plan, Approve, Reject (with a reason), Cancel |
| `running` | live progress | Pause, Cancel |
| `verifying` | live progress (the last tasks are being checked) | Cancel only: pause is allowed from `running` alone |
| `paused` | paused | Resume, Cancel |
| `awaiting_human` | waiting for a person | Cancel only. There is **no** action route for it any more (the review route was removed); say so plainly |
| `completed` | done, with its Deliverables | Delete |
| `failed` | what failed (`failure_detail` on the task) | Replan, Resume (retry), Delete |
| `cancelled` | cancelled | Delete |

## Tasks inside a Mission

Each task has: `id, title, description, sequence_number, agent_role, state, assigned_agent_id, depends_on, attempt_number, tokens_used, failure_reason_code, failure_detail, output_excerpt (up to 500 chars), started_at, completed_at`.

- Task ended states are `verified`, `failed` and `skipped`. `completed` is **not** an ended state for a task (it still has to be verified).
- There is **no agent name** on a task. Join `assigned_agent_id` against the agents list (`agents-playbooks.md`).

## Live progress

There is **no** push channel for Missions: poll.

- Poll `GET /api/missions/{id}` for the open Mission only, every **10 s or slower**, and only while the page is visible (`document.visibilityState`). Stop when the state has ended.
- Poll the list every **30 s or slower**.
- **Why gently:** every Missions route runs blocking database work on the backend's event loop, so fast polling from several tabs can stall everything else. Never poll faster than Studio does (10 s for detail, 30 s for the list).

## From a chat suggestion to a Mission

A chat turn can carry a `mission-suggestion` frame: `data: {goal, complexity, agent_id}`. Nothing is created until the user agrees. The frame is the turn's **first**, before `chat-id` (`_turn_chunks` in `orchestrator/api/chat.py`); `goal` is the user's own message, and `complexity` is AutoBrain's `Complexity` value (`atom` to `organism`, `consumers/chatbot/auto.py`); Studio names only `organ` ("Multi-step") and `organism` ("Complex multi-agent") and shows any other value as sent. Read the chat id when the user clicks, not when the frame arrives. Studio's "Launch" calls:

```json
POST /api/missions
{ "goal": "<goal>", "config": { "source": "chat", "chat_id": "<chat id>", "context_messages": [ ...last 5 messages ] } }
```

Then it opens the new Mission. Do the same.

## Deliverables of a Mission

`GET /api/deliverables?source_type=mission&source_id=<mission id>` (see `endpoints.md`).

## Mascot

On a Mission page, Auto follows the Mission, not the chat: `planning` and `replanning` → thinking; `running` and `verifying` → working; `awaiting_approval` and `awaiting_human` → listening; `paused` → idle; `completed` → celebrate (once, then idle); `failed` → oops; `cancelled` → idle. Only the Mission open on screen drives him.
