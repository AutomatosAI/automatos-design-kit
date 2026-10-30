// After themes/hud/src/chat/use-hud-auto.ts (HUD 1.1.2), itself from Play 1.1.1: Auto driven by the chat, with the
// kit's reducer and events (@automatos/mascot). Arcade keeps Play's typing cue (the design's portrait listens while
// you type) and ends a one-shot itself, since a sprite has no clip to end it.
import { type Dispatch, useCallback, useEffect, useMemo, useReducer, useRef } from 'react'

import {
  type ChatStatus,
  mascotEventsFromReply,
  mascotEventsFromStatus,
  NO_REPLY,
  type ReplyProgress,
} from '@automatos/mascot/events'
import { INITIAL_MASCOT, mascotReducer } from '@automatos/mascot/reducer'
import { ONE_SHOTS, type MascotEvent, type MascotName, type MascotState } from '@automatos/mascot/types'

import { mascotEventsFromData } from './data-events'
import { IDLE_MS, useIdleTimeout } from './use-idle-timeout'

/**
 * Auto's state in the dialogue window's portrait (the design's "portrait state follows the turn"): thinking once
 * you send, working, searching or reading while a tool runs, celebrating a new Deliverable or a done receipt, oops on
 * a failure, listening while you type or an approval card waits, asleep while the backend is down or after a long
 * while without input, idle otherwise. A one-shot (hello, celebrate) plays for ONE_SHOT_MS, then he settles.
 */

export type BackendStatus = 'up' | 'down'

/** How long a one-shot plays: a few loops of its frames. */
export const ONE_SHOT_MS = 2400

export interface AutoOptions {
  readonly status?: ChatStatus
  readonly errorCode?: string | null
  readonly reply?: ReplyProgress
  readonly backend?: BackendStatus
  readonly idleMs?: number
}

export interface AutoDriver {
  readonly state: MascotState
  readonly mascot: MascotName
  readonly onData: (part: unknown) => void
  readonly dispatch: Dispatch<MascotEvent>
}

function useStatusEvents(status: ChatStatus, errorCode: string | null, dispatch: Dispatch<MascotEvent>): void {
  const previous = useRef<ChatStatus>('idle')
  useEffect(() => {
    const events = mascotEventsFromStatus(previous.current, status, errorCode)
    previous.current = status
    events.forEach(dispatch)
  }, [status, errorCode, dispatch])
}

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

/** A one-shot ends after ONE_SHOT_MS, as its clip's end would end it. */
function useOneShotEnd(mascot: MascotName, dispatch: Dispatch<MascotEvent>): void {
  useEffect(() => {
    if (!ONE_SHOTS.has(mascot)) return undefined
    const timer = setTimeout(() => dispatch({ type: 'clip-ended', state: mascot }), ONE_SHOT_MS)
    return () => clearTimeout(timer)
  }, [mascot, dispatch])
}

export function useAuto(options: AutoOptions = {}): AutoDriver {
  const { status = 'idle', errorCode = null, reply = NO_REPLY, backend, idleMs = IDLE_MS } = options
  const [state, dispatch] = useReducer(mascotReducer, INITIAL_MASCOT)

  useStatusEvents(status, errorCode, dispatch)
  useReplyEvents(reply, status, dispatch)
  useBackendEvents(backend, dispatch)
  useOneShotEnd(state.mascot, dispatch)

  const nap = useCallback(() => dispatch({ type: 'idle-timeout' }), [])
  const wake = useCallback(() => dispatch({ type: 'wake' }), [])
  useIdleTimeout(nap, wake, idleMs)

  const onData = useCallback((part: unknown) => mascotEventsFromData(part).forEach(dispatch), [])
  return useMemo(() => ({ state, mascot: state.mascot, onData, dispatch }), [state, onData])
}
