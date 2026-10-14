import { count, isRecord, listOf, text } from "@/lib/client/types";

// An agent as Play reads it from GET /api/agents/ (agents-playbooks.md). Only what the
// Mission run page needs so far; the Agents page adds the rest.

export type AgentSummary = {
  readonly id: number;
  readonly name: string;
  readonly slug: string | null;
  readonly status: string | null;
  readonly isSystemAgent: boolean;
};

export type AgentQuery = {
  /** Without it, Auto is left out. The client sends true unless told otherwise. */
  readonly includeWorkspaceSystem?: boolean;
  readonly limit?: number;
  readonly skip?: number;
  readonly status?: string;
  readonly search?: string;
};

/** Agent ids are integers; a row without one is dropped. */
export function parseAgentSummary(value: unknown): AgentSummary | null {
  if (!isRecord(value)) return null;
  const id = count(value.id, Number.NaN);
  if (!Number.isInteger(id)) return null;
  return {
    id,
    name: text(value.name) ?? "",
    slug: text(value.slug),
    status: text(value.status),
    isSystemAgent: value.is_system_agent === true,
  };
}

/** The backend answers a bare list. */
export function parseAgentList(value: unknown): readonly AgentSummary[] {
  return listOf(value, parseAgentSummary);
}
