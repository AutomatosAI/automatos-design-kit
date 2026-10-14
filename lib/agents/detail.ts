import { autoSlug, providerWords } from "@/lib/agents/crew";
import type { FleetSession } from "@/lib/agents/fleet";
import { parseAgentSummary, type AgentSummary } from "@/lib/agents/types";
import { isRecord, listOf, text } from "@/lib/client/types";
import { missionAge } from "@/lib/missions/list";

// One agent's own page (PRD-003 P-008), pure: GET /api/agents/{id} read into what the page
// shows (AgentResponse in the core's core/models/core.py: team, skills, tools on top of
// the list row), and the live session line from the fleet.

/** A skill or a tool (Composio app) the agent has: its name, and what it does when sent. */
export type AgentAbility = { readonly name: string; readonly description: string | null };

export type AgentDetail = AgentSummary & {
  readonly team: string | null;
  readonly skills: readonly AgentAbility[];
  readonly tools: readonly AgentAbility[];
};

function parseAbility(value: unknown): AgentAbility | null {
  if (!isRecord(value)) return null;
  const name = text(value.name)?.trim();
  if (!name) return null;
  const description = text(value.description)?.trim();
  return { name, description: description ? description : null };
}

export function parseAgentDetail(value: unknown): AgentDetail | null {
  const summary = parseAgentSummary(value);
  if (!summary || !isRecord(value)) return null;
  const team = text(value.team)?.trim();
  return {
    ...summary,
    team: team ? team : null,
    skills: listOf(value.skills, parseAbility),
    tools: listOf(value.tools, parseAbility),
  };
}

/** The workspace's own Auto (agents-playbooks.md, "Finding Auto"): never id 1. */
export function isAutoAgent(agent: AgentSummary, workspaceId: string): boolean {
  return agent.isSystemAgent && agent.slug === autoSlug(workspaceId);
}

/** "Job title · Team", whichever is known; null when neither is. */
export function jobLine(agent: Pick<AgentDetail, "jobTitle" | "team">): string | null {
  const parts = [agent.jobTitle, agent.team ? `${agent.team} team` : null].filter((part): part is string =>
    Boolean(part),
  );
  return parts.length ? parts.join(" · ") : null;
}

/** Claude Code's hook events and the host's own, in words (cli_host_service.py writes them). */
const EVENT_WORDS: Readonly<Record<string, string>> = {
  PreToolUse: "about to use a tool",
  PostToolUse: "used a tool",
  UserPromptSubmit: "got a prompt",
  Notification: "sent a notification",
  Stop: "finished its turn",
  SubagentStop: "a helper finished",
  SessionStart: "session started",
  SessionEnd: "session ended",
  TerminalOpened: "terminal opened",
  TerminalClosed: "terminal closed",
};

/** A hook event's name in words: the known ones from the table, others split ("PreCompact" -> "pre compact"). */
export function eventWords(event: string): string {
  const known = EVENT_WORDS[event];
  if (known) return known;
  return event
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
}

/** "Last event: used a tool, 2 min ago"; null when the host sent none. */
function lastEventLine(session: FleetSession, now: Date): string | null {
  if (!session.lastEvent) return null;
  const age = missionAge(session.lastEventAt, now);
  const when = age ? `, ${age === "Just now" ? "just now" : age}` : "";
  return `Last event: ${eventWords(session.lastEvent)}${when}`;
}

/**
 * A session agent's live line from the fleet: "Claude code · opus · Using Edit · Last
 * event: used a tool, 1 min ago". Whatever the host sent; null when it sent nothing.
 */
export function sessionLine(session: FleetSession, now: Date): string | null {
  const parts = [
    session.provider ? providerWords(session.provider) : null,
    session.model,
    session.liveTool ? `Using ${session.liveTool}` : null,
    lastEventLine(session, now),
  ].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(" · ") : null;
}

export const NO_SESSION = "No live session right now. It starts when the agent picks up a Task on the board.";
