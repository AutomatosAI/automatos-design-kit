/**
 * PRD-268 (SDK 1.3.0): the stand-in for the SDK's `voice.BriefVoice`, Listen for the day's brief. It mirrors core's
 * frontend/lib/theme-sdk/host-cards/brief-voice.tsx over components/voice/brief-voice.tsx (at
 * 1a8956c874dc42cff05b96f431c50b7d722a71aa): it reads the brief the host holds (the fake useBrief's `spoken`) and never
 * a theme's text (a theme never speaks), and draws Listen, or while Auto reads, the "AI voice assistant" caption and
 * Stop, in the protected surface `brief-voice`. The root (`data-brief-voice="root"`) carries `data-voice-speaking="true"`
 * while Auto reads, which a theme's speaking line follows, and a screen reader hears that Auto is reading.
 *
 * SDK 1.4.0 (at d92cabf202f4a04f48a429d5f79a05cbe6c1eefb, components/voice/use-brief-voice.ts and brief-voice-rows.ts):
 * the brief row Auto is reading. While Auto reads one of the brief's rows (its index in the rows of `brief.sections`,
 * in the sections' order: the number Auto says, less one), the root carries `data-voice-row="<index>"`, and the
 * theme's `onSpeakingRow` hears the index, then null between rows and once the reading ends or stops, the stand-in taken
 * off the page included, each change once. Its one prop is checked: a value that isn't a function throws a TypeError
 * naming it; a handler that throws is logged, and Auto reads on.
 *
 * Listen is disabled until the host holds a brief with something to say, and while the tab's voice session runs; a
 * session starting stops a reading. Nothing plays here: a press of Listen starts the made-up reading (kept as a card
 * action, 'listen'), and it runs until Stop ('stop'), a voice session, or a test ends it (host.setBriefReading). The
 * row Auto reads is a test's to set (host.setBriefRow), as the speech's own events set it in core.
 */
import { type ReactElement, useEffect, useRef } from 'react'
import { cell } from '../internal/cell.ts'
import { handlerOf } from '../internal/proactive/props.ts'
import { recordCardAction } from '../internal/scripted/cards-log.ts'
import { availability, isRunning, session } from '../internal/voice-session.ts'
import { useBrief } from './proactive.ts'
import { AI_VOICE_LABEL, CONTROL_ROW, SR_ONLY, STOP_CONTROLS, stopControlStyle } from './voice-button-styles.ts'

type Sdk = typeof import('@automatos/theme-sdk')
type BriefVoiceProps = NonNullable<Parameters<Sdk['BriefVoice']>[0]>
/** A brief row's index while Auto reads it; null while it reads none (brief-voice-rows.ts SpokenRow). */
type SpokenRow = number | null

/** components/voice/brief-voice.tsx: Listen's words and the line a screen reader hears while Auto reads. */
export const LISTEN = 'Listen'
export const LISTEN_TO_THE_BRIEF = 'Listen to the brief'
export const READING_THE_BRIEF = 'Auto is reading the brief'
const CARD = 'BriefVoice'
const ROW_PROP = 'onSpeakingRow'
/** use-brief-voice.ts LOG_PREFIX: the warning a handler that throws leaves. */
const LOG_PREFIX = '[voice]'
const ROOT_STYLE = Object.freeze({ width: 'fit-content' })
const LISTEN_STYLE = stopControlStyle(false)
const NO_PROPS: BriefVoiceProps = Object.freeze({})

/** Whether Auto is reading the brief now, and the row it reads (null: none, between rows or before the first). */
const reading = cell(false)
const speakingRow = cell<SpokenRow>(null)

function setReading(on: boolean): void {
  reading.set(on)
  if (!on) speakingRow.set(null)
}

function press(action: 'listen' | 'stop', date: string): void {
  recordCardAction({ card: 'brief-voice', id: date, action })
  setReading(action === 'listen')
}

/** use-brief-voice.ts `tell`: the row to the theme's handler, a failure logged, never thrown on. */
function tell(handler: ((row: SpokenRow) => void) | undefined, row: SpokenRow): void {
  try {
    handler?.(row)
  } catch (error) {
    console.warn(LOG_PREFIX, `${ROW_PROP} failed`, error)
  }
}

/** use-brief-voice.ts `useRowReport`: each change of the row told once, and null once the stand-in leaves the page. */
function useRowReport(onRow: ((row: SpokenRow) => void) | undefined, row: SpokenRow): void {
  const handler = useRef(onRow)
  const reported = useRef<SpokenRow>(null)
  handler.current = onRow
  useEffect(() => {
    if (row === reported.current) return
    reported.current = row
    tell(handler.current, row)
  }, [row])
  useEffect(() => () => {
    if (reported.current !== null) tell(handler.current, null)
  }, [])
}

/** voice.BriefVoice: Listen, or the caption and Stop while Auto reads the brief the host holds. */
export const BriefVoice: Sdk['BriefVoice'] = function BriefVoice(props: BriefVoiceProps = NO_PROPS): ReactElement {
  const onSpeakingRow = handlerOf(props?.onSpeakingRow, CARD, ROW_PROP)
  const brief = useBrief().data
  const spoken = brief?.spoken ?? ''
  const voice = availability.use()
  const phase = session.use().phase
  const sessionRunning = voice !== null && isRunning(phase)
  const speaking = reading.use()
  const current = speakingRow.use()
  const row = speaking ? current : null
  useRowReport(onSpeakingRow, row)
  const date = brief?.date ?? ''
  useEffect(() => {
    if (sessionRunning && reading.get()) setReading(false)
  }, [sessionRunning])
  const stop = STOP_CONTROLS.stop
  return (
    <div
      data-brief-voice="root" data-voice-speaking={speaking ? 'true' : undefined}
      data-voice-row={row === null ? undefined : String(row)} style={ROOT_STYLE}
    >
      <div data-protected-surface="brief-voice">
        <div data-protected-surface-inner="" style={CONTROL_ROW}>
          {speaking ? <span role="note" aria-label={AI_VOICE_LABEL} data-testid="ai-voice-label">{AI_VOICE_LABEL}</span> : null}
          {speaking ? (
            <button type="button" aria-label={stop.name} style={stopControlStyle(stop.alert)} onClick={() => press('stop', date)}>{stop.word}</button>
          ) : (
            <button
              type="button" aria-label={LISTEN_TO_THE_BRIEF} disabled={!spoken.trim() || sessionRunning} style={LISTEN_STYLE}
              onClick={() => press('listen', date)}
            >
              {LISTEN}
            </button>
          )}
        </div>
      </div>
      <span role="status" aria-live="polite" data-brief-voice-status="" style={SR_ONLY}>{speaking ? READING_THE_BRIEF : ''}</span>
    </div>
  )
}

/** A row index a test may set: a whole number from 0, or null. */
function checkedRow(row: unknown): SpokenRow {
  if (row === null || (typeof row === 'number' && Number.isInteger(row) && row >= 0)) return row
  throw new TypeError('host.setBriefRow takes a brief row\'s index (a whole number from 0) or null.')
}

/** The controls of this stand-in, gathered by host.ts. */
export const briefVoiceControls = Object.freeze({
  /** Auto reads the brief from now on (true), as after a press of Listen, or stops (false), reading no row. */
  setBriefReading(on: boolean): void {
    setReading(on)
  },
  /**
   * Auto starts reading the brief's row `row` (its index in the rows of `brief.sections`, in the sections' order), as
   * the speech's events report it, the reading started if it wasn't; null: between rows, or during the greeting.
   */
  setBriefRow(row: number | null): void {
    const checked = checkedRow(row)
    if (checked !== null) reading.set(true)
    speakingRow.set(checked)
  },
})

export function resetBriefVoice(): void {
  setReading(false)
}
