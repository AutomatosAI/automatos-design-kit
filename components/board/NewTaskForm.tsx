"use client";

// The in-page "New Task" form (B-003): title (required), description, agent (from the
// agents list; none leaves it in the Inbox) and priority -> POST /api/tasks. The board
// refreshes once it is created (and the live stream says so too).

import { type FormEvent, useEffect, useId, useRef, useState } from "react";

import type { AgentSummary } from "@/lib/agents/types";
import { EMPTY_NEW_TASK, type NewTask, newTaskOf, PRIORITIES, priorityLabel } from "@/lib/board/board";
import { ApiError, type ApiClient } from "@/lib/client/api";

import pageStyles from "../page/page.module.css";
import styles from "./board.module.css";

export const NEW_TASK = "New Task";
export const TITLE_LABEL = "Title";
export const DESCRIPTION_LABEL = "Description (optional)";
export const AGENT_LABEL = "Agent";
export const PRIORITY_LABEL = "Priority";
export const NO_AGENT_OPTION = "No agent yet (it waits in the Inbox)";
export const CREATE = "Create Task";
export const CREATING = "Creating…";
export const CLOSE = "Close";
export const CREATE_FAILED = "Play couldn't create the Task.";

export interface NewTaskFormProps {
  readonly client: ApiClient;
  /** The agents to pick from; empty while they load or when they failed. */
  readonly agents: readonly AgentSummary[];
  readonly onCreated: () => void;
  readonly onClose: () => void;
}

export function NewTaskForm({ client, agents, onCreated, onClose }: NewTaskFormProps) {
  const [draft, setDraft] = useState<NewTask>(EMPTY_NEW_TASK);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleField = useRef<HTMLInputElement>(null);
  const ids = { title: useId(), description: useId(), agent: useId(), priority: useId() };
  const task = newTaskOf(draft);

  useEffect(() => {
    titleField.current?.focus();
  }, []);

  const set = (change: Partial<NewTask>) => setDraft((current) => ({ ...current, ...change }));

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!task || creating) return;
    setCreating(true);
    setError(null);
    try {
      await client.createTask(task);
      onCreated();
    } catch (failure) {
      console.error(`[board] ${CREATE_FAILED}`, failure);
      setError(failure instanceof ApiError ? `${CREATE_FAILED} ${failure.message}` : CREATE_FAILED);
      setCreating(false);
    }
  };

  return (
    <form className={styles.newTask} aria-label={NEW_TASK} onSubmit={create}>
      <label htmlFor={ids.title} className={styles.fieldLabel}>
        {TITLE_LABEL}
      </label>
      <input
        ref={titleField}
        id={ids.title}
        className={styles.field}
        required
        value={draft.title}
        onChange={(event) => set({ title: event.target.value })}
      />
      <label htmlFor={ids.description} className={styles.fieldLabel}>
        {DESCRIPTION_LABEL}
      </label>
      <textarea
        id={ids.description}
        className={styles.textArea}
        rows={3}
        value={draft.description}
        onChange={(event) => set({ description: event.target.value })}
      />
      <div className={styles.fieldRow}>
        <AgentField id={ids.agent} agents={agents} value={draft.agentId} onChange={(agentId) => set({ agentId })} />
        <div className={styles.fieldGroup}>
          <label htmlFor={ids.priority} className={styles.fieldLabel}>
            {PRIORITY_LABEL}
          </label>
          <select
            id={ids.priority}
            className={styles.field}
            value={draft.priority}
            onChange={(event) => {
              const priority = PRIORITIES.find((value) => value === event.target.value);
              if (priority) set({ priority });
            }}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priorityLabel(priority)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && (
        <p className={pageStyles.error} role="alert">
          <span aria-hidden="true">✕</span> {error}
        </p>
      )}
      <div className={styles.formActions}>
        <button type="submit" className={styles.create} disabled={!task || creating}>
          {creating ? CREATING : CREATE}
        </button>
        <button type="button" className={pageStyles.secondary} onClick={onClose}>
          {CLOSE}
        </button>
      </div>
    </form>
  );
}

interface AgentFieldProps {
  readonly id: string;
  readonly agents: readonly AgentSummary[];
  readonly value: string;
  readonly onChange: (agentId: string) => void;
}

function AgentField({ id, agents, value, onChange }: AgentFieldProps) {
  return (
    <div className={styles.fieldGroup}>
      <label htmlFor={id} className={styles.fieldLabel}>
        {AGENT_LABEL}
      </label>
      <select id={id} className={styles.field} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{NO_AGENT_OPTION}</option>
        {agents.map((agent) => (
          <option key={agent.id} value={String(agent.id)}>
            {agent.name}
          </option>
        ))}
      </select>
    </div>
  );
}
