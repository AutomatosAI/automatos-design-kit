/**
 * PRD-261 B-02c: the scripted backend behind the fake chat area (src/sdk/chat.ts). Not an SDK name.
 *
 * A test scripts the chat's answers as core's Playwright specs do (e2e/browser/support/play-chat.ts, core
 * 101a0bf33f64fb4f89af81b4293415be60b661ac): every Send or Try again takes the next recorded turn, in order, in
 * the format of core's e2e/browser/fixtures/play-parity/chat-turns.json (this package's fixtures/streams/*.json).
 * A send with no turn left is answered as a refused request (status 500), as a request nothing answers fails.
 * A turn recorded with hold: true stays open until Stop, or until a test goes on with it (continueHeldTurn: more
 * frames, then its end, as core's stream arrives in parts). It also holds the conversations the lists show, New
 * chat presses, whether the host's AI label is on screen, whether the screen is still opening its conversation,
 * whether a turn is still ending, the Mission being planned, and the words every send carried and every load of a
 * conversation list, for a test to read back. resetChatScript puts each one back.
 */
import type { HostChatRole, HostChatSummary } from '@automatos/theme-sdk'
import { cell, log } from '../cell.ts'

/**
 * One recorded frame: a '0:' text line ({ text }) or a 'd:' data line ({ data }), as core's chat-turns.json
 * holds them, or (the harness's addition, so a turn can fail in words) an 'e:' error line ({ error }).
 */
export type RecordedFrame =
  | { readonly text: string }
  | { readonly data: unknown }
  | { readonly error: unknown }

/** One recorded answer to POST /api/chat (core e2e/browser/support/play-chat.ts:24 RecordedTurn). */
export interface RecordedTurn {
  readonly frames: readonly RecordedFrame[]
  /** Keep the stream open after the frames until Stop. */
  readonly hold?: boolean
  /** The response's status; absent is 200 with the stream. */
  readonly status?: number
  /** A refused response's body (the harness's addition); absent, core's REFUSED_BODY. */
  readonly body?: string
}

/** A fixture file of recorded turns, by name (core e2e/browser/support/play-chat.ts:30 PlayTurns). */
export interface RecordedTurns {
  readonly chatId: string
  readonly turns: Readonly<Record<string, RecordedTurn>>
}

/** One message of a conversation the backend already holds. */
export interface HistoryMessage {
  readonly role: HostChatRole
  readonly text: string
  /** Who wrote a reply the turn didn't ("Auto · background"), as the stored row names it; absent for a reply of the turn. */
  readonly provenance?: string
  /** A failed turn the server saved, in its words: the reply is that failure, never an answer. */
  readonly savedError?: string
  /**
   * What the reply's turn streamed beside its words, in the recorded stream's format (its tool calls, the receipts, a
   * generated document), read onto the stored reply as the stream reads them, as core's stored message keeps its
   * tool calls, receipts and documents (types/chat.ts ChatMessage); absent for none.
   */
  readonly frames?: readonly RecordedFrame[]
}

/** A conversation as the lists show it, and the messages it opens with. */
export interface ConversationFixture extends HostChatSummary {
  readonly messages: readonly HistoryMessage[]
}

/** What setConversations takes: a summary, its messages optional. */
export type ConversationInput = HostChatSummary & { readonly messages?: readonly HistoryMessage[] }

/** What one Send or Try again carried. */
export interface SentWords {
  /** The conversation it went to; null for a new chat the backend had not named. */
  readonly chatId: string | null
  readonly text: string
  /** Try again, not Send. */
  readonly retry: boolean
}

/** One load of a conversation list (useConversationList, useRecentChats): how many it asked the backend for. */
export interface ConversationsAsk {
  readonly limit: number
}

/** The status a recorded turn streams with. */
export const STREAM_STATUS = 200
/** core e2e/browser/support/chat-stream.ts:75: what a refused request answers. */
export const REFUSED_BODY = 'The chat request was refused.'
/** The answer to a send with no recorded turn left. */
export const UNSCRIPTED_TURN: RecordedTurn = Object.freeze({ frames: Object.freeze([]), status: 500 })

const ROLES: ReadonlySet<string> = new Set(['system', 'user', 'assistant'])
const NO_TURNS: readonly RecordedTurn[] = Object.freeze([])
const NO_CONVERSATIONS: readonly ConversationFixture[] = Object.freeze([])
const NO_MESSAGES: readonly HistoryMessage[] = Object.freeze([])

type Fields = Readonly<Record<string, unknown>>

function fieldsOf(value: unknown, where: string): Fields {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${where} is not an object.`)
  return value as Fields
}

function listOf(value: unknown, where: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${where} is not a list.`)
  return value
}

function textOf(value: unknown, where: string): string {
  if (typeof value !== 'string') throw new TypeError(`${where} is not a string.`)
  return value
}

function frameOf(value: unknown, where: string): RecordedFrame {
  const fields = fieldsOf(value, where)
  if (typeof fields.text === 'string') return Object.freeze({ text: fields.text })
  if ('data' in fields) return Object.freeze({ data: fields.data })
  if ('error' in fields) return Object.freeze({ error: fields.error })
  throw new TypeError(`${where} is neither a text, a data nor an error frame.`)
}

/** One recorded turn read off a fixture, every field checked. */
export function recordedTurn(value: unknown, where = 'turn'): RecordedTurn {
  const fields = fieldsOf(value, where)
  const frames = listOf(fields.frames, `${where}.frames`).map((frame, index) => frameOf(frame, `${where}.frames[${index}]`))
  const { hold, status, body } = fields
  if (hold !== undefined && typeof hold !== 'boolean') throw new TypeError(`${where}.hold is not a boolean.`)
  if (status !== undefined && !Number.isInteger(status)) throw new TypeError(`${where}.status is not a whole number.`)
  if (body !== undefined && typeof body !== 'string') throw new TypeError(`${where}.body is not a string.`)
  return Object.freeze({
    frames: Object.freeze(frames),
    ...(hold === undefined ? {} : { hold }),
    ...(status === undefined ? {} : { status: status as number }),
    ...(body === undefined ? {} : { body }),
  })
}

/** A fixture file of recorded turns (fixtures/streams/*.json), every turn checked. */
export function recordedTurns(json: unknown, where = 'recorded turns'): RecordedTurns {
  const fields = fieldsOf(json, where)
  const turns = fieldsOf(fields.turns, `${where}.turns`)
  const checked = Object.keys(turns).map((name) => [name, recordedTurn(turns[name], `${where}.turns.${name}`)] as const)
  return Object.freeze({ chatId: textOf(fields.chatId, `${where}.chatId`), turns: Object.freeze(Object.fromEntries(checked)) })
}

/** The named turns, in order, for setChatScript; a name the file doesn't hold throws. */
export function scriptOf(recorded: RecordedTurns, names: readonly string[]): readonly RecordedTurn[] {
  return Object.freeze(
    names.map((name) => {
      const turn = Object.prototype.hasOwnProperty.call(recorded.turns, name) ? recorded.turns[name] : undefined
      if (turn === undefined) throw new TypeError(`The recorded turns hold no turn named "${name}".`)
      return turn
    }),
  )
}

/** A stored row's optional words: absent (or null) is none. */
function optionalTextOf(value: unknown, where: string): string | undefined {
  return value === undefined || value === null ? undefined : textOf(value, where)
}

/** A stored reply's frames, each checked; undefined when the row has none. */
function storedFramesOf(value: unknown, where: string): readonly RecordedFrame[] | undefined {
  if (value === undefined) return undefined
  return Object.freeze(listOf(value, where).map((frame, index) => frameOf(frame, `${where}[${index}]`)))
}

function historyOf(value: unknown, where: string): HistoryMessage {
  const fields = fieldsOf(value, where)
  const role = textOf(fields.role, `${where}.role`)
  if (!ROLES.has(role)) throw new TypeError(`${where}.role is not a chat role.`)
  const provenance = optionalTextOf(fields.provenance, `${where}.provenance`)
  const savedError = optionalTextOf(fields.savedError, `${where}.savedError`)
  const frames = storedFramesOf(fields.frames, `${where}.frames`)
  return Object.freeze({
    role: role as HostChatRole,
    text: textOf(fields.text, `${where}.text`),
    ...(provenance === undefined ? {} : { provenance }),
    ...(savedError === undefined ? {} : { savedError }),
    ...(frames === undefined ? {} : { frames }),
  })
}

function previewOf(value: unknown, where: string): string | null {
  if (value === null) return null
  return textOf(value, where)
}

function conversationOf(value: unknown, where: string): ConversationFixture {
  const fields = fieldsOf(value, where)
  const messages: readonly unknown[] = fields.messages === undefined ? NO_MESSAGES : listOf(fields.messages, `${where}.messages`)
  return Object.freeze({
    id: textOf(fields.id, `${where}.id`),
    title: textOf(fields.title, `${where}.title`),
    updatedAt: textOf(fields.updatedAt, `${where}.updatedAt`),
    preview: previewOf(fields.preview, `${where}.preview`),
    messages: Object.freeze(messages.map((message, index) => historyOf(message, `${where}.messages[${index}]`))),
  })
}

/** A fixture file of conversations (fixtures/conversations/*.json), every field checked. */
export function conversationsOf(json: unknown, where = 'conversations'): readonly ConversationFixture[] {
  return Object.freeze(listOf(json, where).map((value, index) => conversationOf(value, `${where}[${index}]`)))
}

const script = cell<readonly RecordedTurn[]>(NO_TURNS)
const sent = log<SentWords>()
const conversations = cell<readonly ConversationFixture[]>(NO_CONVERSATIONS)
const freshChats = cell(0)
const activeChat = cell<string | null>(null)
const aiLabel = cell(true)
const listAsks = log<ConversationsAsk>()
const opening = cell(false)
const ending = cell(false)
const planningMission = cell<string | null>(null)
/** How the turn held open now goes on; null while no turn is held open. */
let resumeHeld: ((next: RecordedTurn) => void) | null = null
/** What a test went on with before any turn held (its frames still on their way): the next turn to hold takes it. */
let queuedContinuation: RecordedTurn | null = null

/** The turns the next sends get, in order (each Send or Try again takes one). */
export function setChatScript(turns: readonly RecordedTurn[]): void {
  script.set(Object.freeze([...turns]))
}

/**
 * A held turn's stream waits here (chat-turn.ts): `resume` gets what continueHeldTurn gives, at once when a test
 * already went on. The returned function lets go (Stop, an unmount), unless a newer turn holds by then.
 */
export function holdTurn(resume: (next: RecordedTurn) => void): () => void {
  const queued = queuedContinuation
  if (queued !== null) {
    queuedContinuation = null
    resume(queued)
    return () => undefined
  }
  resumeHeld = resume
  return () => {
    if (resumeHeld === resume) resumeHeld = null
  }
}

/**
 * The turn held open now goes on, as core's stream goes on after a pause: `next.frames`, a frame per tick, then
 * the stream ends, or holds again when `next.hold` is true. Its status and body are not read. While no turn holds
 * yet (a held turn holds a tick after its last frame), the next turn to hold goes on with it; a second one before
 * then throws.
 */
export function continueHeldTurn(next: RecordedTurn): void {
  const checked = recordedTurn(next, 'continueHeldTurn')
  const resume = resumeHeld
  if (resume !== null) {
    resumeHeld = null
    resume(checked)
    return
  }
  if (queuedContinuation !== null) throw new TypeError('No chat turn has held since the last continueHeldTurn: one is already waiting.')
  queuedContinuation = checked
}

/** The next recorded turn, taken off the script; UNSCRIPTED_TURN when none is left. */
export function takeTurn(): RecordedTurn {
  const [next, ...rest] = script.get()
  script.set(Object.freeze(rest))
  return next ?? UNSCRIPTED_TURN
}

/** How many recorded turns no send has taken yet. */
export function turnsLeft(): number {
  return script.get().length
}

export function recordSent(words: SentWords): void {
  sent.add(Object.freeze({ ...words }))
}

/** Every Send and Try again since the last reset, oldest first. */
export function chatSent(): readonly SentWords[] {
  return sent.all()
}

export function recordConversationsAsk(ask: ConversationsAsk): void {
  listAsks.add(Object.freeze({ ...ask }))
}

/** Every load of a conversation list since the last reset, oldest first: what core's getChatHistory was asked. */
export function conversationsAsked(): readonly ConversationsAsk[] {
  return listAsks.all()
}

/** The conversations the backend holds from now on, as useConversationList and useRecentChats show them. */
export function setConversations(list: readonly ConversationInput[]): void {
  conversations.set(Object.freeze(list.map((entry) => Object.freeze({ ...entry, messages: Object.freeze([...(entry.messages ?? NO_MESSAGES)]) }))))
}

export function useConversations(): readonly ConversationFixture[] {
  return conversations.use()
}

/** New chat: a fresh new chat on screen. */
export function startFreshChat(): void {
  freshChats.set(freshChats.get() + 1)
}

export function useFreshChats(): number {
  return freshChats.use()
}

/** How many times New chat was pressed since the last reset. */
export function startedChats(): number {
  return freshChats.get()
}

/** The conversation the chat shows now (null for a new chat), for useRecentChats. */
export function setActiveChatId(chatId: string | null): void {
  if (activeChat.get() !== chatId) activeChat.set(chatId)
}

export function useActiveChatId(): string | null {
  return activeChat.use()
}

/** The conversation on screen right now (null for a new chat), where a voice session starts (voice-session.ts). */
export function activeChatId(): string | null {
  return activeChat.get()
}

/** Whether the host's AI label is on screen from now on (PRD-264 EUAI-11b): Send and Try again refuse while not. */
export function setAiLabelShown(shown: boolean): void {
  aiLabel.set(shown)
}

/** The label right now, as Send and Try again ask it at the moment they are called. */
export function aiLabelShown(): boolean {
  return aiLabel.get()
}

export function useAiLabelShown(): boolean {
  return aiLabel.use()
}

/** Whether the chat screen is still opening its conversation from now on (the session, a link or a load settling). */
export function setChatOpening(isOpening: boolean): void {
  opening.set(isOpening)
}

export function useChatOpening(): boolean {
  return opening.use()
}

/**
 * Whether a turn is still ending from now on, as core's chat hook is still loading after its stream closed: the
 * status is not streaming, yet Send and Try again start nothing.
 */
export function setTurnEnding(isEnding: boolean): void {
  ending.set(isEnding)
}

/** The flag right now, as Send and Try again ask it at the moment they are called. */
export function turnEnding(): boolean {
  return ending.get()
}

/** The Mission the chat is planning from now on (core's Mission store); null for none. */
export function setPlanningMissionId(missionId: string | null): void {
  planningMission.set(missionId)
}

export function usePlanningMissionId(): string | null {
  return planningMission.use()
}

/** The chat's backend as a test starts with it: no turns, no conversations, nothing sent, the label shown. */
export function resetChatScript(): void {
  script.set(NO_TURNS)
  sent.clear()
  conversations.set(NO_CONVERSATIONS)
  freshChats.set(0)
  activeChat.set(null)
  aiLabel.set(true)
  listAsks.clear()
  opening.set(false)
  ending.set(false)
  planningMission.set(null)
  resumeHeld = null
  queuedContinuation = null
}
