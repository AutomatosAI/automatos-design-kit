import { count, isRecord, listOf, text } from "@/lib/client/types";

// An agent as Play reads it from GET /api/agents/ (agents-playbooks.md): what the Mission
// run page joins names with, and what the Agents page shows on a card.

/** Which lane runs it: "api" (Automatos calls the model) or "session" (configuration.runtime "cli"). */
export type AgentRuntime = "api" | "session";

/** The only change Play makes to an agent: on or off (PUT {status}). */
export const AGENT_SWITCH_STATES = ["active", "inactive"] as const;
export type AgentSwitchState = (typeof AGENT_SWITCH_STATES)[number];

export type AgentSummary = {
  readonly id: number;
  readonly name: string;
  readonly slug: string | null;
  /** "active", "inactive" or "training"; kept as sent. */
  readonly status: string | null;
  readonly isSystemAgent: boolean;
  readonly description: string | null;
  readonly jobTitle: string | null;
  readonly agentType: string | null;
  /** marketplace_category, else configuration.category: picks the icon (there is no avatar). */
  readonly category: string | null;
  readonly runtime: AgentRuntime;
  /** API agents: agent_model_config; session agents: the CLI's provider and model in configuration. */
  readonly provider: string | null;
  readonly model: string | null;
  /** Why it can't run now (the AI credit ran out, no CLI host online); null when it can. */
  readonly unavailable: string | null;
};

export type AgentQuery = {
  /** Without it, Auto is left out. The client sends true unless told otherwise. */
  readonly includeWorkspaceSystem?: boolean;
  readonly limit?: number;
  readonly skip?: number;
  readonly status?: string;
  readonly search?: string;
};

const CLI_RUNTIME = "cli";

/** The core's path is /api/agents/{agent_id:int}; Play takes whole numbers only. */
const AGENT_ID = /^[1-9]\d{0,11}$/;

/** A page's or a route's id segment: anything else is no agent at all. */
export function isAgentId(raw: string): boolean {
  return AGENT_ID.test(raw);
}

type Json = Readonly<Record<string, unknown>>;
const EMPTY: Json = {};

/** The object under key, or an empty one (typed, so property reads stay unknown). */
function objectAt(value: Json, key: string): Json {
  const found = value[key];
  return isRecord(found) ? found : EMPTY;
}

function blankToNull(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** The core's runtime_kind_of: "cli" (any case) is a session agent, anything else API. */
export function runtimeOf(configuration: unknown): AgentRuntime {
  const raw = isRecord(configuration) ? text(configuration.runtime) : null;
  return raw?.trim().toLowerCase() === CLI_RUNTIME ? "session" : "api";
}

/** The model route: a session agent's CLI settings, an API agent's model config (model_id). */
function modelOf(value: Json, runtime: AgentRuntime): { provider: string | null; model: string | null } {
  if (runtime === "session") {
    const config = objectAt(value, "configuration");
    return { provider: blankToNull(text(config.provider)), model: blankToNull(text(config.model)) };
  }
  const config = objectAt(value, "agent_model_config");
  return {
    provider: blankToNull(text(config.provider)),
    model: blankToNull(text(config.model_id) ?? text(config.model)),
  };
}

function categoryOf(value: Json): string | null {
  const config = objectAt(value, "configuration");
  return blankToNull(text(value.marketplace_category)) ?? blankToNull(text(config.category));
}

/** Agent ids are integers; a row without one is dropped. */
export function parseAgentSummary(value: unknown): AgentSummary | null {
  if (!isRecord(value)) return null;
  const id = count(value.id, Number.NaN);
  if (!Number.isInteger(id)) return null;
  const runtime = runtimeOf(value.configuration);
  return {
    id,
    name: text(value.name) ?? "",
    slug: text(value.slug),
    status: text(value.status),
    isSystemAgent: value.is_system_agent === true,
    description: blankToNull(text(value.description)),
    jobTitle: blankToNull(text(value.job_title)),
    agentType: blankToNull(text(value.agent_type)),
    category: categoryOf(value),
    runtime,
    ...modelOf(value, runtime),
    unavailable: blankToNull(text(value.unavailable)),
  };
}

/** The backend answers a bare list. */
export function parseAgentList(value: unknown): readonly AgentSummary[] {
  return listOf(value, parseAgentSummary);
}
