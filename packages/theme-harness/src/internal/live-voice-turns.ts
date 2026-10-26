/**
 * Theme voice: the voice session's words in the conversation they belong to, as core's chat shows them (at
 * fef53bf16ffe3dccd47130e7b327fa6561934eee: frontend/lib/voice/live-turns.ts, lib/chat/live-voice-turns.ts and
 * lib/voice/host/voice-host.ts). Not an SDK name. While the fake host's voice session (voice-session.ts) runs on a
 * conversation (its chatId), the fake chat (src/sdk/chat.ts) appends what the member is saying and what Auto is saying
 * to that conversation's messages, as two ordinary messages at the end: `voice-live-user` and `voice-live-assistant`,
 * each with only its words. A theme draws them as it draws any message, so it never draws the session's heard and
 * reply itself: one that did would show the words twice in core.
 *
 * - Only on the conversation the session names: core's host publishes the words only while the session's chatId is
 *   set (an existing conversation from the start; a new chat once the turn returns its id), and a VoiceButton that
 *   names no conversation starts the session on the one on screen (voice-session.ts runPress).
 * - Only words: a message for each side that has said something so far, the member's first.
 * - They go once the turn is saved (host.voiceTurnSaved(chatId), core's chat_changed landing for that conversation)
 *   and stay hidden while Auto's words of that exchange keep growing; other words of the member's are a new exchange,
 *   which shows (core's settle rule). Core's chat_changed brings the saved rows too; the stand-in's does not, so a
 *   test that wants them stores them with setConversations.
 * - They go when the session ends (idle, ended or failed). Core keeps them until the saved rows land, which for a turn
 *   that ended is as it ends; the stand-in has no backend to save them, so the end stands in for it.
 */
import { useMemo } from 'react'
import { cell } from './cell.ts'
import { replyRecord, type ReplyRecord } from './scripted/chat-reply.ts'
import { isRunning, session, type VoiceSessionStandIn } from './voice-session.ts'

/** live-voice-turns.ts VOICE_LIVE_USER_ID and VOICE_LIVE_ASSISTANT_ID. */
export const VOICE_LIVE_USER_ID = 'voice-live-user'
export const VOICE_LIVE_ASSISTANT_ID = 'voice-live-assistant'

/** live-turns.ts LiveVoiceTurn: the session's exchange in progress, in the conversation it writes into. */
export interface LiveVoiceTurn {
  readonly chatId: string
  readonly userText: string
  readonly agentText: string
}

/** live-turns.ts SavedVoiceExchange: the exchange whose saved rows landed, by the member's words of it. */
export interface SavedExchange {
  readonly chatId: string
  readonly userText: string
}

const saved = cell<SavedExchange | null>(null)

/** What the host publishes for the session now (voice-host.ts onEngine): its words in its conversation while it runs. */
export function turnOf(now: VoiceSessionStandIn): LiveVoiceTurn | null {
  if (!isRunning(now.phase) || now.chatId === null || (!now.heard && !now.reply)) return null
  return Object.freeze({ chatId: now.chatId, userText: now.heard, agentText: now.reply })
}

function isExchangeOf(exchange: SavedExchange | null, turn: LiveVoiceTurn): boolean {
  return exchange !== null && exchange.chatId === turn.chatId && exchange.userText === turn.userText
}

// live-turns.ts publish and clear, on every change of the session: Auto's words of a saved exchange keep growing and
// stay saved; other words of the member's, another conversation, or no words at all start again.
session.subscribe(() => {
  const kept = saved.get()
  const turn = turnOf(session.get())
  if (kept !== null && (turn === null || !isExchangeOf(kept, turn))) saved.set(null)
})

/** live-turns.ts settle: `chatId`'s saved rows landed, so the exchange in progress there is saved and its words go. */
export function voiceTurnSaved(chatId: string): void {
  const turn = turnOf(session.get())
  if (turn === null || turn.chatId !== chatId || isExchangeOf(saved.get(), turn)) return
  saved.set(Object.freeze({ chatId, userText: turn.userText }))
}

/** live-turns.ts visibleLiveTurn: the words still to show in `chatId`'s conversation; null when there are none. */
export function visibleTurn(now: VoiceSessionStandIn, kept: SavedExchange | null, chatId: string | null): LiveVoiceTurn | null {
  const turn = turnOf(now)
  if (turn === null || chatId === null || turn.chatId !== chatId || isExchangeOf(kept, turn)) return null
  return turn
}

/** live-voice-turns.ts withLiveVoiceTurn: `records` with the session's words at the end; `records` itself with none. */
export function withLiveVoiceTurn(records: readonly ReplyRecord[], turn: LiveVoiceTurn | null): readonly ReplyRecord[] {
  if (turn === null) return records
  const live = [
    ...(turn.userText ? [replyRecord(VOICE_LIVE_USER_ID, 'user', turn.userText)] : []),
    ...(turn.agentText ? [replyRecord(VOICE_LIVE_ASSISTANT_ID, 'assistant', turn.agentText)] : []),
  ]
  return live.length > 0 ? Object.freeze([...records, ...live]) : records
}

/** live-voice-turns.ts useLiveVoiceMessages: the conversation `chatId`'s messages with the session's words there. */
export function useLiveVoiceRecords(records: readonly ReplyRecord[], chatId: string | null): readonly ReplyRecord[] {
  const now = session.use()
  const kept = saved.use()
  const turn = useMemo(() => visibleTurn(now, kept, chatId), [now, kept, chatId])
  return useMemo(() => withLiveVoiceTurn(records, turn), [records, turn])
}
