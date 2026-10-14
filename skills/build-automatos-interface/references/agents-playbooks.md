# Agents and Playbooks

Source of truth: `automatos-ai/orchestrator/api/agents.py`, `api/agent_endpoints.py`, `api/fleet.py` and `api/workflow_recipes.py`. Written against `main` on 14 Oct 2026.

## Agents

| Method | Path | Notes |
|---|---|---|
| GET | `/api/agents/?include_workspace_system=true&limit=100` | the workspace's agents. **Without `include_workspace_system=true`, Auto is left out.** Params also: `skip`, `status`, `agent_type`, `search` |
| GET | `/api/agents/{id}` | one agent (workspace agents only) |
| GET | `/api/agents/{id}/performance` | success rate, tasks, tokens and cost; several fields are not measured, see below |
| GET | `/api/agents/org-chart` | nodes, edges and teams: who reports to whom |
| GET | `/api/v1/fleet` | **live status for every agent**; see below |
| PUT | `/api/agents/{id}` | `{status: "active" \| "inactive"}` switches an agent on or off (there is no dedicated route) |

Each agent has: `id, public_id, name, description, job_title, team, reports_to_id, agent_type, status, configuration (configuration.runtime is "api" or "cli"), skills, tools, plugins, agent_model_config {provider, model_id, ...}, model_usage_stats {total_tokens, total_cost, total_requests}, is_system_agent, slug, marketplace_category, unavailable` (`AgentResponse` in `core/models/core.py`).

- **The model route.** An API agent's model is `agent_model_config.model_id` (not `model`). A session (`cli`) agent's CLI and model are in `configuration.provider` and `configuration.model` (Studio's `runtimeBadge`). `status` is `active`, `inactive` or `training`.
- **Switching on and off.** `PUT /api/agents/{id}` takes the whole `AgentUpdate` (name, configuration, tools…), and only finds agents whose `workspace_id` is yours (a platform system agent 404s). A UI that only switches agents should send `{status}` alone and have its proxy refuse anything else.

- **No avatar field.** Pick an icon from `marketplace_category` or `agent_type`.
- **Finding Auto:** the agent with `is_system_agent: true` and `slug == "auto-<workspace id>"`. Don't assume id 1.
- **Don't build "run this agent".** `POST /api/agents/{id}/execute` is a stub that returns a made-up id and does no work. To have an agent do something, chat with it (`agentId` in the chat request) or give it a Task on the board.

### Live status (the fleet)

`GET /api/v1/fleet` returns `{version, generated_at, window_hours, cost_available, watches_available, asks_available, agents[]}` (`services/fleet_state.py`), each agent with:
- `agent_id`, `name`, `runtime` (`"api"` or `"cli"`);
- `current`: the work in hand, `{kind: "board_task" | "mission_task", id, title, since}` or null;
- `queue_depth`, `blocked: {count, open_asks}`, `watches: {active, needs_attention}`, `last_activity_at`;
- `cost_24h: {tokens, usd}`, **left out of every agent when `cost_available` is false**;
- for session (CLI) agents working a board Task, `session: {session_id, host_id, provider, model, live_tool, last_event, last_event_at, exit_reason, cwd, task_id, recent_tools}`, else null.

**Auto is not in the fleet.** The read-model lists the workspace's own roster minus ephemeral clones and minus the per-workspace system agent (Auto), so he never counts himself when asked how the team is doing. Platform system agents (`workspace_id` null) are left out too. An agent with no fleet entry has no live status: show it as idle.

Studio polls it every **10 s**. Do the same, and only while the page is visible. It is workspace-wide: one call covers every agent.

### Performance

`get_agent_performance` in `api/agent_endpoints.py` builds the answer. `success_rate` is already a percentage (0-100). Not measured: `average_memory_usage` and `average_cpu_usage` are always 0, `uptime_percentage` is 99.8 or 0 from the runtime status, and `overall_score` is 85 when the agent has no `performance_metrics`. With no `performance_metrics`, `success_rate`, `completed_tasks`, `failed_tasks` and `average_response_time` are 0 too, so show them only once `total_tasks` is above 0. `total_tokens_used`, `total_cost` and `total_requests` come from `model_usage_stats` and are real. Like `GET /api/agents/{id}`, it 404s an agent outside the workspace.

`GET /api/agents/{id}` adds `team`, `skills[]` (`{id, name, description, skill_type, …}`), `tools[]` (Composio apps, `{name, description, provider, category, …}`, names in capitals) and `session_tool_groups` to the list row.

### Chatting with an agent

Send `agentId: <integer id>` in the chat request (`chat-stream.md`). **Not a session (`cli`) agent:** the chat lane answers a message to one with a single `e:` line (code `session_agent_terminal`, "… runs as a Claude Code session in the Canvas terminal …", `_turn_chunks` in `api/chat.py`), so don't offer chat for them; give them a Task on the board. To change agent mid-conversation: `POST /api/chat/{chat_id}/switch-agent` with `{newAgentId, reason?}`. `GET /api/chat/agents` lists the agents chat can use.

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

- **Agents page:** Auto leads the crew as a larger card at the top, with his live state from the fleet (working when `current` is set, idle otherwise). Other agents are plain cards with no mascot. Because the core leaves Auto out of the fleet (above), he reads as idle until it includes him.
- **Playbooks:** Auto shows working while a run you started is in progress, celebrate when it completes, and oops when it fails. Nothing on the list.
