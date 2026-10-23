/**
 * PRD-261 B-02c: one conversation's turn in the fake chat: the stream a recorded turn plays, Send, Try again
 * and Stop. Not an SDK name.
 *
 * Mirrors core (101a0bf33f64fb4f89af81b4293415be60b661ac): frontend/lib/chat/hooks.ts useChat (sendMessage :149
 * puts the owner's message and an empty reply on screen, status streaming, the last code cleared; a refused
 * response :227 drops the reply, status error, the credits code when its body names it; the stream's end :568
 * is status idle; a failed fetch :571 drops the reply, status error), hooks/use-stopped-reply.ts (Stop keeps the
 * reply being written, as stopped, P260-FX-30, and the turn ends: status idle), lib/chat/use-chat-with-receipts.ts
 * :42 (Try again sends the owner's last message again, the turn after it gone) and lib/chat-controller/turn.ts
 * (deliverable-added once per Deliverable, approval-waiting and approval-settled as a card starts and stops
 * waiting, turn-failed once per reply that failed in words, the suggestion cleared on a send).
 *
 * Each frame arrives on its own timer tick (setTimeout 0), so a component renders between frames; a test on fake
 * timers advances them. A held turn stays open until Stop, or until a test goes on with it (continueHeldTurn in
 * chat-script.ts: more frames, then the end, or another hold). The cards live with the component here (core keeps
 * them in a store by conversation, so they outlive the chat screen there).
 */
import type { HostChatStatus, HostChatTurnEvent, HostMissionSuggestion } from '@automatos/theme-sdk'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { type ApprovalStatus, approvalsInPart, type FiledApproval, fileApprovals, isWaitingCard, withStatus } from './approvals.ts'
import { holdTurn, type RecordedFrame, type RecordedTurn, recordSent, REFUSED_BODY, STREAM_STATUS, takeTurn } from './chat-script.ts'
import {
  deliverablesInPart,
  fieldsOf,
  forwardedPart,
  replyRecord,
  type ReplyRecord,
  suggestionInPart,
  turnErrorOf,
  withFrame,
} from './chat-reply.ts'
import { nextTick } from './timing.ts'

/** lib/credits.ts:16: the code a request refused for used-up credits carries. */
export const CREDITS_EXHAUSTED_CODE = 'credits_exhausted'
const CHAT_ID = 'chat-id'
const USER_ID = 'user'
const REPLY_ID = 'reply'
const WAITING: HostChatTurnEvent = Object.freeze({ type: 'approval-waiting' })
const SETTLED: HostChatTurnEvent = Object.freeze({ type: 'approval-settled' })
const DELIVERABLE_ADDED: HostChatTurnEvent = Object.freeze({ type: 'deliverable-added' })

export interface TurnState {
  readonly messages: readonly ReplyRecord[]
  readonly status: HostChatStatus
  readonly errorCode: string | null
  /** The reply being written; null while no turn streams. */
  readonly writingId: string | null
  /** The replies Stop ended. */
  readonly stopped: readonly string[]
  readonly approvals: readonly FiledApproval[]
  readonly suggestion: HostMissionSuggestion | null
}

export type TurnAction =
  | { readonly type: 'sent'; readonly kept: readonly ReplyRecord[]; readonly user: ReplyRecord; readonly reply: ReplyRecord }
  | { readonly type: 'frame'; readonly replyId: string; readonly frame: RecordedFrame; readonly at: Date }
  | { readonly type: 'ended' }
  | { readonly type: 'refused'; readonly replyId: string; readonly code: string | null }
  | { readonly type: 'stopped' }
  | { readonly type: 'card'; readonly key: string; readonly status: ApprovalStatus }

type TurnDispatch = (action: TurnAction) => void
/** A ref's shape (React's useRef result), read by the helpers below. */
type Box<T> = { current: T }

/** What the chat screen hands the turn on every render. */
export interface TurnHandlers {
  readonly chatId: string | null
  /** The backend named the new chat: the screen keeps it. */
  readonly adopt: (chatId: string) => void
  readonly onData?: (part: unknown) => void
  readonly onEvent?: (event: HostChatTurnEvent) => void
  /** The backend is down (the host's health): a send fails as a fetch that can't connect. */
  readonly down: boolean
}

export interface ScriptedTurn {
  readonly state: TurnState
  readonly send: (text: string) => boolean
  readonly retry: () => boolean
  readonly stop: () => void
  readonly card: (key: string, status: ApprovalStatus) => void
}

interface TurnSink {
  readonly frame: (replyId: string, frame: RecordedFrame) => void
  readonly end: () => void
  readonly refuse: (replyId: string, code: string | null) => void
  readonly down: () => boolean
}

let serial = 0

function nextId(prefix: string): string {
  serial += 1
  return `${prefix}-${serial}`
}

export function initialTurn(history: readonly ReplyRecord[]): TurnState {
  return Object.freeze({
    messages: history,
    status: 'idle',
    errorCode: null,
    writingId: null,
    stopped: Object.freeze([]),
    approvals: Object.freeze([]),
    suggestion: null,
  })
}

/** The credits code when a refused body or an error line names it; else null. */
function creditsCodeIn(text: string): string | null {
  return text.includes(CREDITS_EXHAUSTED_CODE) ? CREDITS_EXHAUSTED_CODE : null
}

function frameRead(state: TurnState, action: Extract<TurnAction, { type: 'frame' }>): TurnState {
  const { frame, replyId } = action
  const messages = state.messages.map((message) => (message.id === replyId ? withFrame(message, frame) : message))
  if ('error' in frame) {
    const { code } = turnErrorOf(frame.error)
    const credits = code === CREDITS_EXHAUSTED_CODE ? code : creditsCodeIn(JSON.stringify(frame.error) ?? '')
    return { ...state, messages, status: 'error', errorCode: credits ?? state.errorCode }
  }
  if (!('data' in frame)) return { ...state, messages }
  const part = forwardedPart(frame.data)
  const approvals = fileApprovals(state.approvals, approvalsInPart(part), replyId, action.at)
  return { ...state, messages, approvals, suggestion: suggestionInPart(part) ?? state.suggestion }
}

export function turnReducer(state: TurnState, action: TurnAction): TurnState {
  switch (action.type) {
    case 'sent': {
      const messages = [...action.kept, action.user, action.reply]
      return { ...state, messages, status: 'streaming', errorCode: null, writingId: action.reply.id, suggestion: null }
    }
    case 'frame':
      return frameRead(state, action)
    case 'ended':
      return { ...state, status: 'idle', writingId: null }
    case 'refused': {
      const messages = state.messages.filter((message) => message.id !== action.replyId)
      return { ...state, messages, status: 'error', errorCode: action.code, writingId: null }
    }
    case 'stopped': {
      const stopped = state.writingId === null ? state.stopped : [...state.stopped, state.writingId]
      return { ...state, status: 'idle', writingId: null, stopped }
    }
    case 'card':
      return { ...state, approvals: withStatus(state.approvals, action.key, action.status) }
    default:
      return state
  }
}

/** lib/chat/retry.ts: the messages before the owner's last one, and its words; null when there is none. */
function lastTurn(messages: readonly ReplyRecord[]): { readonly kept: readonly ReplyRecord[]; readonly text: string } | null {
  const index = messages.map((message) => message.role).lastIndexOf('user')
  const asked = messages[index]
  return index < 0 || asked === undefined ? null : { kept: messages.slice(0, index), text: asked.text }
}

/** What a test goes on with a held turn with (continueHeldTurn), or null once `signal` aborts (Stop, an unmount). */
function heldUntil(signal: AbortSignal): Promise<RecordedTurn | null> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(null)
      return
    }
    const letGo = holdTurn(resolve)
    signal.addEventListener('abort', () => {
      letGo()
      resolve(null)
    }, { once: true })
  })
}

/** A turn's frames into the reply, a frame per tick; a held turn then waits to go on, until `signal` aborts. */
async function playFrames(replyId: string, turn: RecordedTurn, signal: AbortSignal, sink: TurnSink): Promise<void> {
  let part: RecordedTurn | null = turn
  while (part !== null) {
    for (const frame of part.frames) {
      await nextTick()
      if (signal.aborted) return
      sink.frame(replyId, frame)
    }
    part = part.hold === true ? await heldUntil(signal) : null
  }
}

/**
 * Plays the next recorded turn into the reply `replyId`, a frame per tick, until it ends or `signal` aborts. A
 * request to a backend that is down never connects, so it takes no turn off the script.
 */
async function playTurn(replyId: string, signal: AbortSignal, sink: TurnSink): Promise<void> {
  await nextTick()
  if (signal.aborted) return
  if (sink.down()) return sink.refuse(replyId, null)
  const turn: RecordedTurn = takeTurn()
  if (turn.status !== undefined && turn.status !== STREAM_STATUS) return sink.refuse(replyId, creditsCodeIn(turn.body ?? REFUSED_BODY))
  await playFrames(replyId, turn, signal, sink)
  if (signal.aborted) return
  await nextTick()
  if (!signal.aborted) sink.end()
}

/** deliverable-added once for a part that brings a Deliverable not seen in this conversation. */
function announceDeliverables(part: unknown, seen: Box<ReadonlySet<string>>, handlers: TurnHandlers): void {
  const fresh = deliverablesInPart(part).filter((made) => !seen.current.has(made.id))
  if (fresh.length === 0) return
  seen.current = new Set([...Array.from(seen.current), ...fresh.map((made) => made.id)])
  handlers.onEvent?.(DELIVERABLE_ADDED)
}

/** One frame: a new chat's name goes to adopt; a data part goes to the theme's onData, then the turn reads it. */
function readFrame(
  replyId: string,
  frame: RecordedFrame,
  dispatch: TurnDispatch,
  handlers: TurnHandlers,
  seen: Box<ReadonlySet<string>>,
): void {
  if (!('data' in frame)) return dispatch({ type: 'frame', replyId, frame, at: new Date() })
  const line = fieldsOf(frame.data)
  if (line.type === CHAT_ID && typeof line.chatId === 'string' && line.chatId) return handlers.adopt(line.chatId)
  const part = forwardedPart(frame.data)
  if (part !== null) handlers.onData?.(part)
  dispatch({ type: 'frame', replyId, frame, at: new Date() })
  announceDeliverables(part, seen, handlers)
}

function useSink(dispatch: TurnDispatch, latest: Box<TurnHandlers>): TurnSink {
  const seen = useRef<ReadonlySet<string>>(new Set())
  return useMemo(
    () => ({
      frame: (replyId: string, frame: RecordedFrame) => readFrame(replyId, frame, dispatch, latest.current, seen),
      end: () => dispatch({ type: 'ended' }),
      refuse: (replyId: string, code: string | null) => dispatch({ type: 'refused', replyId, code }),
      down: () => latest.current.down,
    }),
    [dispatch, latest],
  )
}

/** The newest reply when it failed in words and is no longer being written. */
function failedReply(state: TurnState): ReplyRecord | null {
  const replies = state.messages.filter((message) => message.role === 'assistant')
  const reply = replies[replies.length - 1]
  return state.status !== 'streaming' && reply?.error ? reply : null
}

/** approval-waiting and approval-settled as a card starts and stops waiting; turn-failed once per failed reply. */
function useTurnEvents(state: TurnState, latest: Box<TurnHandlers>): void {
  const waiting = state.approvals.some(isWaitingCard)
  const wasWaiting = useRef(waiting)
  useEffect(() => {
    if (waiting === wasWaiting.current) return
    wasWaiting.current = waiting
    latest.current.onEvent?.(waiting ? WAITING : SETTLED)
  }, [waiting, latest])
  const failed = failedReply(state)
  const failedId = failed?.id ?? null
  const failedCode = failed?.error?.code ?? null
  const announced = useRef(failedId)
  useEffect(() => {
    if (failedId === null || failedId === announced.current) return
    announced.current = failedId
    latest.current.onEvent?.({ type: 'turn-failed', code: failedCode })
  }, [failedId, failedCode, latest])
}

/** One conversation's turn: its state, and Send, Try again, Stop and a card's outcome. */
export function useScriptedTurn(history: readonly ReplyRecord[], handlers: TurnHandlers): ScriptedTurn {
  const [state, dispatch] = useReducer(turnReducer, history, initialTurn)
  const latest = useRef(handlers)
  latest.current = handlers
  const now = useRef(state)
  now.current = state
  const running = useRef<AbortController | null>(null)
  useEffect(() => () => running.current?.abort(), [])
  useTurnEvents(state, latest)
  const sink = useSink(dispatch, latest)
  const start = useCallback(
    (text: string, kept: readonly ReplyRecord[], retry: boolean): boolean => {
      if (running.current !== null) return false
      const controller = new AbortController()
      running.current = controller
      const reply = replyRecord(nextId(REPLY_ID), 'assistant')
      dispatch({ type: 'sent', kept, user: replyRecord(nextId(USER_ID), 'user', text), reply })
      recordSent({ chatId: latest.current.chatId, text, retry })
      void playTurn(reply.id, controller.signal, sink).finally(() => {
        if (running.current === controller) running.current = null
      })
      return true
    },
    [sink],
  )
  const send = useCallback((text: string) => start(text, now.current.messages, false), [start])
  const retry = useCallback((): boolean => {
    if (running.current !== null) return false
    const asked = lastTurn(now.current.messages)
    return asked === null || start(asked.text, asked.kept, true)
  }, [start])
  const stop = useCallback(() => {
    const controller = running.current
    running.current = null
    controller?.abort()
    dispatch({ type: 'stopped' })
  }, [])
  const card = useCallback((key: string, status: ApprovalStatus) => dispatch({ type: 'card', key, status }), [])
  return useMemo(() => ({ state, send, retry, stop, card }), [state, send, retry, stop, card])
}
