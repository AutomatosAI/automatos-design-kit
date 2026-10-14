// The only place poll intervals are defined (PRD-003 P-002). The skill's "Poll gently":
// Mission detail and the fleet every 10 s, lists every 30 s, a processing document every
// 5-10 s, an open Playbook run every 10 s, the live board's safety refetch every 60 s,
// analytics never. Every Missions route does blocking database work on the backend's
// event loop, so never poll faster than Studio.
// tests/poll/intervals.test.ts fails if a value drops below the skill's minimum.

export const POLL_INTERVALS = {
  /** GET /api/missions/{id}, the open Mission only (missions.md). */
  MISSION_DETAIL: 10_000,
  /** The agents' fleet status, one workspace-wide call (agents-playbooks.md). */
  FLEET: 10_000,
  /** Any list: Missions, Deliverables, Knowledge (missions.md). */
  LIST: 30_000,
  /** GET /api/documents/{id} while it is processing, never POST /reprocess (knowledge.md). */
  DOCUMENT_PROCESSING: 7_000,
  /** An open Playbook run, until it ends (agents-playbooks.md). */
  PLAYBOOK_RUN: 10_000,
  /** The board's list refetch while its live stream is open, a safety net (board-analytics.md). */
  BOARD_SAFETY: 60_000,
} as const;

export type PollIntervalName = keyof typeof POLL_INTERVALS;
