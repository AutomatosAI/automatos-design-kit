import type { MissionTask, PlanEdit } from "@/lib/missions/types";

// The plan review's edits (PATCH /api/missions/{id}/plan, valid only while the Mission
// awaits approval). Only what the user changed is kept, by task id. Pure: every update
// returns a new set of changes.

export type TaskChange = { readonly title?: string; readonly agentId?: number };

export type PlanChanges = Readonly<Record<string, TaskChange>>;

export const NO_CHANGES: PlanChanges = {};

/** orchestrator/api/missions.py MissionTaskEdit: title max_length=500. */
export const TITLE_MAX = 500;

function withChange(changes: PlanChanges, task: MissionTask, change: TaskChange): PlanChanges {
  const merged = { ...changes[task.id], ...change };
  const kept: TaskChange = {
    ...(merged.title !== undefined && merged.title !== task.title ? { title: merged.title } : {}),
    ...(merged.agentId !== undefined && merged.agentId !== task.assignedAgentId ? { agentId: merged.agentId } : {}),
  };
  const rest = Object.fromEntries(Object.entries(changes).filter(([id]) => id !== task.id));
  return Object.keys(kept).length === 0 ? rest : { ...rest, [task.id]: kept };
}

export function withTitle(changes: PlanChanges, task: MissionTask, title: string): PlanChanges {
  return withChange(changes, task, { title });
}

export function withAgent(changes: PlanChanges, task: MissionTask, agentId: number): PlanChanges {
  return withChange(changes, task, { agentId });
}

/** Only the edits for tasks still in the plan: a replan brings new task ids. */
export function forTasks(changes: PlanChanges, tasks: readonly MissionTask[]): PlanChanges {
  const ids = new Set(tasks.map((task) => task.id));
  const kept = Object.entries(changes).filter(([id]) => ids.has(id));
  return kept.length === Object.keys(changes).length ? changes : Object.fromEntries(kept);
}

export function hasChanges(changes: PlanChanges): boolean {
  return Object.keys(changes).length > 0;
}

/** The title the review shows: the user's edit, else the task's own. */
export function titleOf(changes: PlanChanges, task: MissionTask): string {
  return changes[task.id]?.title ?? task.title;
}

/** The agent the review shows, or null when none is assigned. */
export function agentOf(changes: PlanChanges, task: MissionTask): number | null {
  return changes[task.id]?.agentId ?? task.assignedAgentId;
}

/** null when every edited title can be sent. */
export function planProblem(changes: PlanChanges): string | null {
  const titles = Object.values(changes).flatMap((change) => (change.title === undefined ? [] : [change.title.trim()]));
  if (titles.some((title) => title === "")) return "Every step needs a title.";
  if (titles.some((title) => title.length > TITLE_MAX)) return `Keep each step's title under ${TITLE_MAX} characters.`;
  return null;
}

/** The task_edits to send, one per changed task, named by its id. */
export function planEdits(changes: PlanChanges): readonly PlanEdit[] {
  return Object.entries(changes).map(([taskId, change]) => ({
    taskId,
    ...(change.title !== undefined ? { title: change.title.trim() } : {}),
    ...(change.agentId !== undefined ? { agentId: change.agentId } : {}),
  }));
}
