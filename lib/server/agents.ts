import { AGENT_SWITCH_STATES, isAgentId } from "@/lib/agents/types";
import { type BodyCheck, forwardToBackend, invalidId } from "@/lib/server/forward";

// The agent routes under /api/agents/[id] (agents-playbooks.md). Agent ids are integers
// (the backend's path is /api/agents/{agent_id:int}), checked before they touch a path.
// Play only switches agents on and off: PUT carries {status} and nothing else. The
// backend would switch Auto too (he is workspace-owned); the page never offers it, and
// rejectCrossSite keeps every caller to the person at this install.

export type AgentContext = { params: Promise<{ id: string }> };

export type AgentForward = {
  /** What follows /api/agents/{id}: "" for the agent itself, "/performance". */
  readonly suffix: string;
  readonly query?: readonly string[];
  readonly jsonBody?: boolean;
  readonly checkBody?: (body: Readonly<Record<string, unknown>>) => BodyCheck;
};

const STATUS_ONLY = "Play can only switch an agent on or off: send {status: \"active\"} or {status: \"inactive\"}";

/** The id as a backend path segment, or null when it isn't a whole number. */
export function agentPathId(raw: string): string | null {
  return isAgentId(raw) ? raw : null;
}

/** {status: "active" | "inactive"} only; any other field, or any other status, is refused. */
export function statusOnly(body: Readonly<Record<string, unknown>>): BodyCheck {
  const keys = Object.keys(body);
  const status = body.status;
  const known = AGENT_SWITCH_STATES.find((state) => state === status);
  if (keys.length !== 1 || keys[0] !== "status" || !known) return { ok: false, error: STATUS_ONLY };
  return { ok: true, value: { status: known } };
}

export async function forwardAgent(request: Request, context: AgentContext, options: AgentForward): Promise<Response> {
  const id = agentPathId((await context.params).id);
  if (!id) return invalidId();
  const { suffix, ...rest } = options;
  return forwardToBackend(request, { path: `/api/agents/${id}${suffix}`, ...rest });
}
