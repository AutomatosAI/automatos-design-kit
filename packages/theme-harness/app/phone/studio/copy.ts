/**
 * The words on the phone view's screens. The app's own (its src/chat/strings.ts, src/cc/strings.ts and
 * src/styles/strings.ts, at the Automatos Go commit packages/theme-cli's README names) where it has them; the
 * exchange with Auto, the tickets, the agents and the figures are made-up data.
 */
import type { MarkTone, PipStatus } from '../../../src/phone/parts.ts'

export const APP_COPY = Object.freeze({
  wordmark: 'automatos',
  menu: 'Menu',
  aiLabel: 'Auto is an AI',
  autoSaid: 'Auto said, Auto is an AI',
  needsHeading: (total: number): string => `Needs you · ${total}`,
  commandCentreLink: 'Command Centre →',
  receiptsTitle: 'What Auto did',
  placeholder: 'Message Auto',
  attach: 'Attach a file',
  send: 'Send',
  back: 'Auto',
  backLabel: 'Back to Auto',
  live: 'Streaming live',
  commandCentre: 'Command Centre',
  tabs: Object.freeze([
    { word: 'Board', count: 12 }, { word: 'Calendar', count: 5 }, { word: 'Questions', count: 2 }, { word: 'Deliverables', count: 4 },
  ]),
  firstOpenTitle: 'Talk to Auto',
  firstOpenLede: "I'm Auto. Tell me what you need and I'll get it done.",
  autoHello: 'Auto, saying hello',
})

export interface NeedCard {
  readonly status: PipStatus
  readonly word: string
  readonly title: string
  readonly meta: string
}

export const NEEDS: readonly NeedCard[] = [
  { status: 'review', word: 'Review', title: 'Weekly sign-ups report is ready for you', meta: '#118 · Quill' },
  { status: 'blocked', word: 'Blocked', title: 'Which list should the newsletter go to?', meta: '#121 · Scout' },
]

export interface ToolLine {
  readonly tone: MarkTone
  readonly mark: string
  readonly text: string
}

const TOOL_LINES: readonly ToolLine[] = [
  { tone: 'done', mark: '✓', text: 'Read the sign-ups sheet · 2 tabs · 1.2 s' },
  { tone: 'done', mark: '✓', text: 'Wrote the report · 1 file' },
]
const RECEIPTS: readonly ToolLine[] = [
  { tone: 'done', mark: '✓', text: 'Read sign-ups.csv' },
  { tone: 'done', mark: '✓', text: 'Saved weekly-sign-ups.md' },
]

export const EXCHANGE = Object.freeze({
  asked: 'Can you pull last week’s sign-ups into a short report?',
  answer: 'Done. Sign-ups rose to 214 last week, up from 187, and most came from the spring guide. The report is below.',
  tools: TOOL_LINES,
  receipts: RECEIPTS,
  receiptsNote: 'Nothing was sent outside the workspace.',
  deliverable: Object.freeze({
    type: 'Report', title: 'Weekly sign-ups', excerpt: '214 sign-ups, up 14 % on the week before. The spring guide brought 61 of them.',
    meta: 'Auto · 09:41',
  }),
})

export interface Ticket {
  readonly number: string
  readonly kind: string
  readonly priority: string | null
  readonly status: PipStatus
  readonly word: string
  readonly title: string
  readonly reason: string | null
  readonly tags: readonly string[]
  readonly agent: string
  /** Which of the chart colours the agent's swatch is (the app folds the name onto chart1-chart5). */
  readonly swatch: 'chart1' | 'chart2' | 'chart3' | 'chart4' | 'chart5'
}

const TICKETS: readonly Ticket[] = [
  {
    number: '#121', kind: 'Task', priority: 'High', status: 'blocked', word: 'Blocked', title: 'Send the spring newsletter',
    reason: 'Waiting on your answer', tags: ['newsletter'], agent: 'Scout', swatch: 'chart1',
  },
  {
    number: '#118', kind: 'Task', priority: null, status: 'review', word: 'Review', title: 'Weekly sign-ups report',
    reason: 'Deliverable to review', tags: ['reports', 'weekly'], agent: 'Quill', swatch: 'chart2',
  },
  {
    number: '#117', kind: 'Mission', priority: null, status: 'in_progress', word: 'In progress', title: 'Tidy the onboarding checklist',
    reason: null, tags: ['onboarding'], agent: 'Ledger', swatch: 'chart3',
  },
  {
    number: '#109', kind: 'Task', priority: null, status: 'failed', word: 'Failed', title: 'Import the old contact list',
    reason: null, tags: ['contacts'], agent: 'Scout', swatch: 'chart1',
  },
]

/** One run of the Command Centre's lede: a figure in mono, the needs clause in the accent. */
export interface LedePart {
  readonly text: string
  readonly figure?: boolean
  readonly needs?: boolean
}

export interface FilterPill {
  readonly word: string
  readonly count: number
  readonly status: PipStatus | null
}

const LEDE: readonly LedePart[] = [
  { text: '4', figure: true }, { text: ' agents on ' }, { text: '12', figure: true }, { text: ' tickets · ' },
  { text: '3 need you', needs: true },
]
const PILLS: readonly FilterPill[] = [
  { word: 'All', count: 12, status: null }, { word: 'Blocked', count: 1, status: 'blocked' },
  { word: 'Review', count: 2, status: 'review' }, { word: 'Done', count: 6, status: 'done' },
]

export const COMMAND_CENTRE = Object.freeze({
  eyebrow: 'Monday · 09:41',
  lede: LEDE,
  pills: PILLS,
  tickets: TICKETS,
})
