/**
 * PRD-261 B-02c: the fake of SDK area `chat`. It mirrors core's frontend/lib/theme-sdk/chat.ts (at
 * 101a0bf33f64fb4f89af81b4293415be60b661ac): useChatController is called twice, first for the conversation on
 * screen (:314, over lib/chat-controller/conversation.ts: a ?chatId= link to a conversation the backend holds,
 * else a new chat; New chat shows a fresh one; a theme's draft link read for the message box), then in a child
 * keyed by conversation.key for that conversation's turn as the SDK's frozen view model (:345, over
 * internal/chat-view.ts). Only a conversation it handed out opens, and a component calls it one way for its life
 * (:383). Send and Try again start nothing while a turn runs or on a page with no host AI label (PRD-264 EUAI-11b,
 * internal/ai-label-gate.ts at 3d8c72e7b58d32866f058a171d68bbbb8a335504: a label a theme hides is still on screen,
 * drawn again in the host's own layer, so it never stops a turn). The lists (:398, :410), New chat (:415) and the
 * receipt helpers (:420-460 over lib/chat/receipts.ts) answer as core's do.
 *
 * The backend is scripted (src/internal/scripted/chat-script.ts; chat-turn.ts plays a turn): chatControls, which
 * host.ts gathers, set the recorded turns each send takes (setChatScript, from a fixture read with recordedTurns and
 * scriptOf) and go on with one held open (continueHeldTurn), the conversations (setConversations, conversationsOf;
 * a stored reply may name who wrote it, provenance, or be a failure the server saved, savedError), the host's AI
 * label on the page (setAiLabelShown), a screen still opening its conversation (setChatOpening: conversation null), a
 * turn still ending (setTurnEnding: Send and Try again start nothing, as while core's chat hook is still loading) and
 * the Mission being planned (setPlanningMissionId, core's Mission store), and read back what was sent (chatSent,
 * turnsLeft), how often New chat was pressed (startedChats) and each load of a conversation list
 * (conversationsAsked); resetChat puts them back.
 * While the host's voice session runs on a conversation, its words are that conversation's last two messages
 * (internal/live-voice-turns.ts, core's lib/chat/live-voice-turns.ts).
 * SDK 1.4.0 (core's internal/chat-view.ts and message-parts.ts at d92cabf202f4a04f48a429d5f79a05cbe6c1eefb): each
 * message's `knownParts`, its text, brief@1, suggestion@1 and reply_chips@1 parts checked and frozen
 * (internal/scripted/message-parts.ts), never its raw parts: a stored message's are its fixture's `parts` (else its
 * words), a message of the turn's are its words, so a live reply's chips reach a theme once its conversation opens again. Not modelled: the approvals store that keeps
 * cards across chat screens, and a cold start on the newest conversation (a new chat opens, as core's Play specs have).
 */
import type {
  HostChatApproval,
  HostChatConversation,
  HostChatController,
  HostChatControllerOptions,
  HostChatDraft,
  HostChatDraftLink,
  HostChatMessage,
  HostChatOnScreen,
  HostChatOnScreenOptions,
  HostChatSummary,
  HostConversationListState,
  HostReceipt,
  HostSearchParams,
} from '@automatos/theme-sdk'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveVoiceRecords } from '../internal/live-voice-turns.ts'
import { type ApprovalStatus, type FiledApproval, isWaitingCard } from '../internal/scripted/approvals.ts'
import { deliverablesFromReceipts, liveReceiptsIn, replyRecord, type ReplyRecord, withFrame } from '../internal/scripted/chat-reply.ts'
import { knownPartsOf, rawPartsOf, TEXT_PART } from '../internal/scripted/message-parts.ts'
import {
  aiLabelShown,
  chatSent,
  continueHeldTurn,
  type ConversationFixture,
  conversationsAsked,
  conversationsOf,
  type HistoryMessage,
  recordConversationsAsk,
  recordedTurns,
  resetChatScript,
  scriptOf,
  setActiveChatId,
  setAiLabelShown,
  setChatOpening,
  setChatScript,
  setConversations,
  setPlanningMissionId,
  setTurnEnding,
  startedChats,
  startFreshChat,
  turnEnding,
  turnsLeft,
  useActiveChatId,
  useChatOpening,
  useConversations,
  useFreshChats,
  usePlanningMissionId,
} from '../internal/scripted/chat-script.ts'
import { CREDITS_EXHAUSTED_CODE, type TurnState, useScriptedTurn } from '../internal/scripted/chat-turn.ts'
import { CHAT_HREF, useHealth, useHostRouter, useHostSearchParams } from '../internal/scripted/host-inputs.ts'
import { nextTick } from '../internal/scripted/timing.ts'

type Sdk = typeof import('@automatos/theme-sdk')
type CardOutcome = (key: string, status: ApprovalStatus) => void

/** chat.ts:307-310: the errors of a component that switches the way it calls, or opens a forged conversation. */
const MODE_CHANGED =
  'Automatos theme SDK: useChatController is called with a conversation, or without one, for the life of a component. Key the conversation screen by conversation.key.'
const NOT_HANDED_OUT = 'Automatos theme SDK: useChatController opens only a conversation that useChatController() handed out.'
/** lib/chat-controller/view-model.ts:23 and lib/chat/message-text.ts:16-17. */
const CHAT_ID_PARAM = 'chatId'
const NEW_CHAT = 'New chat'
const TITLE_CHARS = 60
/** hooks/use-conversation-list.ts:21 and hooks/use-recent-chats.ts:20. */
const CONVERSATION_LIMIT = 50
const RECENT_CHATS_LIMIT = 8
/** lib/chat/receipts.ts:16-25 and internal/href.ts:11-42. */
const REFUSED_PREFIX = 'tried, refused'
const SKIPPED_PREFIX = 'not run'
const WAITING_SUFFIX = 'waiting for you'
const NO_REASON = 'no reason given'
const CARD_NUMBER = /^#\d/
const INTERNAL_HREF = /^\/(?![/\\])/
const UNSAFE_CHAR = /[\u0000-\u001f\u007f\s]/
const BACKSLASH = '\\'
const NEW_CHAT_KEY = 'new-chat'
const CHAT_KEY = 'chat'
const LOADING: HostConversationListState = Object.freeze({ status: 'loading' })
const NO_CHATS: readonly HostChatSummary[] = Object.freeze([])

// ---- the conversation a theme holds (internal/chat-view.ts:41-64) ----

/** What the fake keeps on a conversation it handed out, out of a theme's reach. */
interface Opened {
  readonly history: readonly ReplyRecord[]
  readonly adopt: (chatId: string) => void
}

const OPENED: unique symbol = Symbol('automatos.theme-harness.chat.opened')

type WithOpened = HostChatConversation & { readonly [OPENED]?: Opened }

function handedOut(key: string, chatId: string | null, title: string | null, opened: Opened): HostChatConversation {
  const conversation = { key, chatId, title }
  Object.defineProperty(conversation, OPENED, { value: Object.freeze(opened), enumerable: false })
  return Object.freeze(conversation)
}

function openedOf(value: unknown): Opened | null {
  if (typeof value !== 'object' || value === null) return null
  return (value as WithOpened)[OPENED] ?? null
}

function isForged(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'key' in value && openedOf(value) === null
}

/**
 * A stored message as the conversation opens with it: its turn's frames read onto it (a tool line, a Deliverable), a
 * background post's provenance and a saved failure kept, and its raw parts (its own, else one text part of its words,
 * as core's controller gives a stored message) with its source.
 */
function storedReply(id: string, message: HistoryMessage): ReplyRecord {
  const record = (message.frames ?? []).reduce(withFrame, replyRecord(id, message.role, message.text))
  const parts = message.parts ?? [{ type: TEXT_PART, text: message.text }]
  const stored = Object.freeze({ parts, source: message.source ?? null })
  return Object.freeze({ ...record, provenance: message.provenance ?? null, savedError: message.savedError ?? null, stored })
}

function historyOf(conversation: ConversationFixture | null): readonly ReplyRecord[] {
  if (conversation === null) return Object.freeze([])
  return Object.freeze(conversation.messages.map((message, index) => storedReply(`${conversation.id}-${index}`, message)))
}

/** A theme's draft link, read whenever the query string changes, until the chat screen takes the words. */
function useDraft(link: HostChatDraftLink | undefined, params: HostSearchParams): Pick<HostChatOnScreen, 'draft' | 'takeDraft'> {
  const [draft, setDraft] = useState<HostChatDraft | null>(null)
  const serial = useRef(0)
  const query = params.toString()
  useEffect(() => {
    const words = link?.read(new URLSearchParams(query)) ?? null
    if (words === null) return
    serial.current += 1
    setDraft(Object.freeze({ text: words, serial: serial.current }))
  }, [link, query])
  const takeDraft = useCallback(() => setDraft(null), [])
  return { draft, takeDraft }
}

/**
 * chat.ts:314: the conversation on screen, a ?chatId= link's while no New chat was pressed after it opened; null
 * while the screen is still opening it (setChatOpening).
 */
function useConversationOnScreen(options: HostChatOnScreenOptions | undefined): HostChatOnScreen {
  const params = useHostSearchParams()
  const conversations = useConversations()
  const opening = useChatOpening()
  const fresh = useFreshChats()
  const openedAt = useRef(fresh)
  const [named, setNamed] = useState<Readonly<Record<string, string>>>({})
  const linkedId = fresh === openedAt.current ? params.get(CHAT_ID_PARAM) : null
  const linked = useMemo(() => conversations.find((known) => known.id === linkedId) ?? null, [conversations, linkedId])
  const key = linked === null ? `${NEW_CHAT_KEY}-${fresh}` : `${CHAT_KEY}-${linked.id}`
  const chatId = linked?.id ?? named[key] ?? null
  const adopt = useCallback((id: string) => setNamed((known) => ({ ...known, [key]: id })), [key])
  const history = useMemo(() => historyOf(linked), [linked])
  const title = linked?.title ?? null
  const conversation = useMemo(() => handedOut(key, chatId, title, { history, adopt }), [key, chatId, title, history, adopt])
  useEffect(() => setActiveChatId(chatId), [chatId])
  const { draft, takeDraft } = useDraft(options?.draftLink, params)
  const shown = opening ? null : conversation
  return useMemo(() => Object.freeze({ conversation: shown, draft, takeDraft }), [shown, draft, takeDraft])
}

// ---- one conversation's turn, as a theme draws it (internal/chat-view.ts:67-152) ----

function hostApproval(filed: FiledApproval, chatId: string, outcome: CardOutcome): HostChatApproval {
  const { key } = filed
  return Object.freeze({
    key,
    kind: filed.kind,
    replyId: filed.replyId,
    status: filed.status,
    filedAt: filed.filedAt,
    chatId,
    data: filed.data,
    answered: () => outcome(key, 'answered'),
    closed: () => outcome(key, 'closed'),
  })
}

function hostMessage(record: ReplyRecord, state: TurnState, chatId: string, outcome: CardOutcome): HostChatMessage {
  const raised = state.approvals.filter((filed) => filed.replyId === record.id && filed.status !== 'closed')
  const { stored, ...fields } = record
  return Object.freeze({
    ...fields,
    knownParts: knownPartsOf(record.role, rawPartsOf(record.text, stored), stored?.source),
    writing: record.id === state.writingId,
    stopped: state.stopped.includes(record.id),
    approvals: Object.freeze(raised.map((filed) => hostApproval(filed, chatId, outcome))),
    linkedDeliverables: deliverablesFromReceipts(record.receipts),
  })
}

/** lib/chat/message-text.ts:82: the stored title, else the owner's first words, else "New chat". */
function chatTitle(messages: readonly ReplyRecord[], stored: string | null): string {
  if (stored?.trim()) return stored.trim()
  const words = messages.find((message) => message.role === 'user')?.text.replace(/\s+/g, ' ').trim() ?? ''
  if (!words) return NEW_CHAT
  return words.length <= TITLE_CHARS ? words : `${words.slice(0, TITLE_CHARS - 1).trimEnd()}…`
}

/** The open cards whose reply is no longer in the conversation (Try again, a refused request): shown after it. */
function looseOf(state: TurnState, chatId: string, outcome: CardOutcome): readonly HostChatApproval[] {
  const shown = new Set(state.messages.map((message) => message.id))
  const loose = state.approvals.filter((filed) => filed.status !== 'closed' && !shown.has(filed.replyId))
  return Object.freeze(loose.map((filed) => hostApproval(filed, chatId, outcome)))
}

/** chat.ts:345: one conversation's turn as the SDK's frozen view model. */
function useOpenConversation(conversation: HostChatConversation, opened: Opened, options: HostChatControllerOptions | undefined): HostChatController {
  const down = useHealth().connection === 'down'
  const handlers = { chatId: conversation.chatId, adopt: opened.adopt, onData: options?.onData, onEvent: options?.onEvent, down }
  const { state, send: sendTurn, retry: retryTurn, stop, card } = useScriptedTurn(opened.history, handlers)
  const chatId = conversation.chatId ?? ''
  const shown = useLiveVoiceRecords(state.messages, conversation.chatId)
  const messages = useMemo(() => Object.freeze(shown.map((record) => hostMessage(record, state, chatId, card))), [shown, state, chatId, card])
  const looseApprovals = useMemo(() => looseOf(state, chatId, card), [state, chatId, card])
  const send = useCallback((text: string) => aiLabelShown() && !turnEnding() && sendTurn(text), [sendTurn])
  const retry = useCallback(() => aiLabelShown() && !turnEnding() && retryTurn(), [retryTurn])
  const planningMissionId = usePlanningMissionId()
  const title = chatTitle(shown, conversation.title)
  return useMemo(
    () =>
      Object.freeze({
        conversation,
        title,
        messages,
        status: state.status,
        streaming: state.status === 'streaming',
        errorCode: state.errorCode,
        trialExhausted: state.errorCode === CREDITS_EXHAUSTED_CODE,
        suggestion: state.suggestion,
        planningMissionId,
        looseApprovals,
        approvalWaiting: state.approvals.some(isWaitingCard),
        send,
        retry,
        stop,
      }),
    [conversation, title, messages, state, planningMissionId, looseApprovals, send, retry, stop],
  )
}

function useChatControllerFake(conversation: HostChatConversation, options?: HostChatControllerOptions): HostChatController
function useChatControllerFake(options?: HostChatOnScreenOptions): HostChatOnScreen
function useChatControllerFake(
  first?: HostChatConversation | HostChatOnScreenOptions,
  options?: HostChatControllerOptions,
): HostChatController | HostChatOnScreen {
  const opened = openedOf(first)
  const withConversation = useRef(opened !== null)
  if (isForged(first)) throw new Error(NOT_HANDED_OUT)
  if (withConversation.current !== (opened !== null)) throw new Error(MODE_CHANGED)
  // One way for the component's life (checked above), so the same hooks run on every render.
  if (opened !== null) return useOpenConversation(first as HostChatConversation, opened, options)
  return useConversationOnScreen(first as HostChatOnScreenOptions | undefined)
}

/** chat.ts:378: the conversation on screen (no argument), or one conversation's chat (one it handed out). */
export const useChatController: Sdk['useChatController'] = useChatControllerFake

// ---- the lists and New chat (chat.ts:398-418) ----

function summariesOf(conversations: readonly ConversationFixture[], limit: number): readonly HostChatSummary[] {
  const newest = [...conversations].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, limit)
  return Object.freeze(newest.map(({ id, title, updatedAt, preview }) => Object.freeze({ id, title, updatedAt, preview })))
}

/**
 * chat.ts:398 over hooks/use-conversation-list.ts:38: newest first; failed while the backend is down, with Retry.
 * Each load (on mount, on Retry, for a new limit, and when the conversations or the backend's health change) is
 * kept with its limit (conversationsAsked), as core's getChatHistory is asked.
 */
export const useConversationList: Sdk['useConversationList'] = (limit = CONVERSATION_LIMIT) => {
  const conversations = useConversations()
  const down = useHealth().connection === 'down'
  const [attempt, setAttempt] = useState(0)
  const [phase, setPhase] = useState<'loading' | 'loaded' | 'failed'>('loading')
  useEffect(() => {
    let current = true
    recordConversationsAsk({ limit })
    void nextTick().then(() => {
      if (current) setPhase(down ? 'failed' : 'loaded')
    })
    return () => {
      current = false
    }
  }, [conversations, down, attempt, limit])
  const retry = useCallback(() => {
    setPhase('loading')
    setAttempt((count) => count + 1)
  }, [])
  const chats = useMemo(() => summariesOf(conversations, limit), [conversations, limit])
  return useMemo((): HostConversationListState => {
    if (phase === 'loaded') return Object.freeze({ status: 'loaded', chats })
    return phase === 'failed' ? Object.freeze({ status: 'failed', retry }) : LOADING
  }, [phase, chats, retry])
}

/** chat.ts:410 over hooks/use-recent-chats.ts:36: the latest conversations (none until loaded) and the one on screen. */
export const useRecentChats: Sdk['useRecentChats'] = (limit = RECENT_CHATS_LIMIT) => {
  const list = useConversationList(limit)
  const activeChatId = useActiveChatId()
  const chats = list.status === 'loaded' ? list.chats : NO_CHATS
  return useMemo(() => Object.freeze({ chats, activeChatId }), [chats, activeChatId])
}

/** chat.ts:415 over hooks/use-start-chat.ts: a fresh new chat on screen, then the chat page; always ready. */
export const useStartChat: Sdk['useStartChat'] = () => {
  const router = useHostRouter()
  const startChat = useCallback(() => {
    startFreshChat()
    router.push(CHAT_HREF)
  }, [router])
  return useMemo(() => Object.freeze({ startChat, ready: true }), [startChat])
}

// ---- the receipts (chat.ts:420-460 over lib/chat/receipts.ts) ----

/** receipts.ts:63: "#0422: moved to Done"; a call that did nothing names what it was for, never an effect. */
export const receiptLine: Sdk['receiptLine'] = (receipt: HostReceipt) => {
  if (receipt.status === 'done') return [receipt.subject, receipt.effect].filter(Boolean).join(': ')
  if (receipt.status === 'waiting') return `${receipt.effect || receipt.subject} — ${WAITING_SUFFIX}`
  const prefix = receipt.status === 'refused' ? REFUSED_PREFIX : SKIPPED_PREFIX
  const what = receipt.subject || receipt.effect
  return `${what ? `${what}: ` : ''}${prefix}: ${receipt.reason || NO_REASON}`
}

/** internal/href.ts: a path inside the app, with no control character, whitespace or backslash. */
function isInternalHref(href: string): boolean {
  return INTERNAL_HREF.test(href) && !UNSAFE_CHAR.test(href) && !href.includes(BACKSLASH)
}

/** chat.ts:426 over receipts.ts:77: a done receipt's page, only when it is a path in this app; else null. */
export const receiptLink: Sdk['receiptLink'] = (receipt) => {
  const link = receipt.status === 'done' ? receipt.link : null
  const safe = link && link.startsWith('/') && !link.startsWith('//') ? link : null
  return safe !== null && isInternalHref(safe) ? safe : null
}

/** chat.ts:432 over receipts.ts:72: whether a done write touched a card on the board (named by its number). */
export const movedSomethingOnTheBoard: Sdk['movedSomethingOnTheBoard'] = (receipts) =>
  receipts.some((receipt) => receipt.kind === 'write' && receipt.status === 'done' && CARD_NUMBER.test(receipt.subject))

/** chat.ts:448: the turn's receipts on one of onData's parts, as the reply will carry them; null for any other part. */
export const liveReceiptsOf: Sdk['liveReceiptsOf'] = (part) => liveReceiptsIn(part)

// ---- the controls (gathered by src/host.ts) ----

/** The controls of this area, gathered by host.ts: the scripted backend, and what the chat asked of it. */
export const chatControls = Object.freeze({
  setChatScript,
  continueHeldTurn,
  setConversations,
  setAiLabelShown,
  setChatOpening,
  setTurnEnding,
  setPlanningMissionId,
  startedChats,
  chatSent,
  turnsLeft,
  recordedTurns,
  scriptOf,
  conversationsOf,
  conversationsAsked,
})

/**
 * The chat as a test starts with it: no turns and none held open, no conversations, nothing sent, no list load kept,
 * the AI label on screen, the screen not opening, no turn ending and no Mission being planned.
 */
export function resetChat(): void {
  resetChatScript()
}

export type {
  ConversationFixture, ConversationInput, ConversationsAsk, HistoryMessage, RecordedFrame, RecordedTurn, RecordedTurns, SentWords,
} from '../internal/scripted/chat-script.ts'
