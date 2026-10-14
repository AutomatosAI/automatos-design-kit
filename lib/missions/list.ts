import type { RunProgress } from "@/components/page/parts";
import type { Mission, MissionState, MissionStats, TaskProgress } from "@/lib/missions/types";

// The Missions list (PRD-003 P-004), pure: the filter chips and the states behind them,
// merging pages, the card's words and the stats strip. The backend filters by one state
// at a time, so a chip with several states asks once per state and merges the answers.

export const MISSION_PAGE_SIZE = 20;
/** The goal's limits (missions.md: POST /api/missions, goal 1-10000 characters). */
export const GOAL_MAX = 10_000;

export type MissionFilter = "all" | "active" | "needs-you" | "done" | "failed";

export type MissionFilterOption = {
  readonly value: MissionFilter;
  readonly label: string;
  /** The states asked for, one call each; null asks for every Mission in one call. */
  readonly states: readonly MissionState[] | null;
};

export const MISSION_FILTERS: readonly MissionFilterOption[] = [
  { value: "all", label: "All", states: null },
  { value: "active", label: "Active", states: ["pending", "planning", "replanning", "running", "verifying", "paused"] },
  { value: "needs-you", label: "Needs you", states: ["awaiting_approval", "awaiting_human"] },
  { value: "done", label: "Done", states: ["completed"] },
  { value: "failed", label: "Failed", states: ["failed"] },
];

/** One call's state filter, or undefined for every Mission. */
export type StateQuery = MissionState | undefined;

/** The cursor key for a state query ("all" for every Mission). */
export function queryKey(state: StateQuery): string {
  return state ?? "all";
}

export function statesFor(filter: MissionFilter): readonly StateQuery[] {
  const option = MISSION_FILTERS.find((candidate) => candidate.value === filter);
  return option?.states ?? [undefined];
}

/** How far each state query has been read, and how many it has in all. */
export type Cursor = { readonly loaded: number; readonly total: number };
export type Cursors = Readonly<Record<string, Cursor>>;

function createdTime(mission: Mission): number {
  const time = mission.createdAt ? Date.parse(mission.createdAt) : Number.NaN;
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/** Newest first; a Mission in `incoming` replaces the same id in `loaded` (its state moved on). */
export function mergeMissions(loaded: readonly Mission[], incoming: readonly Mission[]): readonly Mission[] {
  const fresh = new Map(incoming.map((mission) => [mission.id, mission]));
  const kept = loaded.filter((mission) => !fresh.has(mission.id));
  return [...kept, ...incoming].sort((a, b) => createdTime(b) - createdTime(a));
}

/** The further of two reads per query, with the newer total. */
export function mergeCursors(older: Cursors, newer: Cursors): Cursors {
  const keys = new Set([...Object.keys(older), ...Object.keys(newer)]);
  return Object.fromEntries(
    [...keys].map((key) => {
      const before = older[key];
      const after = newer[key];
      const total = after?.total ?? before?.total ?? 0;
      return [key, { loaded: Math.max(before?.loaded ?? 0, after?.loaded ?? 0), total }];
    }),
  );
}

/** A page read from `offset`. An empty page ends that query, whatever its total said. */
export function cursorAfter(offset: number, received: number, total: number): Cursor {
  return { loaded: received === 0 ? Math.max(total, offset) : offset + received, total };
}

export function totalOf(cursors: Cursors): number {
  return Object.values(cursors).reduce((sum, cursor) => sum + cursor.total, 0);
}

export function hasMore(cursors: Cursors): boolean {
  return Object.values(cursors).some((cursor) => cursor.loaded < cursor.total);
}

/** Where a Mission opens (P-005's run page). */
export function missionHref(id: string): string {
  return `/missions/${encodeURIComponent(id)}`;
}

export const UNTITLED_MISSION = "Untitled Mission";
/** A card shows two lines of the goal; a goal can be 10000 characters, so cut it well before that. */
const GOAL_PREVIEW_MAX = 240;

/** The goal on one line, cut to a card's worth. */
export function goalPreview(goal: string): string {
  const line = goal.replace(/\s+/g, " ").trim();
  if (!line) return UNTITLED_MISSION;
  return line.length > GOAL_PREVIEW_MAX ? `${line.slice(0, GOAL_PREVIEW_MAX - 1).trimEnd()}…` : line;
}

/** "1 Mission", "12 Missions". */
export function missionCount(total: number): string {
  return `${total} ${total === 1 ? "Mission" : "Missions"}`;
}

const MINUTE_MS = 60_000;
const HOUR_MINUTES = 60;
const DAY_HOURS = 24;

/** "Just now", "5 min ago", "3 h ago", "2 days ago"; "" when the date is missing or unreadable. */
export function missionAge(createdAt: string | null, now: Date): string {
  const time = createdAt ? Date.parse(createdAt) : Number.NaN;
  if (Number.isNaN(time)) return "";
  const minutes = Math.floor((now.getTime() - time) / MINUTE_MS);
  if (minutes < 1) return "Just now";
  if (minutes < HOUR_MINUTES) return `${minutes} min ago`;
  const hours = Math.floor(minutes / HOUR_MINUTES);
  if (hours < DAY_HOURS) return `${hours} h ago`;
  const days = Math.floor(hours / DAY_HOURS);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

const numbers = new Intl.NumberFormat("en-GB");

/** What it has cost so far, in tokens; null when nothing is known yet. */
export function tokensLine(tokensUsed: number): string | null {
  return tokensUsed > 0 ? `${numbers.format(tokensUsed)} tokens` : null;
}

/** The card's bar, from the backend's own counts; none when the row doesn't carry them. */
export function cardProgress(progress: TaskProgress | null): RunProgress | null {
  if (!progress || progress.total <= 0) return null;
  const word = progress.total === 1 ? "step" : "steps";
  return { value: progress.done, max: progress.total, label: `${progress.done} of ${progress.total} ${word} done` };
}

export type StatFigure = { readonly label: string; readonly value: string };

/** "45 min", "1 h 5 min", "—" when no Mission has finished. */
export function durationWords(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes) || minutes < 0) return "—";
  if (minutes < 1) return "Under a minute";
  const whole = Math.round(minutes);
  if (whole < HOUR_MINUTES) return `${whole} min`;
  const rest = whole % HOUR_MINUTES;
  const hours = Math.floor(whole / HOUR_MINUTES);
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** The strip over the list: the last 30 days. success_rate arrives as 0-1. */
export function statFigures(stats: MissionStats): readonly StatFigure[] {
  return [
    { label: "Missions", value: numbers.format(stats.totalMissions) },
    { label: "Success rate", value: `${Math.round(stats.successRate * 100)}%` },
    { label: "Average time", value: durationWords(stats.avgDurationMinutes) },
  ];
}

export type GoalCheck =
  | { readonly ok: true; readonly goal: string }
  | { readonly ok: false; readonly reason: "empty" | "too-long"; readonly length: number };

/** The goal as it will be sent (trimmed), or why it can't be. */
export function checkGoal(draft: string): GoalCheck {
  const goal = draft.trim();
  if (goal.length === 0) return { ok: false, reason: "empty", length: 0 };
  if (goal.length > GOAL_MAX) return { ok: false, reason: "too-long", length: goal.length };
  return { ok: true, goal };
}

/** "120 / 10,000". */
export function goalCounter(draft: string): string {
  return `${numbers.format(draft.trim().length)} / ${numbers.format(GOAL_MAX)}`;
}

export function tooLongSentence(length: number): string {
  const over = length - GOAL_MAX;
  return `That's ${numbers.format(over)} ${over === 1 ? "character" : "characters"} over the limit. Shorten the goal to start.`;
}

export function emptyListMessage(filter: MissionFilter): string {
  if (filter === "all") return "No Missions yet. Start one with New Mission, or from a chat with Auto.";
  if (filter === "needs-you") return "Nothing needs you right now.";
  if (filter === "active") return "Nothing is running right now.";
  if (filter === "done") return "No finished Missions yet.";
  return "No failed Missions.";
}
