// Play 1.3.0 (PRD-268) — made-up proactive data for Play's tests of the brief, the pinned suggestion and calibration,
// in the SDK's shapes (areas/proactive.d.ts): one day's Brief@1, open suggestions and a Calibration@1. Fake data only.
import type { Brief, BriefRow, Calibration, Suggestion } from '@automatos/theme-sdk'

/** Suggestion ids are UUIDs, as the server's are. */
export const LISTED_ID = '00000000-0000-4000-8000-0000000000b1'
export const NEWER_ID = '00000000-0000-4000-8000-0000000000b2'

export const TICKET_ROW: BriefRow = {
  id: 'needs-41',
  title: 'Check the bake sale post',
  why: 'It is waiting for your review.',
  number: '#0041',
  display_state: 'needs_you',
  opens: { type: 'ticket', id: '41' },
  action: { verb: 'open', label: 'Open' },
}

export const SUGGESTION_ROW: BriefRow = {
  id: LISTED_ID,
  title: 'Draft the newsletter outline',
  why: 'The newsletter plan is waiting, and an outline makes it quicker to judge.',
  opens: { type: 'suggestion', id: LISTED_ID },
  action: { verb: 'start', label: 'Start', done_label: 'Started' },
}

export const BRIEF: Brief = {
  v: 1,
  date: '2026-10-14',
  greeting: 'Morning.',
  prose: 'One thing needs you this morning, and one suggestion is waiting for you.',
  spoken: 'Morning. 1. Check the bake sale post. 2. Draft the newsletter outline.',
  sections: {
    needs_you: [TICKET_ROW],
    suggestions: [SUGGESTION_ROW],
    today: [],
    since: [],
    unchecked: [],
  },
  counts: { needs_you: 1, suggestions: 1, today: 0, since: 0 },
  labels: {
    sections: { needs_you: 'Needs you', suggestions: 'Suggested', today: 'Today', since: 'Since your last brief' },
    more: {},
    empty: 'Nothing new needs you, and nothing is scheduled today.',
  },
  state_hash: 'play-test-brief',
  generated_at: '2026-10-14T08:00:00+00:00',
}

/** One open suggestion, as useSuggestions lists it. */
export function suggestion(id: string, title: string): Suggestion {
  return {
    id,
    workspace_id: 'workspace-1',
    user_id: 1,
    source_type: 'check_in',
    source_agent_id: null,
    run_id: null,
    title,
    detail: 'A fresh look keeps the plan honest.',
    evidence: [],
    proposed_action: { kind: 'chat', payload: null },
    subject_key: `play-test:${id}`,
    severity: 'today',
    status: 'open',
    occurrences: 1,
    last_seen_at: '2026-10-14T08:00:00+00:00',
    started_ref: null,
    decided_via: null,
    hide_reason: null,
    decided_at: null,
    est_credits: null,
    created_at: '2026-10-14T08:00:00+00:00',
    delivered_at: '2026-10-14T08:00:00+00:00',
    expires_at: '2026-10-17T09:00:00+00:00',
  }
}

/** The brief's own suggestion, and a newer one the brief doesn't list, newest first. */
export const NEWER = suggestion(NEWER_ID, 'Check the laptop prices again before Friday')
export const LISTED = suggestion(LISTED_ID, SUGGESTION_ROW.title)
export const SUGGESTIONS: readonly Suggestion[] = [NEWER, LISTED]

export const CALIBRATION: Calibration = {
  v: 1,
  id: 'play-test-calibration',
  empty: false,
  lines: [
    {
      id: 'line-1',
      text: 'You run the school bake sale.',
      sources: [{ type: 'conversation', id: 'chat-bake', label: 'Bake sale' }],
    },
  ],
  offers: ['Draft the bake sale poster', 'Sum up this week', 'Check the shortlist prices'],
}
