"use client";

// One Mission's run (PRD-003 P-005) on the live run page: the goal, its state as words and
// only the actions that state allows; the plan review while it awaits approval, else the
// steps and progress; the activity feed; Auto following this Mission; and the side panel
// (cost, times, Deliverables). The Mission is polled every 10 s while the tab is visible,
// and no more once it has ended.

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { AutoMascot } from "@/components/mascot/AutoMascot";
import { BackLink, PageFailed, PageLoading } from "@/components/page/parts";
import { LiveRunPage } from "@/components/page/LiveRunPage";
import { PageColumns } from "@/components/shell/PageColumns";
import { useMissionActivity } from "@/hooks/useMissionActivity";
import { MISSION_FAILED, type MissionRun, type RunRequest, useMissionRun } from "@/hooks/useMissionRun";
import { useMissionSide } from "@/hooks/useMissionSide";
import { api, ApiError, type ApiClient } from "@/lib/client/api";
import type { MascotName } from "@/lib/mascot/types";
import { cardProgress, goalPreview } from "@/lib/missions/list";
import { missionCaption, missionMascot } from "@/lib/missions/mascot";
import { forTasks, NO_CHANGES, type PlanChanges, planProblem } from "@/lib/missions/plan";
import {
  AWAITING_HUMAN_NOTE,
  type ConfirmedAction,
  headerActions,
  type HeaderAction,
  needsConfirming,
  sortedTasks,
} from "@/lib/missions/run";
import { stateChip } from "@/lib/missions/states";
import type { MissionDetail } from "@/lib/missions/types";

import pageStyles from "../page/page.module.css";
import { MissionActivity } from "./MissionActivity";
import { ConfirmPanel, MissionRunActions } from "./MissionRunActions";
import { MissionSidePanel, SIDE_LABEL } from "./MissionSidePanel";
import { MissionSteps } from "./MissionSteps";
import { PlanReview } from "./PlanReview";
import styles from "./run.module.css";

export const BACK = { href: "/missions", label: "Missions" } as const;
export const LOADING_MISSION = "Loading this Mission…";

export interface MissionRunScreenProps {
  readonly id: string;
  /** Tests pass their own (createApiClient with a mock fetch). */
  readonly client?: ApiClient;
  /** The detail poll's interval; POLL_INTERVALS.MISSION_DETAIL unless a test wants it faster. */
  readonly intervalMs?: number;
  /** What "now" is for the Deliverables' dates; tests pin it. */
  readonly now?: Date;
}

export function MissionRunScreen({ id, client = api, intervalMs, now }: MissionRunScreenProps) {
  const run = useMissionRun(client, id, intervalMs);
  const { state, refresh } = run.poll;
  if (state.status === "ready") {
    return <MissionRunView mission={state.value} run={run} client={client} now={now ?? new Date()} />;
  }
  return (
    <PageColumns>
      <div className={pageStyles.runPage}>
        <BackLink {...BACK} />
        {state.status === "loading" ? (
          <PageLoading text={LOADING_MISSION} />
        ) : (
          <PageFailed error={failedSentence(state.error)} retry={() => void refresh()} />
        )}
      </div>
    </PageColumns>
  );
}

function failedSentence(error: unknown): string {
  return error instanceof ApiError ? `${MISSION_FAILED} ${error.message}` : MISSION_FAILED;
}

interface ViewProps {
  readonly mission: MissionDetail;
  readonly run: MissionRun;
  readonly client: ApiClient;
  readonly now: Date;
}

function MissionRunView({ mission, run, client, now }: ViewProps) {
  const side = useMissionSide(client, mission.id, mission.state, mission.tokensUsed);
  const activity = useMissionActivity(client, mission.id, mission.recentEvents);
  const auto = useMissionMascot(mission.state);
  const controls = useRunControls(mission, run);
  const reviewing = mission.state === "awaiting_approval";
  const tasks = sortedTasks(mission.tasks);
  const progress = reviewing ? null : cardProgress(mission.taskProgress);

  return (
    <LiveRunPage
      back={BACK}
      title={goalPreview(mission.goal)}
      state={controls.chip}
      actions={
        controls.actions.length > 0 && (
          <MissionRunActions actions={controls.actions} busy={run.busy} confirming={controls.confirming} onAction={controls.onAction} />
        )
      }
      lead={<RunLead mission={mission} run={run} confirming={controls.confirming} onConfirm={controls.onConfirm} onKeep={controls.keep} />}
      progress={progress ?? undefined}
      steps={
        reviewing ? (
          <PlanReview
            tasks={tasks}
            agents={run.agents}
            names={run.names}
            changes={controls.changes}
            busy={run.busy}
            onChange={controls.setChanges}
            onSave={controls.savePlan}
          />
        ) : (
          <MissionSteps tasks={tasks} names={run.names} />
        )
      }
      activity={<MissionActivity activity={activity} />}
      mascot={<AutoMascot state={auto.mascot} onClipEnded={auto.onClipEnded} caption={missionCaption(mission.state)} />}
      side={<MissionSidePanel mission={mission} side={side} client={client} now={now} />}
      sideLabel={SIDE_LABEL}
    />
  );
}

/** Auto follows this Mission; a completed one celebrates once, then he idles. */
function useMissionMascot(state: string) {
  const [celebrated, setCelebrated] = useState(false);
  const onClipEnded = useCallback((ended: MascotName) => {
    if (ended === "celebrate") setCelebrated(true);
  }, []);
  return { mascot: missionMascot(state, celebrated), onClipEnded };
}

/** The header's buttons, the confirmation they open and the plan edits Approve sends. */
function useRunControls(mission: MissionDetail, run: MissionRun) {
  const router = useRouter();
  const [asked, setAsked] = useState<ConfirmedAction | null>(null);
  const [edits, setChanges] = useState<PlanChanges>(NO_CHANGES);
  // Edits belong to this plan review: none outside it, none for tasks a replan replaced.
  const changes = mission.state === "awaiting_approval" ? forTasks(edits, mission.tasks) : NO_CHANGES;
  const actions = headerActions(mission.state);
  // A confirmation for a move the Mission no longer allows closes by itself.
  const confirming = asked && actions.includes(asked) ? asked : null;
  const { run: send } = run;

  // Edits that went through are the plan now: the review starts clean.
  const clearOnSuccess = (ok: boolean) => {
    if (ok) setChanges(NO_CHANGES);
  };

  const onAction = (action: HeaderAction) => {
    if (needsConfirming(action)) return setAsked(action);
    if (action !== "approve") return void send({ action });
    // A blank or too long title is already called out under the plan: nothing to send.
    if (!planProblem(changes)) void send({ action, changes }).then(clearOnSuccess);
  };

  const onConfirm = async (reason: string) => {
    if (!confirming) return;
    const request: RunRequest = confirming === "reject" ? { action: "reject", reason } : { action: confirming };
    if (!(await send(request))) return;
    setAsked(null);
    if (request.action === "reject") setChanges(NO_CHANGES);
    if (request.action === "delete") router.push(BACK.href);
  };

  const savePlan = () => void send({ action: "save-plan", changes }).then(clearOnSuccess);

  return {
    chip: stateChip(mission.state),
    actions,
    confirming,
    changes,
    setChanges,
    onAction,
    onConfirm: (reason: string) => void onConfirm(reason),
    keep: () => setAsked(null),
    savePlan,
  };
}

interface RunLeadProps {
  readonly mission: MissionDetail;
  readonly run: MissionRun;
  readonly confirming: ConfirmedAction | null;
  readonly onConfirm: (reason: string) => void;
  readonly onKeep: () => void;
}

/** Under the header: the open confirmation, the last refusal, and the awaiting_human note. */
function RunLead({ mission, run, confirming, onConfirm, onKeep }: RunLeadProps) {
  return (
    <>
      {confirming && (
        <ConfirmPanel key={confirming} action={confirming} busy={run.busy !== null} onConfirm={onConfirm} onKeep={onKeep} />
      )}
      {run.error && (
        <p className={styles.alert} role="alert">
          {run.error}
        </p>
      )}
      {mission.state === "awaiting_human" && <p className={styles.note}>{AWAITING_HUMAN_NOTE}</p>}
    </>
  );
}
