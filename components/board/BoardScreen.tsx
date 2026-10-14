"use client";

// The Command Center board (PRD-003 B-003), Studio's columns in Play's look: Inbox ·
// Assigned · In progress · Review · Blocked · Done with counts, and Failed, Cancelled and
// Closed together in a collapsed Other column. Cards drag between columns (the move rules
// disable refused targets, with the reason) or move with "Move to…"; Review cards have
// Approve and Reject. Live through the board stream, no polling. On phones one column
// shows at a time, picked with the switcher. No Auto here (PRD-003 design rule 4).

import { useCallback, useState } from "react";

import { type GridStatus, GridPage } from "@/components/page/GridPage";
import { FilterChips } from "@/components/page/parts";
import { useBoard, type BoardView } from "@/hooks/useBoard";
import { type CardActions, useBoardActions } from "@/hooks/useBoardActions";
import { useComposerToggle } from "@/hooks/useComposerToggle";
import { useLoad } from "@/hooks/useLoad";
import { agentCategory } from "@/lib/agents/icons";
import type { AgentSummary } from "@/lib/agents/types";
import { type BoardGroups, groupTasks, taskCount } from "@/lib/board/board";
import { BOARD_COLUMNS, STATUS_LABELS, type BoardTask } from "@/lib/board/types";
import { api, type ApiClient } from "@/lib/client/api";

import pageStyles from "../page/page.module.css";
import { BoardColumn, type ColumnKey, OTHER } from "./BoardColumn";
import styles from "./board.module.css";
import { BoardNotice } from "./BoardNotice";
import { NEW_TASK, NewTaskForm } from "./NewTaskForm";

export const TITLE = "Board";
export const OTHER_LABEL = "Other";
export const SWITCHER_LABEL = "Show column";
export const BOARD_LABEL = "Task columns";
export const LOADING_BOARD = "Loading the board…";
export const AGENTS_FAILED = "Play couldn't load your agents.";

export interface BoardScreenProps {
  /** Tests pass their own (createApiClient with a mock fetch). */
  readonly client?: ApiClient;
  /** What "now" is for the move rules (a run's lease); tests pin it. */
  readonly now?: Date;
}

const COLUMN_KEYS: readonly ColumnKey[] = [...BOARD_COLUMNS, OTHER];

function columnLabel(column: ColumnKey): string {
  return column === OTHER ? OTHER_LABEL : STATUS_LABELS[column];
}

function tasksIn(groups: BoardGroups, column: ColumnKey): readonly BoardTask[] {
  return column === OTHER ? groups.other : groups.columns[column];
}

export function BoardScreen({ client = api, now }: BoardScreenProps) {
  const { view, refresh } = useBoard({ client });
  const agents = useAgents(client);
  const actions = useBoardActions(client, refresh, now);
  const composer = useComposerToggle();
  const [shown, setShown] = useState<ColumnKey>("inbox");
  const today = now ?? new Date();
  const tasks = view.status === "ready" ? view.list.tasks : [];
  const groups = groupTasks(tasks);
  const dragging = tasks.find((task) => task.id === actions.draggingId) ?? null;
  const glyphs = new Map(agents.map((agent): [number, string] => [agent.id, agentCategory(agent).glyph]));
  const glyphOf = (task: BoardTask) => (task.agent ? (glyphs.get(task.agent.id) ?? null) : null);

  const created = () => {
    composer.hide();
    void refresh();
  };

  return (
    <GridPage
      title={TITLE}
      count={view.status === "ready" ? taskCount(tasks.length) : undefined}
      actions={
        composer.open ? undefined : (
          <button type="button" ref={composer.button} className={pageStyles.primary} onClick={composer.show}>
            {NEW_TASK}
          </button>
        )
      }
      lead={
        <>
          {composer.open && <NewTaskForm client={client} agents={agents} onCreated={created} onClose={composer.hide} />}
          <BoardNotice notice={actions.notice} stale={view.status === "ready" && view.stale} onDismiss={actions.dismiss} />
        </>
      }
      status={gridStatus(view)}
    >
      <BoardBody
        groups={groups}
        shown={shown}
        onShow={setShown}
        dragging={dragging}
        now={today}
        busyId={actions.busyId}
        glyphOf={glyphOf}
        actions={actions.card}
      />
    </GridPage>
  );
}

interface BoardBodyProps {
  readonly groups: BoardGroups;
  readonly shown: ColumnKey;
  readonly onShow: (column: ColumnKey) => void;
  readonly dragging: BoardTask | null;
  readonly now: Date;
  readonly busyId: number | null;
  readonly glyphOf: (task: BoardTask) => string | null;
  readonly actions: CardActions;
}

/** The phone's column switcher (hidden on wider screens), then every column. */
function BoardBody({ groups, shown, onShow, ...column }: BoardBodyProps) {
  return (
    <>
      <div className={styles.switcher}>
        <FilterChips<ColumnKey>
          label={SWITCHER_LABEL}
          options={COLUMN_KEYS.map((key) => ({ value: key, label: `${columnLabel(key)} ${tasksIn(groups, key).length}` }))}
          selected={shown}
          onSelect={onShow}
        />
      </div>
      <div className={styles.board} role="group" aria-label={BOARD_LABEL}>
        {COLUMN_KEYS.map((key) => (
          <BoardColumn
            key={key}
            column={key}
            label={columnLabel(key)}
            tasks={tasksIn(groups, key)}
            current={key === shown}
            {...column}
          />
        ))}
      </div>
    </>
  );
}

/** The agents for New Task and the cards' glyphs; empty while loading or after a failure. */
function useAgents(client: ApiClient): readonly AgentSummary[] {
  const load = useCallback(() => client.listAgents(), [client]);
  const agents = useLoad(load, AGENTS_FAILED, "board agents");
  return agents.status === "ready" ? agents.value : [];
}

function gridStatus(view: BoardView): GridStatus {
  if (view.status === "loading") return { kind: "loading", text: LOADING_BOARD };
  if (view.status === "failed") return { kind: "failed", error: view.error, retry: view.retry };
  return { kind: "ready" };
}
