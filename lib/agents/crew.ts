import type { StateChipProps } from "@/components/page/StateChip";
import type { FleetAgent, FleetCost } from "@/lib/agents/fleet";
import type { AgentRuntime, AgentSummary, AgentSwitchState } from "@/lib/agents/types";
import type { MascotName } from "@/lib/mascot/types";
import { missionAge } from "@/lib/missions/list";

// The Agents page (PRD-003 P-007), pure: finding Auto, the filter chips and search, and
// each card's words. Live facts come from the fleet; an agent with no fleet entry (Auto,
// whom the core leaves out of it) reads as idle.

export type CrewFilter = "all" | "api" | "session";

export const CREW_FILTERS: readonly { readonly value: CrewFilter; readonly label: string }[] = [
  { value: "all", label: "All" },
  { value: "api", label: "API" },
  { value: "session", label: "Session" },
];

export const RUNTIME_LABELS: Readonly<Record<AgentRuntime, string>> = { api: "API", session: "Session" };

/** Auto's slug in a workspace (agents-playbooks.md, "Finding Auto"). Never assume id 1. */
export function autoSlug(workspaceId: string): string {
  return `auto-${workspaceId}`;
}

/** The workspace's Auto: a system agent with slug auto-<workspace id>; null when the list lacks him. */
export function findAuto(agents: readonly AgentSummary[], workspaceId: string): AgentSummary | null {
  const slug = autoSlug(workspaceId);
  return agents.find((agent) => agent.isSystemAgent && agent.slug === slug) ?? null;
}

/** Everyone but Auto, in the backend's order. */
export function crewOf(agents: readonly AgentSummary[], auto: AgentSummary | null): readonly AgentSummary[] {
  return auto ? agents.filter((agent) => agent.id !== auto.id) : agents;
}

/** The chip, then the search by name (case and spaces ignored). */
export function filterCrew(agents: readonly AgentSummary[], filter: CrewFilter, search: string): readonly AgentSummary[] {
  const needle = search.trim().toLowerCase();
  return agents.filter(
    (agent) => (filter === "all" || agent.runtime === filter) && (!needle || agent.name.toLowerCase().includes(needle)),
  );
}

/** "6 agents · 2 working · 1 session agent", Auto included. */
export function crewCount(agents: readonly AgentSummary[], fleet: ReadonlyMap<number, FleetAgent>): string {
  const working = agents.filter((agent) => fleet.get(agent.id)?.current).length;
  const sessions = agents.filter((agent) => agent.runtime === "session").length;
  return [
    `${agents.length} ${agents.length === 1 ? "agent" : "agents"}`,
    `${working} working`,
    ...(sessions > 0 ? [`${sessions} session ${sessions === 1 ? "agent" : "agents"}`] : []),
  ].join(" · ");
}

/** Only agents the workspace owns can be switched: not Auto, not the platform's system agents. */
export function canSwitch(agent: AgentSummary): boolean {
  return !agent.isSystemAgent;
}

export function isOn(agent: AgentSummary): boolean {
  return agent.status !== "inactive";
}

/** The status the switch sends to turn the agent the other way. */
export function switchTarget(agent: AgentSummary): AgentSwitchState {
  return isOn(agent) ? "inactive" : "active";
}

/** The agent's state as a chip: off, then live work, then what holds it up, else idle. */
export function crewStatus(agent: AgentSummary, live: FleetAgent | undefined): StateChipProps {
  if (!isOn(agent)) return { tone: "paused", label: "Off" };
  if (live?.current) return { tone: "running", label: "Working" };
  if (live && live.blockedCount > 0) return { tone: "needs-you", label: "Blocked" };
  if (agent.unavailable) return { tone: "paused", label: "Can't run now" };
  if (live && live.queueDepth > 0) return { tone: "queued", label: "Queued" };
  if (agent.status === "training") return { tone: "idle", label: "Training" };
  return { tone: "idle", label: "Idle" };
}

/** "claude_code" -> "Claude code"; "anthropic" -> "Anthropic". */
function providerWords(provider: string): string {
  const spaced = provider.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** "Anthropic · claude-sonnet-4-5"; whichever half is known; null when neither is. */
export function modelRoute(agent: Pick<AgentSummary, "provider" | "model">): string | null {
  const parts = [agent.provider ? providerWords(agent.provider) : null, agent.model].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length ? parts.join(" · ") : null;
}

/** "Working on Draft the launch post"; null when there is nothing in hand. */
export function workLine(live: FleetAgent | undefined): string | null {
  if (!live?.current) return null;
  return live.current.title ? `Working on ${live.current.title}` : "Working on a Task";
}

/** "Last active 5 min ago"; null when the fleet has no date. */
export function lastActiveLine(live: FleetAgent | undefined, now: Date): string | null {
  const age = missionAge(live?.lastActivityAt ?? null, now);
  if (!age) return null;
  return `Last active ${age === "Just now" ? "just now" : age}`;
}

const numbers = new Intl.NumberFormat("en-GB");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const SMALLEST_SHOWN_USD = 0.01;

function tokensShort(tokens: number): string {
  return `${numbers.format(tokens)} ${tokens === 1 ? "token" : "tokens"}`;
}

function dollars(usd: number): string {
  return usd > 0 && usd < SMALLEST_SHOWN_USD ? `under ${money.format(SMALLEST_SHOWN_USD)}` : money.format(usd);
}

/**
 * The last 24 h. A session agent runs on the person's own plan, so it shows tokens and
 * never dollars; an API agent shows what it cost. null when the fleet couldn't count it.
 */
export function costLine(runtime: AgentRuntime, cost: FleetCost | null | undefined): string | null {
  if (!cost) return null;
  if (runtime === "session") return `${tokensShort(cost.tokens)} in 24 h · on your plan`;
  return `${dollars(cost.usd)} in 24 h`;
}

/** Auto follows his own fleet entry: working while he has something in hand, idle otherwise. */
export function autoMascot(live: FleetAgent | undefined): MascotName {
  return live?.current ? "working" : "idle";
}

export const AUTO_IDLE_WORDS = "Nothing in hand. Ask me in chat.";

/** His current work in words, under the mascot. */
export function autoWorkWords(live: FleetAgent | undefined): string {
  return workLine(live) ?? AUTO_IDLE_WORDS;
}

export type SwitchWords = { readonly question: string; readonly confirm: string; readonly keep: string };

/** The in-page confirmation for the switch: what it will do, and the two ways out. */
export function switchWords(agent: AgentSummary): SwitchWords {
  const name = agent.name.trim() || "this agent";
  return isOn(agent)
    ? { question: `Switch ${name} off? It won't take new work until you switch it back on.`, confirm: "Switch off", keep: "Keep on" }
    : { question: `Switch ${name} on? It can take work again.`, confirm: "Switch on", keep: "Keep off" };
}

/** "Research · Senior analyst", or the category alone (Studio's role line). */
export function roleLine(categoryLabel: string, jobTitle: string | null): string {
  return jobTitle ? `${categoryLabel} · ${jobTitle}` : categoryLabel;
}

/** An agent's own page (P-008). */
export function agentHref(id: number): string {
  return `/agents/${id}`;
}
