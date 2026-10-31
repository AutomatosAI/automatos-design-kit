/**
 * PRD-268 (SDK 1.3.0): the stand-in for the SDK's `voice.BriefVoice`, Listen for the day's brief. It mirrors core's
 * frontend/lib/theme-sdk/host-cards/brief-voice.tsx over components/voice/brief-voice.tsx (at
 * 1a8956c874dc42cff05b96f431c50b7d722a71aa): it takes no props (a theme never speaks), reads the brief the host holds
 * (the fake useBrief's `spoken`), and draws Listen, or while Auto reads, the "AI voice assistant" caption and Stop, in
 * the protected surface `brief-voice`. The root (`data-brief-voice="root"`) carries `data-voice-speaking="true"` while
 * Auto reads, which a theme's speaking line follows, and a screen reader hears that Auto is reading.
 *
 * Listen is disabled until the host holds a brief with something to say, and while the tab's voice session runs; a
 * session starting stops a reading. Nothing plays here: a press of Listen starts the made-up reading (kept as a card
 * action, 'listen'), and it runs until Stop ('stop'), a voice session, or a test ends it (host.setBriefReading).
 */
import { type ReactElement, useEffect } from 'react'
import { cell } from '../internal/cell.ts'
import { recordCardAction } from '../internal/scripted/cards-log.ts'
import { availability, isRunning, session } from '../internal/voice-session.ts'
import { useBrief } from './proactive.ts'
import { AI_VOICE_LABEL, CONTROL_ROW, SR_ONLY, STOP_CONTROLS, stopControlStyle } from './voice-button-styles.ts'

type Sdk = typeof import('@automatos/theme-sdk')

/** components/voice/brief-voice.tsx: Listen's words and the line a screen reader hears while Auto reads. */
export const LISTEN = 'Listen'
export const LISTEN_TO_THE_BRIEF = 'Listen to the brief'
export const READING_THE_BRIEF = 'Auto is reading the brief'
const ROOT_STYLE = Object.freeze({ width: 'fit-content' })
const LISTEN_STYLE = stopControlStyle(false)

/** Whether Auto is reading the brief now. */
const reading = cell(false)

function press(action: 'listen' | 'stop', date: string): void {
  recordCardAction({ card: 'brief-voice', id: date, action })
  reading.set(action === 'listen')
}

/** voice.BriefVoice: Listen, or the caption and Stop while Auto reads the brief the host holds. */
export const BriefVoice: Sdk['BriefVoice'] = function BriefVoice(): ReactElement {
  const brief = useBrief().data
  const spoken = brief?.spoken ?? ''
  const voice = availability.use()
  const phase = session.use().phase
  const sessionRunning = voice !== null && isRunning(phase)
  const speaking = reading.use()
  const date = brief?.date ?? ''
  useEffect(() => {
    if (sessionRunning && reading.get()) reading.set(false)
  }, [sessionRunning])
  const stop = STOP_CONTROLS.stop
  return (
    <div data-brief-voice="root" data-voice-speaking={speaking ? 'true' : undefined} style={ROOT_STYLE}>
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

/** The controls of this stand-in, gathered by host.ts. */
export const briefVoiceControls = Object.freeze({
  /** Auto reads the brief from now on (true), as after a press of Listen, or stops (false). */
  setBriefReading(on: boolean): void {
    reading.set(on)
  },
})

export function resetBriefVoice(): void {
  reading.set(false)
}
