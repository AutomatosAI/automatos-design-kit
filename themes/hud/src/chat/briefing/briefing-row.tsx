import { useState } from 'react'
import { type BriefRow, HostLink, useStartSuggestion } from '@automatos/theme-sdk'

import { stateMark } from '../panels/status-marks'
import { briefRowHref, type NumberedRow, rowNumber, rowTime, startsSuggestion } from './brief-rows'
import styles from './briefing.module.css'

/**
 * HUD 1.2.0 (PRD-268): one row of BRIEFING. Its number across the brief (the one Listen reads), the title and the why
 * as Auto's words (data-ai-generated), its time and its state as a glyph and a word when it has them, and its action
 * as text, named by the row ("Open: Check the laptop reviews"): a link where the row opens, or, on a suggestion's row,
 * Start, which starts it through the SDK (useStartSuggestion) and then says "✓ Started" in its place. A row with no
 * action that opens somewhere links its title; one with nowhere to go is text.
 */

export const START_FALLBACK = 'Start'
export const STARTED_FALLBACK = 'Started'
/** Start refused with no sentence of the server's own. */
export const START_REFUSED = "Couldn't start it. Try again in a moment."
const ARROW = '→'
const DONE_MARK = '✓'

interface StartProps {
  readonly id: string
  readonly title: string
  readonly label: string
  readonly doneLabel: string
}

function refusalOf(failure: unknown): string {
  return failure instanceof Error && failure.message ? failure.message : START_REFUSED
}

function StartAction({ id, title, label, doneLabel }: StartProps) {
  const start = useStartSuggestion()
  const [done, setDone] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)
  if (done) return <span className={styles.done} role="status">{`${DONE_MARK} ${doneLabel}`}</span>
  const press = (): void => {
    setRefused(null)
    start.runAsync({ id }).then(() => setDone(true), (failure: unknown) => setRefused(refusalOf(failure)))
  }
  return (
    <>
      <button
        type="button"
        className={styles.action}
        aria-label={`${label}: ${title}`}
        aria-busy={start.isRunning}
        disabled={start.isRunning}
        onClick={press}
      >
        {`${label} ${ARROW}`}
      </button>
      {refused !== null && <span className={styles.refused} role="alert">{refused}</span>}
    </>
  )
}

function RowAction({ row, href }: { readonly row: BriefRow; readonly href: string | null }) {
  const action = row.action
  if (!action) return null
  const suggestion = startsSuggestion(row)
  if (suggestion !== null) {
    const label = action.label || START_FALLBACK
    return <StartAction id={suggestion} title={row.title} label={label} doneLabel={action.done_label || STARTED_FALLBACK} />
  }
  if (href === null) return null
  return (
    <HostLink href={href} className={styles.action} aria-label={`${action.label}: ${row.title}`}>
      {`${action.label} ${ARROW}`}
    </HostLink>
  )
}

function RowMarks({ row }: { readonly row: BriefRow }) {
  const mark = stateMark(row.display_state)
  const time = rowTime(row.at)
  if (mark === null && time === null) return null
  return (
    <span className={styles.marks}>
      {time !== null && <time dateTime={row.at ?? undefined}>{time}</time>}
      {mark !== null && (
        <span className={styles.status} data-tone={mark.tone}>
          <span aria-hidden="true">{mark.glyph}</span> {mark.word}
        </span>
      )}
    </span>
  )
}

export function BriefingRow({ shown }: { readonly shown: NumberedRow }) {
  const { number, row } = shown
  const href = briefRowHref(row)
  const known = stateMark(row.display_state) !== null
  return (
    <li className={styles.row} value={number} data-row-id={row.id} data-display-state={known ? row.display_state ?? undefined : undefined}>
      <span className={styles.number} aria-hidden="true">
        {rowNumber(number)}
      </span>
      <div className={styles.body}>
        <span className={styles.title} data-ai-generated="true">
          {href !== null && !row.action ? (
            <HostLink href={href} className={styles.titleLink}>
              {row.title}
            </HostLink>
          ) : (
            row.title
          )}
        </span>
        {row.why && (
          <span className={styles.why} data-ai-generated="true">
            {row.why}
          </span>
        )}
        <RowMarks row={row} />
      </div>
      <RowAction row={row} href={href} />
    </li>
  )
}
