import { runtimeOf, type AgentRuntime } from "@/lib/agents/types";
import { count, idOf, isRecord, listOf, text } from "@/lib/client/types";

// GET /api/v1/fleet (agents-playbooks.md, "Live status"): what each agent is doing now.
// Shape from the core's services/fleet_state.py. The core leaves Auto out of the fleet
// (he is the one asking how the team is doing), so his entry is usually missing.

/** The work in hand: a board Task or a Mission step. */
export type FleetWork = {
  readonly kind: string;
  readonly id: string;
  readonly title: string;
  readonly since: string | null;
};

export type FleetCost = { readonly tokens: number; readonly usd: number };

/** A session agent's live facts, from the CLI host. */
export type FleetSession = {
  readonly provider: string | null;
  readonly model: string | null;
  readonly liveTool: string | null;
  /** The last hook event the host reported ("PreToolUse", "TerminalOpened"), and when. */
  readonly lastEvent: string | null;
  readonly lastEventAt: string | null;
};

export type FleetAgent = {
  readonly agentId: number;
  readonly runtime: AgentRuntime;
  readonly current: FleetWork | null;
  readonly queueDepth: number;
  readonly blockedCount: number;
  readonly lastActivityAt: string | null;
  /** Rolling 24 h; null when the core couldn't count it (cost_available false). */
  readonly cost24h: FleetCost | null;
  readonly session: FleetSession | null;
};

export type Fleet = {
  readonly agents: readonly FleetAgent[];
  readonly generatedAt: string | null;
};

function parseWork(value: unknown): FleetWork | null {
  if (!isRecord(value)) return null;
  const id = idOf(value.id);
  if (!id) return null;
  return { kind: text(value.kind) ?? "", id, title: text(value.title)?.trim() ?? "", since: text(value.since) };
}

function parseCost(value: unknown): FleetCost | null {
  if (!isRecord(value)) return null;
  return { tokens: Math.max(0, count(value.tokens, 0)), usd: Math.max(0, count(value.usd, 0)) };
}

function parseSession(value: unknown): FleetSession | null {
  if (!isRecord(value)) return null;
  return {
    provider: text(value.provider),
    model: text(value.model),
    liveTool: text(value.live_tool),
    lastEvent: text(value.last_event),
    lastEventAt: text(value.last_event_at),
  };
}

export function parseFleetAgent(value: unknown): FleetAgent | null {
  if (!isRecord(value)) return null;
  const agentId = count(value.agent_id, Number.NaN);
  if (!Number.isInteger(agentId)) return null;
  const blocked: Readonly<Record<string, unknown>> = isRecord(value.blocked) ? value.blocked : {};
  return {
    agentId,
    runtime: runtimeOf({ runtime: value.runtime }),
    current: parseWork(value.current),
    queueDepth: Math.max(0, count(value.queue_depth, 0)),
    blockedCount: Math.max(0, count(blocked.count, 0)),
    lastActivityAt: text(value.last_activity_at),
    cost24h: parseCost(value.cost_24h),
    session: parseSession(value.session),
  };
}

export function parseFleet(value: unknown): Fleet {
  if (!isRecord(value)) return { agents: [], generatedAt: null };
  return { agents: listOf(value.agents, parseFleetAgent), generatedAt: text(value.generated_at) };
}

/** agent id -> its live entry. */
export function fleetById(fleet: Fleet | null): ReadonlyMap<number, FleetAgent> {
  return new Map((fleet?.agents ?? []).map((entry): [number, FleetAgent] => [entry.agentId, entry]));
}
