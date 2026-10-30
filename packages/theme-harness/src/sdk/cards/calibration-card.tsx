/**
 * PRD-268 (SDK 1.3.0): the stand-in for SDK card `CalibrationCard`. It mirrors core's
 * frontend/lib/theme-sdk/host-cards/proactive-cards.tsx CalibrationCard over components/proactive/calibration-card.tsx
 * and calibration-parts.tsx (at 1a8956c874dc42cff05b96f431c50b7d722a71aa): the props checked (a TypeError naming the
 * prop), then "What Auto knows so far": up to three lines, each with where it came from as a count, never a
 * percentage, and Reject; up to three offers; Sounds right and Something's off, disabled without the theme's handler.
 * A rejected line is struck through with "I'll forget that", an accepted card says "✓ Sounds right", a refused answer
 * is one line and the card stays; with nothing to read it says so and shows the offers as starters. The lines and the
 * offers are Auto's words; a new calibration (another id) starts with no answers.
 */
import type { CalibrationAnswer, CalibrationLine, CalibrationSource } from '@automatos/theme-sdk'
import { type ReactElement, useMemo, useState } from 'react'
import { frozenCopy } from '../../internal/page-views.ts'
import { checkedCalibration, handlerOf } from '../../internal/proactive/props.ts'
import { refusedLine } from '../../internal/proactive/wire.ts'
import { AiCaption, Eyebrow, RefusedLine } from './proactive-parts.tsx'
import { CARD, LINE, LIST, MUTED, PRIMARY_BUTTON, QUIET_BUTTON, ROW, SMALL_MUTED, TEXT_BUTTON, TITLE } from './proactive-styles.ts'

type Sdk = typeof import('@automatos/theme-sdk')
type Answer = (answer: CalibrationAnswer) => Promise<void> | void

export const CALIBRATION_TITLE = 'What Auto knows so far'
export const SOUNDS_RIGHT = 'Sounds right'
export const SOMETHING_OFF = "Something's off"
export const CALIBRATION_EMPTY = 'Nothing to go on yet. Here are three ways to start.'
export const REJECT = 'Reject'
export const FORGET_THAT = "I'll forget that"
export const OFFERS_LABEL = 'What Auto can do'
const CALIBRATION_MAX = 3
const SOURCE_NOUNS: Readonly<Record<CalibrationSource['type'], readonly [string, string]>> = Object.freeze({
  deliverable: ['Deliverable', 'Deliverables'], conversation: ['Conversation', 'Conversations'], document: ['document', 'documents'],
  skill: ['skill', 'skills'],
})

/** calibration-parts.tsx sourceCountOf: "from 6 Deliverables and 2 Conversations"; null for none. */
export function sourceCountOf(sources: readonly CalibrationSource[]): string | null {
  const counts = sources.reduce<ReadonlyMap<string, number>>(
    (seen, source) => new Map(seen).set(source.type, (seen.get(source.type) ?? 0) + 1),
    new Map(),
  )
  const parts = [...counts].map(([type, count]) => {
    const nouns = SOURCE_NOUNS[type as CalibrationSource['type']]
    return `${count} ${count === 1 ? nouns[0] : nouns[1]}`
  })
  if (parts.length === 0) return null
  const last = parts[parts.length - 1]
  return `from ${parts.length === 1 ? last : `${parts.slice(0, -1).join(', ')} and ${last}`}`
}

/** calibration-card.tsx useCalibrationAnswers: the lines rejected, whether it was accepted, and a refusal's line. */
function useAnswers(calibrationId: string, onAnswer: Answer | undefined) {
  const [rejected, setRejected] = useState<ReadonlySet<string>>(() => new Set())
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)
  const send = (answer: CalibrationAnswer, answered: () => void): void => {
    if (!onAnswer || busy) return
    setBusy(true)
    setRefused(null)
    Promise.resolve()
      .then(() => onAnswer(frozenCopy(answer)))
      .then(answered, (error: unknown) => setRefused(refusedLine(error)))
      .finally(() => setBusy(false))
  }
  const reject = (line: CalibrationLine): void =>
    send({ calibration_id: calibrationId, answer: 'reject', line_id: line.id }, () => setRejected((before) => new Set([...before, line.id])))
  const accept = (): void => send({ calibration_id: calibrationId, answer: 'accept' }, () => setAccepted(true))
  return { rejected, accepted, busy, refused, reject, accept }
}

interface LineProps {
  readonly line: CalibrationLine
  readonly rejected: boolean
  readonly busy: boolean
  readonly onReject?: (line: CalibrationLine) => void
}

function LineItem({ line, rejected, busy, onReject }: LineProps): ReactElement {
  const count = sourceCountOf(line.sources)
  return (
    <li data-line-id={line.id} data-state={rejected ? 'rejected' : 'open'} style={{ ...ROW, justifyContent: 'space-between' }}>
      <div>
        <p data-ai-generated="true" style={rejected ? { ...MUTED, textDecoration: 'line-through' } : TITLE}>{line.text}</p>
        {count ? <p style={SMALL_MUTED}>{count}</p> : null}
      </div>
      {rejected ? <span role="status" style={SMALL_MUTED}>{FORGET_THAT}</span> : onReject ? (
        <button type="button" aria-label={`${REJECT}: ${line.text}`} disabled={busy} style={TEXT_BUTTON} onClick={() => onReject(line)}>{REJECT}</button>
      ) : null}
    </li>
  )
}

function Offers({ offers }: { readonly offers: readonly string[] }): ReactElement | null {
  if (offers.length === 0) return null
  return (
    <div>
      <p style={SMALL_MUTED}>{OFFERS_LABEL}</p>
      <ul aria-label={OFFERS_LABEL}>{offers.map((offer, index) => <li key={`${index}:${offer}`} data-ai-generated="true">{offer}</li>)}</ul>
    </div>
  )
}

interface ButtonsProps {
  readonly accepted: boolean
  readonly busy: boolean
  readonly onAccept?: () => void
  readonly onSomethingOff?: () => void
}

function Buttons({ accepted, busy, onAccept, onSomethingOff }: ButtonsProps): ReactElement {
  if (accepted) return <span role="status" style={TITLE}><span aria-hidden="true">✓ </span>{SOUNDS_RIGHT}</span>
  return (
    <div style={LINE}>
      <button type="button" aria-busy={busy} disabled={busy || !onAccept} style={PRIMARY_BUTTON} onClick={onAccept}>{SOUNDS_RIGHT}</button>
      <button type="button" disabled={!onSomethingOff} style={QUIET_BUTTON} onClick={onSomethingOff}>{SOMETHING_OFF}</button>
    </div>
  )
}

interface BodyProps {
  readonly calibration: ReturnType<typeof checkedCalibration>
  readonly onAnswer?: Answer
  readonly onSomethingOff?: () => void
  readonly className?: string
}

function Body({ calibration, onAnswer, onSomethingOff, className }: BodyProps): ReactElement {
  const answers = useAnswers(calibration.id, onAnswer)
  const lines = calibration.lines.slice(0, CALIBRATION_MAX)
  const empty = calibration.empty || lines.length === 0
  const canReject = onAnswer !== undefined && !answers.accepted
  return (
    <article
      aria-label={CALIBRATION_TITLE} data-calibration-id={calibration.id} data-state={empty ? 'empty' : answers.accepted ? 'accepted' : 'open'}
      className={className} style={CARD}
    >
      <Eyebrow>{CALIBRATION_TITLE}</Eyebrow>
      {empty ? <p style={MUTED}>{CALIBRATION_EMPTY}</p> : (
        <ul style={LIST}>
          {lines.map((line) => (
            <LineItem key={line.id} line={line} rejected={answers.rejected.has(line.id)} busy={answers.busy} onReject={canReject ? answers.reject : undefined} />
          ))}
        </ul>
      )}
      <Offers offers={calibration.offers.slice(0, CALIBRATION_MAX)} />
      <RefusedLine text={answers.refused} />
      <footer style={{ ...LINE, justifyContent: 'space-between' }}>
        <AiCaption />
        {empty ? null : (
          <Buttons accepted={answers.accepted} busy={answers.busy} onAccept={onAnswer ? answers.accept : undefined} onSomethingOff={onSomethingOff} />
        )}
      </footer>
    </article>
  )
}

/** cards.CalibrationCard: what Auto knows so far, from its props, with Reject, Sounds right and Something's off. */
export const CalibrationCard: Sdk['CalibrationCard'] = function CalibrationCard({ calibration, onAnswer, onSomethingOff, className }) {
  const shown = useMemo(() => checkedCalibration(calibration), [calibration])
  const answer = handlerOf(onAnswer, 'CalibrationCard', 'onAnswer')
  const off = handlerOf(onSomethingOff, 'CalibrationCard', 'onSomethingOff')
  return <Body key={shown.id} calibration={shown} onAnswer={answer} onSomethingOff={off} className={className} />
}
