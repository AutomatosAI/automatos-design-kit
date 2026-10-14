"use client";

// The plan review (awaiting_approval): the tasks in order with their agent, each title and
// agent editable. Save changes sends them (PATCH /plan); Approve plan in the header sends
// any unsaved ones first. Titles are shown in fields, as text, never rendered.

import type { RunBusy } from "@/hooks/useMissionRun";
import type { AgentSummary } from "@/lib/agents/types";
import { agentOf, hasChanges, type PlanChanges, planProblem, titleOf, withAgent, withTitle } from "@/lib/missions/plan";
import { NO_AGENT, taskAgent } from "@/lib/missions/run";
import type { MissionTask } from "@/lib/missions/types";

import pageStyles from "../page/page.module.css";
import styles from "./run.module.css";

export const PLAN_LABEL = "The plan";
export const SAVE_PLAN = "Save changes";
export const APPROVE_SAVES = "Approve plan saves your changes first.";

export interface PlanReviewProps {
  /** In sequence. */
  readonly tasks: readonly MissionTask[];
  readonly agents: readonly AgentSummary[];
  readonly names: ReadonlyMap<number, string>;
  readonly changes: PlanChanges;
  readonly busy: RunBusy;
  readonly onChange: (changes: PlanChanges) => void;
  readonly onSave: () => void;
}

export function PlanReview({ tasks, agents, names, changes, busy, onChange, onSave }: PlanReviewProps) {
  const problem = planProblem(changes);
  const changed = hasChanges(changes);
  return (
    <>
      <ol className={styles.steps} aria-label={PLAN_LABEL}>
        {tasks.map((task, index) => (
          <PlanStep
            key={task.id}
            number={index + 1}
            task={task}
            agents={agents}
            names={names}
            changes={changes}
            onChange={onChange}
          />
        ))}
      </ol>
      {problem && (
        <p className={styles.alert} role="alert">
          {problem}
        </p>
      )}
      {changed && (
        <div className={styles.planActions}>
          <button type="button" className={pageStyles.secondary} disabled={busy !== null || problem !== null} onClick={onSave}>
            {SAVE_PLAN}
          </button>
          <p className={styles.note}>{APPROVE_SAVES}</p>
        </div>
      )}
    </>
  );
}

interface PlanStepProps {
  readonly number: number;
  readonly task: MissionTask;
  readonly agents: readonly AgentSummary[];
  readonly names: ReadonlyMap<number, string>;
  readonly changes: PlanChanges;
  readonly onChange: (changes: PlanChanges) => void;
}

function PlanStep({ number, task, agents, names, changes, onChange }: PlanStepProps) {
  const agentId = agentOf(changes, task);
  const listed = agentId !== null && agents.some((agent) => agent.id === agentId);
  return (
    <li className={styles.step}>
      <div className={styles.planFields}>
        <input
          className={styles.field}
          aria-label={`Step ${number} title`}
          value={titleOf(changes, task)}
          onChange={(event) => onChange(withTitle(changes, task, event.target.value))}
        />
        <select
          className={styles.select}
          aria-label={`Step ${number} agent`}
          value={agentId === null ? "" : String(agentId)}
          onChange={(event) => onChange(withAgent(changes, task, Number(event.target.value)))}
        >
          {agentId === null && (
            <option value="" disabled>
              {task.agentRole?.trim() || NO_AGENT}
            </option>
          )}
          {agentId !== null && !listed && <option value={String(agentId)}>{taskAgent(task, names)}</option>}
          {agents.map((agent) => (
            <option key={agent.id} value={String(agent.id)}>
              {agent.name.trim() || `Agent ${agent.id}`}
            </option>
          ))}
        </select>
      </div>
      {task.description && <p className={styles.note}>{task.description}</p>}
    </li>
  );
}
