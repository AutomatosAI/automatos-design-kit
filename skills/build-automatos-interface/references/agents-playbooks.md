# Agents and Playbooks

Source of truth: `automatos-ai/orchestrator/api/agents.py`, `api/agent_endpoints.py`, `api/fleet.py` and `api/workflow_recipes.py`. Written against `main` on 14 Oct 2026.

## Agents

| Method | Path | Notes |
|---|---|---|
| GET | `/api/agents/?include_workspace_system=true&limit=100` | the workspace's agents. **Without `include_workspace_system=true`, Auto is left out.** Params also: `skip`, `status`, `agent_type`, `search` |
| GET | `/api/agents/{id}` | one agent (workspace agents only) |
| GET | `/api/agents/{id}/performance` | success rate, tasks, tokens and cost (some fields are placeholders that read 0) |
| GET | `/api/agents/org-chart` | nodes, edges and teams: who reports to whom |
| GET | `/api/v1/fleet` | **live status for every agent**; see below |
| PUT | `/api/agents/{id}` | `{status: "active" \| "inactive"}` switches an agent on or off (there is no dedicated route) |

Each agent has: `id, public_id, name, description, job_title, team, reports_to_id, agent_type, status, configuration (configuration.runtime is "api" or "cli"), skills, tools, plugins, agent_model_config {provider, model, ...}, model_usage_stats {tokens, cost, requests}, is_system_agent, slug, marketplace_category, unavailable`.

- **No avatar field.** Pick an icon from `marketplace_category` or `agent_type`.
- **Finding Auto:** the agent with `is_system_agent: true` and `slug == "auto-<workspace id>"`. Don't assume id 1.
- **Don't build "run this agent".** `POST /api/agents/{id}/execute` is a stub that returns a made-up id and does no work. To have an agent do something, chat with it (`agentId` in the chat request) or give it a Task on the board.

### Live status (the fleet)

`GET /api/v1/fleet` returns `agents[]`, each with:
- `current` (the work in hand), `queue_depth`, `blocked`, `watches`, `last_activity_at`, `cost_24h` (tokens and USD), `runtime`;
- for session (CLI) agents, `session: {session_id, provider, model, live_tool, last_event, last_event_at, cwd, recent_tools}`.

Studio polls it every **10 s**. Do the same, and only while the page is visible. It is workspace-wide: one call covers every agent.

### Chatting with an agent

Send `agentId: <integer id>` in the chat request (`chat-stream.md`). To change agent mid-conversation: `POST /api/chat/{chat_id}/switch-agent` with `{newAgentId, reason?}`. `GET /api/chat/agents` lists the agents chat can use.

## Playbooks

The canonical name is **Playbook**. The routes and database still say "recipe" (legacy), but never show that word to users.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/workflow-recipes?skip=0&limit=24&search=` | `{items, total, skip, limit}`, the workspace's Playbooks |
| GET | `/api/workflow-recipes/{id}` | one Playbook with `steps[]` (and each step's agent). `{id}` can be the id or its listed number |
| POST | `/api/workflow-recipes/{id}/execute` | `{input_data?, wait_for_me?}` starts a run. Returns `{recipe_execution_id, recipe_id, status: "started", total_steps, message, task_id, number}`. **A run is not a Mission**: it creates a run record and a Task on the board |
| GET | `/api/workflow-recipes/{id}/executions` | run history: `{items, total, recipe_quality_score}` |
| GET | `/api/workflow-recipes/{id}/executions/{execution_id}` | one run: `status, current_step, total_steps, step_results, error_message, started_at, completed_at` |
| POST | `/api/workflow-recipes/{id}/executions/{execution_id}/cancel` | stop a run |

An execute call fails with **400** when a step has no agent or the Playbook has no steps, and with **429** when the workspace is already running as many as it may. Show both in words.

Poll an open run every 10 s while it is visible, and stop when it ends.

## Mascot

- **Agents page:** Auto leads the crew as a larger card at the top, with his live state from the fleet (working when `current` is set, idle otherwise). Other agents are plain cards with no mascot.
- **Playbooks:** Auto shows working while a run you started is in progress, celebrate when it completes, and oops when it fails. Nothing on the list.
