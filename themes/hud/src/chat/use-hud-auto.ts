// After themes/play/src/hooks/use-auto-mascot.ts (Play 1.1.1): Auto driven by the chat, with Play's reducer and
// events (@automatos/mascot). HUD leaves out Play's hello on the first open, and the typing cue: in HUD a
// "Listening" chip would read as the microphone being open, which only the host's voice button opens (the chip says
// "Listening" only then, chip.ts, and MIC LIVE says so in the top bar).
import { type Dispatch, useCallback, useEffect, useMemo, useReducer, useRef } from 'react'

import {
  type ChatStatus,
  mascotEventsFromReply,
  mascotEventsFromStatus,
  NO_REPLY,
  type ReplyProgress,
} from '@automatos/mascot/events'
import { INITIAL_MASCOT, mascotReducer } from '@automatos/mascot/reducer'
import type { MascotEvent, MascotName, MascotState } from '@automatos/mascot/types'

import { mascotEventsFromData } from './data-events'
import { IDLE_MS, useIdleTimeout } from './use-idle-timeout'

/**
 * Auto's state on the core: his reducer is fed from the chat's data parts (onData), its status and its newest
 * reply (the model reasoning, the words starting, a cap), the backend's health, the page's own events (dispatch:
 * Stop, an approval card waiting) and the idle nap. The core hands `mascot` and `onClipEnded` to HudAuto.
 */

export type BackendStatus = 'up' | 'down'

export interface HudAutoOptions {
  /** The chat's status: into streaming starts a turn, back to idle finishes it, into error fails it. */
  readonly status?: ChatStatus
  /** Set when the last turn was blocked ('credits_exhausted'). */
  readonly errorCode?: string | null
  /** The newest reply (reply.ts replyProgress): its reasoning thinks, its words end thinking, a cap is oops. */
  readonly reply?: ReplyProgress
  /** The backend's connection: down puts Auto to sleep until it is up again. Unknown: leave undefined. */
  readonly backend?: BackendStatus
  /** How long without input before Auto naps. */
  readonly idleMs?: number
}

export interface HudAutoDriver {
  readonly state: MascotState
  /** The state to show: HudAuto's `state`. */
  readonly mascot: MascotName
  /** The chat controller's onData. */
  readonly onData: (part: unknown) => void
  /** The page's events: stop, the turn's own (approval-waiting, deliverable-added, …). */
  readonly dispatch: Dispatch<MascotEvent>
  /** HudAuto's onClipEnded: a one-shot's clip ended. */
  readonly onClipEnded: (state: MascotName) => void
}

/** The chat's status as events: the first render counts as coming from idle, so an awaited reply thinks. */
function useStatusEvents(status: ChatStatus, errorCode: string | null, dispatch: Dispatch<MascotEvent>): void {
  const previous = useRef<ChatStatus>('idle')
  useEffect(() => {
    const events = mascotEventsFromStatus(previous.current, status, errorCode)
    previous.current = status
    events.forEach(dispatch)
  }, [status, errorCode, dispatch])
}

/**
 * The newest reply's reasoning, its words starting and a cap ending its turn, after the status events of the same
 * render (so a send thinks first, and a cap that lands with the stream's end is oops after the finish).
 */
function useReplyEvents(reply: ReplyProgress, status: ChatStatus, dispatch: Dispatch<MascotEvent>): void {
  const previous = useRef<ReplyProgress>(NO_REPLY)
  const { id, hasText, toolRunning, reasoningChars, limitReached } = reply
  useEffect(() => {
    const next: ReplyProgress = { id, hasText, toolRunning, reasoningChars, limitReached }
    const events = mascotEventsFromReply(previous.current, next, status)
    previous.current = next
    events.forEach(dispatch)
  }, [id, hasText, toolRunning, reasoningChars, limitReached, status, dispatch])
}

function useBackendEvents(backend: BackendStatus | undefined, dispatch: Dispatch<MascotEvent>): void {
  useEffect(() => {
    if (backend === 'down') dispatch({ type: 'backend-down' })
    if (backend === 'up') dispatch({ type: 'backend-up' })
  }, [backend, dispatch])
}

export function useHudAuto(options: HudAutoOptions = {}): HudAutoDriver {
  const { status = 'idle', errorCode = null, reply = NO_REPLY, backend, idleMs = IDLE_MS } = options
  const [state, dispatch] = useReducer(mascotReducer, INITIAL_MASCOT)

  useStatusEvents(status, errorCode, dispatch)
  useReplyEvents(reply, status, dispatch)
  useBackendEvents(backend, dispatch)

  const nap = useCallback(() => dispatch({ type: 'idle-timeout' }), [])
  const wake = useCallback(() => dispatch({ type: 'wake' }), [])
  useIdleTimeout(nap, wake, idleMs)

  const onData = useCallback((part: unknown) => mascotEventsFromData(part).forEach(dispatch), [])
  const onClipEnded = useCallback((ended: MascotName) => dispatch({ type: 'clip-ended', state: ended }), [])

  return useMemo(
    () => ({ state, mascot: state.mascot, onData, dispatch, onClipEnded }),
    [state, onData, onClipEnded],
  )
}
