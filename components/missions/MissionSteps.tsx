// A running (or finished) Mission's steps, in sequence: each with its state as words, its
// agent, its tokens, what it produced so far (as plain text) and, when it failed, why.

import { StateChip } from "@/components/page/StateChip";
import { readable, taskAgent, taskChip, tokensWords } from "@/lib/missions/run";
import type { MissionTask } from "@/lib/missions/types";

import styles from "./run.module.css";

export const STEPS_LABEL = "Mission steps";
export const NO_STEPS = "No steps yet. Auto is still working out the plan.";

export interface MissionStepsProps {
  /** In sequence. */
  readonly tasks: readonly MissionTask[];
  readonly names: ReadonlyMap<number, string>;
}

export function MissionSteps({ tasks, names }: MissionStepsProps) {
  if (tasks.length === 0) return <p className={styles.note}>{NO_STEPS}</p>;
  return (
    <ol className={styles.steps} aria-label={STEPS_LABEL}>
      {tasks.map((task) => (
        <MissionStep key={task.id} task={task} agent={taskAgent(task, names)} />
      ))}
    </ol>
  );
}

function stepMeta(task: MissionTask, agent: string): string {
  const parts = [agent, task.tokensUsed > 0 ? tokensWords(task.tokensUsed) : null, task.attemptNumber > 1 ? `attempt ${task.attemptNumber}` : null];
  return parts.filter((part): part is string => part !== null).join(" · ");
}

/** Why a failed step failed: the backend's detail, else its reason code in words. */
function failureText(task: MissionTask): string | null {
  if (task.state !== "failed") return null;
  if (task.failureDetail?.trim()) return task.failureDetail;
  return task.failureReasonCode ? readable(task.failureReasonCode) : null;
}

function MissionStep({ task, agent }: { readonly task: MissionTask; readonly agent: string }) {
  const failure = failureText(task);
  return (
    <li className={styles.step}>
      <div className={styles.stepHead}>
        <h3 className={styles.stepTitle}>{task.title.trim() || `Step ${task.sequenceNumber}`}</h3>
        <StateChip {...taskChip(task.state)} />
      </div>
      <p className={styles.stepMeta}>{stepMeta(task, agent)}</p>
      {task.outputExcerpt && <p className={styles.excerpt}>{task.outputExcerpt}</p>}
      {failure && <p className={styles.failure}>{failure}</p>}
    </li>
  );
}
