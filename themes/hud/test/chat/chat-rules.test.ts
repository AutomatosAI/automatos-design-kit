// The core screen's pure rules: the layout the screen picks for its size (the design's desktop until measured), the
// state chip's words, a tool call's glyph, an agent's status and a Deliverable's day, NEEDS YOU's rows and where
// each opens, NEXT UP's order and times, and a turn that failed before its reply began. Each is a plain function,
// read without rendering.
import { type HostChatMessage, type HostToolCall, missionHref, type NeedsYou, QUESTIONS_HREF, ticketHref } from '@automatos/theme-sdk'
import { describe, expect, it } from 'vitest'
import { captionFor } from '@automatos/mascot/media'
import { AWAITING_ANSWER, autoLabel, chipWords, NAPPING } from '../../src/chat/chip.ts'
import { MARK_DONE, MARK_MUTED, MARK_RUNNING, toolLineLabel } from '../../src/chat/labels.ts'
import {
  DEFAULT_LAYOUT, LARGE_CORE_MIN_HEIGHT, screenLayout, THREE_COLUMNS_MIN, TWO_COLUMNS_MIN,
} from '../../src/chat/layout.ts'
import { agentStatus, madeWhen, TODAY } from '../../src/chat/panels/panel-rows.ts'
import { needsYouRows, runsWhen, upcomingRuns } from '../../src/chat/panels/work-rows.ts'
import { failedBeforeReply } from '../../src/chat/turn-end.tsx'

function call(fields: Partial<HostToolCall>): HostToolCall {
  return { toolCallId: 't1', toolName: 'platform_web_search', state: 'running', skipped: false, waiting: false, ...fields }
}

function message(fields: Partial<HostChatMessage>): HostChatMessage {
  return { id: 'm1', role: 'assistant', text: '', error: null, ...fields } as HostChatMessage
}

describe('the layout', () => {
  it("is the design's desktop until the screen is measured", () => {
    expect(screenLayout(null)).toEqual(DEFAULT_LAYOUT)
    expect(DEFAULT_LAYOUT).toEqual({ columns: 'three', core: 'large' })
  })

  it('puts the panels on both sides when wide, beside the conversation when narrower, nowhere below that', () => {
    const tall = LARGE_CORE_MIN_HEIGHT
    expect(screenLayout({ width: THREE_COLUMNS_MIN, height: tall }).columns).toBe('three')
    expect(screenLayout({ width: THREE_COLUMNS_MIN - 1, height: tall }).columns).toBe('two')
    expect(screenLayout({ width: TWO_COLUMNS_MIN, height: tall }).columns).toBe('two')
    expect(screenLayout({ width: TWO_COLUMNS_MIN - 1, height: tall }).columns).toBe('one')
  })

  it("takes the 420 px core when there is height for it, the phone's 290 px core otherwise", () => {
    expect(screenLayout({ width: THREE_COLUMNS_MIN, height: LARGE_CORE_MIN_HEIGHT }).core).toBe('large')
    expect(screenLayout({ width: THREE_COLUMNS_MIN, height: LARGE_CORE_MIN_HEIGHT - 1 }).core).toBe('small')
  })
})

describe('the state chip', () => {
  it("says the state in the mascot's own words", () => {
    expect(chipWords('thinking')).toBe(captionFor('thinking'))
    expect(chipWords('sleeping', { backendDown: true })).toBe(captionFor('sleeping'))
  })

  it("adds a running search's query, cut to fit", () => {
    expect(chipWords('searching', { runningInput: { query: 'budget laptops' } })).toBe(`${captionFor('searching')} · budget laptops`)
    const long = chipWords('searching', { runningInput: { query: 'x'.repeat(60) } })
    expect(long.endsWith('…')).toBe(true)
  })

  it("tells a nap from the backend being down, names a card waiting and the Deliverable that landed", () => {
    expect(chipWords('sleeping')).toBe(NAPPING)
    expect(chipWords('listening', { approvalWaiting: true })).toBe(AWAITING_ANSWER)
    expect(chipWords('celebrate', { deliverableKind: 'document' })).toBe('Your document is ready')
    expect(autoLabel('Thinking')).toBe('Auto: Thinking')
  })

  it("says the voice session's phase while it listens, thinks or speaks, over whatever the chat says", () => {
    expect(chipWords('idle', { voicePhase: 'listening' })).toBe('Listening')
    expect(chipWords('listening', { approvalWaiting: true, voicePhase: 'thinking' })).toBe('Thinking')
    expect(chipWords('searching', { runningInput: { query: 'budget laptops' }, voicePhase: 'speaking' })).toBe('Speaking')
  })

  it("says the chat's state again while the session connects, rests, has ended or failed", () => {
    const phases = ['connecting', 'idle', 'ended', 'error'] as const
    expect(phases.map((voicePhase) => chipWords('listening', { approvalWaiting: true, voicePhase }))).toEqual(phases.map(() => AWAITING_ANSWER))
    expect(chipWords('thinking', { voicePhase: 'idle' })).toBe(captionFor('thinking'))
  })
})

describe('a tool line', () => {
  it('is ▸ while it runs, ✓ when done, and – when the reply stopped under it', () => {
    expect(toolLineLabel(call({}), true).mark).toBe(MARK_RUNNING)
    expect(toolLineLabel(call({ state: 'completed' }), false).mark).toBe(MARK_DONE)
    expect(toolLineLabel(call({}), false)).toEqual({ mark: MARK_MUTED, text: 'Stopped: searching the web', tone: 'muted' })
  })
})

describe('the panels', () => {
  it("say an agent's status as a glyph and a word: unavailable first, then the backend's own", () => {
    expect(agentStatus({ status: 'active', unavailable: null })).toEqual({ glyph: '●', word: 'Active', tone: 'live' })
    expect(agentStatus({ status: 'active', unavailable: 'No AI credit' })).toEqual({ glyph: '○', word: 'Unavailable', tone: 'quiet' })
    expect(agentStatus({ status: 'error' })).toEqual({ glyph: '✕', word: 'Error', tone: 'failed' })
    expect(agentStatus({ status: 'paused_by_owner' })).toEqual({ glyph: '◆', word: 'Paused by owner', tone: 'quiet' })
  })

  it("name a Deliverable's day: today, a weekday within the week, else the day and month", () => {
    const now = new Date(2026, 9, 24, 12)
    expect(madeWhen(new Date(2026, 9, 24, 8).toISOString(), now)).toBe(TODAY)
    expect(madeWhen(new Date(2026, 9, 19, 12).toISOString(), now)).toBe('Mon')
    expect(madeWhen(new Date(2026, 9, 2, 12).toISOString(), now)).toBe('2 Oct')
    expect(madeWhen('not a date', now)).toBe('')
  })
})

describe('a turn that failed before its reply', () => {
  it('is an error with no reply holding it, and never one the used-up credits explain', () => {
    const asked = message({ role: 'user', text: 'Hi?' })
    expect(failedBeforeReply('error', [asked], false)).toBe(true)
    expect(failedBeforeReply('error', [asked], true)).toBe(false)
    expect(failedBeforeReply('error', [asked, message({ error: { message: 'It failed.', code: null } })], false)).toBe(false)
    expect(failedBeforeReply('idle', [asked], false)).toBe(false)
  })
})

describe('the work panels', () => {
  const AT = '2026-10-14T09:00:00+00:00'
  const empty: NeedsYou['rows'] = { review: [], question: [], approval: [], stuck: [], failed: [] }

  it("open each Needs-you row where the core's widget does: a ticket or its Mission, a question in its ticket or tab", () => {
    const rows = needsYouRows({
      total: 3,
      counts: { review: 0, question: 1, approval: 0, stuck: 1, failed: 1 },
      rows: {
        ...empty,
        question: [{ source: 'grant', id: '8', title: null, ticket_id: null, agent_name: null, at: AT }],
        stuck: [{ ticket_id: 44, title: 'Post the bake sale', agent_name: null, mission_id: 'm-3', opens: 'mission', at: AT }],
        failed: [{ ticket_id: 45, number: '#0045', title: null, agent_name: 'Scribe', mission_id: 'm-4', at: AT }],
      },
    })
    expect(rows.map((row) => [row.kind, row.title, row.href, row.detail])).toEqual([
      ['question', 'A question', QUESTIONS_HREF, null],
      ['stuck', 'Post the bake sale', missionHref('m-3'), null],
      ['failed', '#0045 · A failed ticket', ticketHref(45), 'Scribe'],
    ])
  })

  it('list the timed runs soonest first, and name when each runs', () => {
    const run = (id: string, at: string | null) => ({ id, name: id, type: 'task' as const, next_run_at: at, frequency: 'once', agent_name: null, agent_id: null })
    const runs = upcomingRuns([run('b', '2026-10-15T09:00:00Z'), run('none', null), run('bad', 'soon'), run('a', '2026-10-14T18:00:00Z')])
    expect(runs.map(({ item }) => item.id)).toEqual(['a', 'b'])
    const now = new Date(2026, 9, 14, 9) // Wed 14 Oct 2026
    expect(runsWhen(new Date(2026, 9, 14, 18, 0), now)).toBe('18:00')
    expect(runsWhen(new Date(2026, 9, 16, 9, 5), now)).toBe('Fri 09:05')
    expect(runsWhen(new Date(2026, 9, 20, 9, 0), now)).toBe('Tue 09:00')
    expect(runsWhen(new Date(2026, 9, 22, 9, 0), now)).toBe('22 Oct 09:00')
  })
})
