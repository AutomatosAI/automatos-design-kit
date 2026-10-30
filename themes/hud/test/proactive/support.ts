// What HUD 1.2.0's proactive tests share (PRD-268): a made-up brief (Brief@1), open suggestions, Missions with the
// server's states, what Auto depends on (Readiness@1), the Command Center rows the one-live-border rule reads, and a
// screen of a chosen width for the core screen's layout (jsdom lays nothing out, so the screen reads as 0 wide until a
// test says otherwise; the layout's own hook then measures what it is told). Every value is made up.
import type {
  ActivityFeed, Brief, BriefRow, Mission, MissionList, NeedsYou, Readiness, ReadinessItem, Suggestion,
} from '@automatos/theme-sdk'
import { vi } from 'vitest'

const STAMP = '2026-10-14T09:00:00+00:00'
export const SUGGESTION_ID = '00000000-0000-4000-8000-0000000000a1'
export const OTHER_SUGGESTION_ID = '00000000-0000-4000-8000-0000000000a2'

export function briefRow(fields: Partial<BriefRow> & Pick<BriefRow, 'id' | 'title'>): BriefRow {
  return { why: '', ...fields }
}

/** Two needs-you rows of seven, one suggestion, one run today; nothing since, nothing unchecked. */
export const BRIEF: Brief = {
  v: 1,
  date: '2026-10-14',
  greeting: 'Morning.',
  prose: 'Seven things need you, one suggestion waits, and one run is due today.',
  spoken: 'Morning. 1. Check the laptop reviews. 2. Which budget? 3. Check the laptop prices again. 4. Post the bake sale reminder.',
  sections: {
    needs_you: [
      briefRow({
        id: 'needs-101', title: 'Check the laptop reviews', why: 'Scout is waiting for your review.', display_state: 'needs_you',
        opens: { type: 'ticket', id: '101' }, action: { verb: 'open', label: 'Open' },
      }),
      briefRow({
        id: 'needs-301', title: 'Which budget?', why: 'Scout asked you a question.', display_state: 'needs_you',
        opens: { type: 'question', id: '301' }, action: { verb: 'answer', label: 'Answer' },
      }),
    ],
    suggestions: [
      briefRow({
        id: SUGGESTION_ID, title: 'Check the laptop prices again', why: 'Two prices changed this week.',
        opens: { type: 'suggestion', id: SUGGESTION_ID }, action: { verb: 'start', label: 'Start', done_label: 'Started' },
      }),
    ],
    today: [briefRow({ id: 'today-1', title: 'Post the bake sale reminder', why: 'A routine runs.', at: '2026-10-14T11:00:00+00:00' })],
    since: [],
    unchecked: [],
  },
  counts: { needs_you: 7, suggestions: 1, today: 1, since: 0 },
  labels: {
    sections: { needs_you: 'Needs you', suggestions: 'Suggested', today: 'Today' },
    more: { needs_you: 'Show 5 more' },
    empty: 'Nothing new needs you, and nothing is scheduled today.',
  },
  state_hash: 'brief-hash-1',
  generated_at: '2026-10-14T09:05:00+00:00',
}

/** The same day with nothing in it. */
export const EMPTY_BRIEF: Brief = {
  ...BRIEF,
  sections: { needs_you: [], suggestions: [], today: [], since: [], unchecked: [] },
  counts: { needs_you: 0, suggestions: 0, today: 0, since: 0 },
  state_hash: 'brief-hash-empty',
}

export function suggestion(id: string, title: string, fields: Partial<Suggestion> = {}): Suggestion {
  return {
    id, workspace_id: 'ws-test', user_id: 1, source_type: 'check_in', source_agent_id: null, run_id: null, title,
    detail: 'A made-up reason.', evidence: [], proposed_action: { kind: 'board_task', payload: null }, subject_key: `test:${id}`,
    severity: 'today', status: 'open', occurrences: 1, last_seen_at: null, started_ref: null, decided_via: null, hide_reason: null,
    decided_at: null, est_credits: null, created_at: STAMP, delivered_at: STAMP, expires_at: null, ...fields,
  }
}

export const SUGGESTIONS: readonly Suggestion[] = [
  suggestion(SUGGESTION_ID, 'Check the laptop prices again'),
  suggestion(OTHER_SUGGESTION_ID, 'Draft the newsletter outline'),
]

export function mission(fields: Partial<Mission> & Pick<Mission, 'id' | 'goal'>): Mission {
  return {
    workspace_id: 'ws-test', state: 'running', state_type: 'active', plan: null, config: null, check_each_step: false,
    output_summary: null, token_budget_estimate: null, tokens_used: 0, max_retries: 1, max_concurrent: 1, complexity_tier: null,
    parallel_groups: [], has_synthesis_tasks: false, created_by: 'owner', started_at: STAMP, completed_at: null, created_at: STAMP,
    updated_at: STAMP, ...fields,
  }
}

export function missionList(missions: readonly Mission[]): MissionList {
  return { missions, total: missions.length, limit: 20, offset: 0 }
}

function item(fields: Partial<ReadinessItem> & Pick<ReadinessItem, 'id' | 'label' | 'state'>): ReadinessItem {
  return { detail: '', fix: null, needed_by: ['brief'], ...fields }
}

export const READINESS: Readiness = {
  v: 1,
  checked_at: STAMP,
  items: [
    item({ id: 'core', label: 'Automatos', state: 'ready', detail: 'Answering.' }),
    item({ id: 'web_search', label: 'Web search', state: 'not_checked', detail: "The check didn't answer in time." }),
    item({
      id: 'calendar', label: 'Calendar', state: 'needs_setup', detail: 'No calendar is connected.',
      fix: { label: 'Connect calendar', href: '/settings?tab=integrations' },
    }),
  ],
}

/** Two things need you: a review and a question. */
export const NEEDS: NeedsYou = {
  total: 2,
  counts: { review: 1, question: 1, approval: 0, stuck: 0, failed: 0 },
  rows: {
    review: [{ ticket_id: 42, number: '#0042', title: 'Check the laptop report', agent_name: 'Scribe', mission_id: null, at: STAMP }],
    question: [{ source: 'grant', id: '7', title: 'Which budget?', ticket_id: 43, agent_name: 'Scout', at: STAMP }],
    approval: [],
    stuck: [],
    failed: [],
  },
}

/** One Mission running now, on its second step. */
export const RUNNING: ActivityFeed = {
  items: [{
    id: 'run-1', type: 'mission', name: 'Laptop shortlist', status: 'running', started_at: STAMP, completed_at: null,
    duration_seconds: null, agent: null, agents: [], summary: '', source_id: 'm-7', source_url: null, trigger: null, error_message: null,
    step_progress: { current: 2, total: 3, steps: [
      { name: 'Search the web', status: 'completed' },
      { name: 'Read four pages', status: 'running' },
      { name: 'Write the report', status: 'pending' },
    ] },
  }],
  total: 1, limit: 1, offset: 0,
}

/** The core screen as `width` px wide (and tall enough for the large core), from the next render on. */
export function screenWidth(width: number): void {
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(width)
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(900)
}

/** Widths for each layout (src/chat/layout.ts THREE_COLUMNS_MIN 1180, TWO_COLUMNS_MIN 940). */
export const THREE_COLUMNS = 1300
export const TWO_COLUMNS = 1000
export const ONE_COLUMN = 900

/** The screen element and the column an element sits in (one of the screen's own children). */
export const screenElement = (): HTMLElement => document.querySelector<HTMLElement>('[data-columns]') as HTMLElement
export const columnOf = (element: Element): HTMLElement | null => element.closest<HTMLElement>('[data-columns] > *')
