/**
 * PRD-268 (SDK 1.3.0): the brief stand-in's five sections and their rows, after core's
 * frontend/components/proactive/brief-sections.tsx and brief-row.tsx (at 1a8956c874dc42cff05b96f431c50b7d722a71aa).
 *
 * Every word is the brief's own (`labels`): a section's label with its exact count, "Show N more" when its count is
 * more than its rows (it folds at 5), and the empty sentence when no section has a row; a section with no rows draws
 * nothing. A row is Auto's words (its number, title and why, marked data-ai-generated), then its time and its state,
 * its action drawn as text and named by the row ("Start: Lisbon flights"), only when the theme can run it, and a
 * chevron only when it has somewhere to go and the theme can open it. A pressed row shows "✓ {done_label}" in place
 * once the theme's handler resolves; a rejection leaves it as it was.
 */
import type { Brief, BriefRow, BriefSection } from '@automatos/theme-sdk'
import { type ReactElement, useState } from 'react'
import { BRIEF_SECTIONS } from '../../internal/proactive/wire.ts'
import { Eyebrow } from './proactive-parts.tsx'
import { LIST, MUTED, ROW, SMALL_MUTED, TEXT_BUTTON, TITLE } from './proactive-styles.ts'
import { StatusLabel } from './status-label.tsx'

/** brief-row.tsx PRESSED_GLYPH. */
export const PRESSED_GLYPH = '✓'
const OPEN_PREFIX = 'Open: '
const NUMBER_STYLE = Object.freeze({ marginRight: '6px', fontSize: '12px', color: SMALL_MUTED.color })

export interface SectionHandlers {
  readonly onAction?: (row: BriefRow, section: BriefSection) => unknown
  readonly onOpen?: (row: BriefRow, section: BriefSection) => void
  readonly onShowMore?: (section: BriefSection) => void
}

type Keys = ReadonlySet<string>

const keyOf = (section: BriefSection, row: BriefRow): string => `${section}:${row.id}`
const rowsOf = (brief: Brief, section: BriefSection): readonly BriefRow[] => brief.sections[section] ?? []

/** brief-sections.tsx foldedCount: a section's exact count less the rows shown (`unchecked` has no count). */
export function foldedCount(brief: Brief, section: BriefSection): number {
  if (section === 'unchecked') return 0
  return Math.max(brief.counts[section] - rowsOf(brief, section).length, 0)
}

function timeOf(at: string | null | undefined): string | null {
  if (!at) return null
  const when = new Date(at)
  return Number.isNaN(when.getTime()) ? null : when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface RowProps extends SectionHandlers {
  readonly row: BriefRow
  readonly section: BriefSection
  readonly pressed: boolean
  readonly pending: boolean
  readonly onPress: (row: BriefRow, section: BriefSection) => void
}

function RowAction({ row, section, pressed, pending, onAction, onPress }: RowProps): ReactElement | null {
  const action = row.action
  if (!action) return null
  if (pressed) return <span role="status" style={TITLE}><span aria-hidden="true">{PRESSED_GLYPH} </span>{action.done_label || action.label}</span>
  if (!onAction) return null
  return (
    <button
      type="button" aria-label={`${action.label}: ${row.title}`} aria-busy={pending} disabled={pending} style={TEXT_BUTTON}
      onClick={() => onPress(row, section)}
    >
      {action.label} →
    </button>
  )
}

function RowItem(props: RowProps): ReactElement {
  const { row, section, onOpen } = props
  const time = timeOf(row.at)
  return (
    <li data-row-id={row.id} style={ROW}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div data-ai-generated="true">
          <p style={TITLE}>{row.number ? <span style={NUMBER_STYLE}>{row.number}</span> : null}{row.title}</p>
          {row.why ? <p style={MUTED}>{row.why}</p> : null}
        </div>
        {time || row.display_state ? (
          <div style={{ ...SMALL_MUTED, display: 'flex', gap: '8px', alignItems: 'center' }}>
            {time ? <time dateTime={row.at ?? undefined}>{time}</time> : null}
            <StatusLabel state={row.display_state} />
          </div>
        ) : null}
      </div>
      <RowAction {...props} />
      {row.opens && onOpen ? (
        <button type="button" data-row-chevron="" aria-label={`${OPEN_PREFIX}${row.title}`} style={TEXT_BUTTON} onClick={() => onOpen(row, section)}>
          <span aria-hidden="true">›</span>
        </button>
      ) : null}
    </li>
  )
}

interface SectionProps extends SectionHandlers {
  readonly brief: Brief
  readonly section: BriefSection
  readonly pressed: Keys
  readonly pending: Keys
  readonly onPress: (row: BriefRow, section: BriefSection) => void
}

function Section({ brief, section, pressed, pending, onShowMore, ...handlers }: SectionProps): ReactElement | null {
  const rows = rowsOf(brief, section)
  if (rows.length === 0) return null
  const label = brief.labels.sections[section]
  const count = section === 'unchecked' ? null : brief.counts[section]
  const more = foldedCount(brief, section) > 0 ? brief.labels.more[section] : undefined
  return (
    <section aria-label={label || undefined} data-section={section}>
      {label ? <Eyebrow>{label}{count === null ? null : <span data-section-count=""><span aria-hidden="true"> · </span>{count}</span>}</Eyebrow> : null}
      <ul style={LIST}>
        {rows.map((row) => {
          const key = keyOf(section, row)
          return <RowItem key={key} row={row} section={section} pressed={pressed.has(key)} pending={pending.has(key)} {...handlers} />
        })}
      </ul>
      {more && onShowMore ? <button type="button" style={TEXT_BUTTON} onClick={() => onShowMore(section)}>{more}</button> : null}
      {more && !onShowMore ? <p style={MUTED}>{more}</p> : null}
    </section>
  )
}

/** brief-sections.tsx's presses: pending while the theme's handler runs, pressed once it resolves. */
function usePresses(onAction: SectionHandlers['onAction']) {
  const [pressed, setPressed] = useState<Keys>(() => new Set())
  const [pending, setPending] = useState<Keys>(() => new Set())
  const onPress = (row: BriefRow, section: BriefSection): void => {
    if (!onAction) return
    const key = keyOf(section, row)
    const without = (keys: Keys): Keys => new Set(Array.from(keys).filter((kept) => kept !== key))
    setPending((keys) => new Set([...Array.from(keys), key]))
    Promise.resolve()
      .then(() => onAction(row, section))
      .then(() => {
        setPressed((keys) => new Set([...Array.from(keys), key]))
        setPending(without)
      }, () => setPending(without))
  }
  return { pressed, pending, onPress }
}

/** brief-sections.tsx BriefSections: the sections with their rows, or the brief's empty sentence. */
export function BriefSections({ brief, ...handlers }: SectionHandlers & { readonly brief: Brief }): ReactElement | null {
  const presses = usePresses(handlers.onAction)
  if (BRIEF_SECTIONS.every((section) => rowsOf(brief, section).length === 0)) {
    const empty = brief.labels.empty
    return empty ? <p data-ai-generated="true" data-brief-empty="" style={MUTED}>{empty}</p> : null
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {BRIEF_SECTIONS.map((section) => <Section key={section} brief={brief} section={section} {...handlers} {...presses} />)}
    </div>
  )
}
