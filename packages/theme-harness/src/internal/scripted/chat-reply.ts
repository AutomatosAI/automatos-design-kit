/**
 * PRD-261 B-02c: one reply of the fake chat, and what each recorded frame does to it. Not an SDK name. Pure.
 *
 * Mirrors how core's frontend/lib/chat/hooks.ts (101a0bf33f64fb4f89af81b4293415be60b661ac) reads the stream:
 * a '0:' text line adds its words (:288); a 'd:' data line of type tool-start or tool-end writes the call's
 * line (:309-337), tool-data a task card (:366) and the receipts frame (lib/chat/receipts.ts), reasoning
 * grows the thinking (:412), progress adds an activity line (:441), finish closes every running call (:450),
 * withdraw_offer and limit_reached put their card and words on the reply (:462-480); an 'e:' line is the
 * reply's failure in words (:549, lib/chat/errors.ts). The data parts it hands a theme's onData are the ones
 * hooks.ts forwards. Not read here: narration's retraction of streamed words, routing headers, and a receipt
 * link to a Deliverable given as an absolute URL (only an app path names one here).
 */
import type {
  HostChatError,
  HostChatRole,
  HostDeliverable,
  HostLiveReceipts,
  HostMissionSuggestion,
  HostReceipt,
  HostTaskCard,
  HostToolCall,
  WithdrawOffer,
} from '@automatos/theme-sdk'
import type { RecordedFrame } from './chat-script.ts'

/** A message as the fake keeps it; src/sdk/chat.ts copies it into the SDK's HostChatMessage. */
export interface ReplyRecord {
  readonly id: string
  readonly role: HostChatRole
  readonly text: string
  readonly activity: readonly string[]
  readonly error: HostChatError | null
  readonly receipts: readonly HostReceipt[] | null
  readonly above: readonly string[]
  readonly deliverables: readonly HostDeliverable[]
  readonly taskCards: readonly HostTaskCard[]
  readonly toolCalls: readonly HostToolCall[]
  readonly reasoningChars: number
  readonly withdrawOffer: WithdrawOffer | null
  readonly limitReached: string | null
}

type Fields = Readonly<Record<string, unknown>>
type Effect = (reply: ReplyRecord, data: Fields) => ReplyRecord

/** lib/chat/receipts.ts:23 and :84: a receipt's statuses, and the tool-data key of the receipts frame. */
const RECEIPT_STATUSES: ReadonlySet<string> = new Set(['done', 'refused', 'skipped', 'waiting'])
export const LIVE_KEY = 'receipts'
/** lib/chat/deliverables.ts:44-49: the document tool's key, and how its format names a kind. */
const GENERATED_DOCUMENT = 'generated_document'
const IMAGE_FORMATS: ReadonlySet<string> = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'])
const VIDEO_FORMATS: ReadonlySet<string> = new Set(['mp4', 'webm', 'mov'])
const DELIVERABLE_ID = /^[A-Za-z0-9_-]{1,128}$/
export const UNTITLED = 'Your Deliverable'
/** lib/chat/errors.ts:11: a failure frame without words. */
export const FALLBACK_TURN_ERROR = 'The reply failed. Try again.'
/** hooks.ts:314: a call the stream does not name. */
const UNNAMED_TOOL = 'tool'
/** hooks.ts: the data types forwarded to onData as they are, and usage under its own name. */
const FORWARDED: ReadonlySet<string> = new Set(['tool-start', 'tool-end', 'tool-data', 'mission-suggestion', 'memory-injected', 'memory-stored', 'workflow-update'])
const USAGE = 'usage'
const AGENT_INFO = 'agent-info'
const USAGE_PART = 'data-usage'
const NO_LINES: readonly string[] = Object.freeze([])
const NO_FIELDS: Fields = Object.freeze({})

export function fieldsOf(value: unknown): Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Fields) : NO_FIELDS
}

const textOf = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

/** A message with nothing on it yet. */
export function replyRecord(id: string, role: HostChatRole, text = ''): ReplyRecord {
  return Object.freeze({
    id, role, text, activity: NO_LINES, error: null, receipts: null, above: NO_LINES, deliverables: Object.freeze([]),
    taskCards: Object.freeze([]), toolCalls: Object.freeze([]), reasoningChars: 0, withdrawOffer: null, limitReached: null,
  })
}

function isReceipt(value: unknown): value is HostReceipt {
  const { action, status } = fieldsOf(value)
  return typeof action === 'string' && typeof status === 'string' && RECEIPT_STATUSES.has(status)
}

/** chat.ts:448 over receipts.ts:35-91: the receipts frame on a tool-data part; null for any other part. */
export function liveReceiptsIn(part: unknown): HostLiveReceipts | null {
  const forwarded = fieldsOf(part)
  const frame = forwarded.type === 'tool-data' ? fieldsOf(fieldsOf(forwarded.data)[LIVE_KEY]) : NO_FIELDS
  const { receipts: list, above, model } = frame
  if (!Array.isArray(list)) return null
  const lines = Array.isArray(above) ? above.filter((line): line is string => typeof line === 'string' && line.trim() !== '') : []
  return Object.freeze({
    receipts: Object.freeze(list.filter(isReceipt)),
    above: lines.length > 0 ? Object.freeze(lines) : NO_LINES,
    model: typeof model === 'string' ? model : null,
  })
}

function kindOfFormat(format: string | undefined): HostDeliverable['kind'] {
  const lower = (format ?? '').toLowerCase()
  if (IMAGE_FORMATS.has(lower)) return 'image'
  return VIDEO_FORMATS.has(lower) ? 'video' : 'document'
}

/** lib/chat/deliverables.ts:94: the Deliverable a tool-data part's data made, or null. */
function madeDeliverable(data: Fields): HostDeliverable | null {
  const made = fieldsOf(data[GENERATED_DOCUMENT])
  const raw = made.deliverable_id
  const id = typeof raw === 'number' && Number.isSafeInteger(raw) ? String(raw) : textOf(raw)
  if (id === undefined || !DELIVERABLE_ID.test(id)) return null
  const title = textOf(made.title)?.trim() || textOf(made.filename)?.trim() || UNTITLED
  return Object.freeze({ id, title, kind: kindOfFormat(textOf(made.format)) })
}

/** lib/chat/deliverables.ts:126: the Deliverable id a done receipt's link names (/deliverables/<id> or ?deliverable=<id>). */
function linkedId(link: string | null): string | null {
  if (link === null || !link.startsWith('/') || link.startsWith('//')) return null
  const [path, query = ''] = link.split('?')
  const page = /^\/deliverables\/([^/]+)\/?$/.exec(path ?? '')?.[1]
  const id = page ?? (/^\/deliverables\/?$/.test(path ?? '') ? new URLSearchParams(query).get('deliverable') : null)
  return id && DELIVERABLE_ID.test(id) ? id : null
}

/** lib/chat/deliverables.ts:141: the Deliverables the done receipts link to. */
export function deliverablesFromReceipts(receipts: readonly HostReceipt[] | null): readonly HostDeliverable[] {
  return Object.freeze(
    (receipts ?? []).flatMap((receipt) => {
      const id = receipt.status === 'done' ? linkedId(receipt.link) : null
      return id ? [Object.freeze({ id, title: receipt.subject.trim() || UNTITLED, kind: 'document' as const })] : []
    }),
  )
}

/** lib/chat/deliverables.ts:153: the Deliverables one forwarded part announces. */
export function deliverablesInPart(part: unknown): readonly HostDeliverable[] {
  const forwarded = fieldsOf(part)
  if (forwarded.type !== 'tool-data') return []
  const made = madeDeliverable(fieldsOf(forwarded.data))
  const linked = deliverablesFromReceipts(liveReceiptsIn(part)?.receipts ?? null)
  return made === null ? linked : [made, ...linked]
}

/** lib/chat/deliverables.ts:166: `known` with the new ones after it, one per id. Never mutates. */
export function mergeDeliverables(known: readonly HostDeliverable[], found: readonly HostDeliverable[]): readonly HostDeliverable[] {
  const fresh = found.filter((ref, index) => !known.some((seen) => seen.id === ref.id) && found.findIndex((other) => other.id === ref.id) === index)
  return fresh.length > 0 ? Object.freeze([...known, ...fresh]) : known
}

function agentIdOf(value: unknown): number | string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return typeof value === 'string' && value ? value : undefined
}

/** lib/chat/suggestion.ts:31: the Mission a mission-suggestion part offers (a goal in words), or null. */
export function suggestionInPart(part: unknown): HostMissionSuggestion | null {
  const forwarded = fieldsOf(part)
  const data = fieldsOf(forwarded.data)
  const goal = textOf(data.goal)?.trim() ?? ''
  if (forwarded.type !== 'mission-suggestion' || !goal) return null
  const complexity = textOf(data.complexity) ?? ''
  const agentId = agentIdOf(data.agent_id)
  return Object.freeze(agentId === undefined ? { goal, complexity } : { goal, complexity, agentId })
}

/** The part hooks.ts hands onData for a data line, or null for a line it keeps to itself. */
export function forwardedPart(line: unknown): unknown {
  const fields = fieldsOf(line)
  const type = textOf(fields.type)
  if (type === AGENT_INFO) return fields.agent ? { type, data: fields.agent } : null
  if (type === undefined || !fields.data) return null
  if (FORWARDED.has(type)) return { type, data: fields.data }
  return type === USAGE ? { type: USAGE_PART, data: fields.data } : null
}

/** lib/chat/errors.ts:13: an error line's words and code. */
export function turnErrorOf(value: unknown): HostChatError {
  if (typeof value === 'string') return Object.freeze({ message: value || FALLBACK_TURN_ERROR, code: null })
  const fields = fieldsOf(value)
  const message = textOf(fields.message) ?? textOf(fields.error)
  const code = textOf(fields.code) ?? textOf(fields.error_code) ?? null
  return Object.freeze({ message: message || FALLBACK_TURN_ERROR, code })
}

function upsertCall(reply: ReplyRecord, call: HostToolCall): ReplyRecord {
  const known = reply.toolCalls.some((line) => line.toolCallId === call.toolCallId)
  const toolCalls = known
    ? reply.toolCalls.map((line) => (line.toolCallId === call.toolCallId ? Object.freeze({ ...line, ...call, input: line.input ?? call.input }) : line))
    : [...reply.toolCalls, Object.freeze(call)]
  return { ...reply, toolCalls: Object.freeze(toolCalls) }
}

const startCall: Effect = (reply, data) => {
  const toolCallId = textOf(data.toolCallId)
  if (toolCallId === undefined) return reply
  return upsertCall(reply, { toolCallId, toolName: textOf(data.toolName) || UNNAMED_TOOL, state: 'running', input: data.input, skipped: false, waiting: false })
}

/** hooks.ts:339 and lib/chat/tool-calls.ts:46: an ended call; one that waits on its card ended, never failed. */
const endCall: Effect = (reply, data) => {
  const toolCallId = textOf(data.toolCallId)
  if (toolCallId === undefined) return reply
  const skipped = data.skipped === true
  const waiting = data.waiting === true
  const state = data.success === true || skipped || waiting ? 'completed' : 'error'
  const durationMs = typeof data.durationMs === 'number' ? data.durationMs : undefined
  const call: HostToolCall = {
    toolCallId, toolName: textOf(data.toolName) || UNNAMED_TOOL, state, error: textOf(data.error), durationMs, summary: textOf(data.summary), skipped, waiting,
  }
  return upsertCall(reply, call)
}

function taskCardOf(value: unknown): HostTaskCard | null {
  const card = fieldsOf(value)
  const { id, title, status, assigned_agent: agent } = card
  if (typeof id !== 'number' || typeof title !== 'string' || typeof status !== 'string' || typeof agent !== 'string') return null
  return Object.freeze({ ...(card as unknown as HostTaskCard) })
}

/** hooks.ts:377 (upsertTaskCard): one card per ticket id, a newer copy in the older one's place. */
function withTaskCard(cards: readonly HostTaskCard[], card: HostTaskCard): readonly HostTaskCard[] {
  const known = cards.some((other) => other.id === card.id)
  return Object.freeze(known ? cards.map((other) => (other.id === card.id ? card : other)) : [...cards, card])
}

/** hooks.ts:366 and receipts.ts:49: a tool-data part's task card, receipts and the Deliverable it made. */
const toolData: Effect = (reply, data) => {
  const card = taskCardOf(data.task_card)
  const live = liveReceiptsIn({ type: 'tool-data', data })
  const taskCards = card === null ? reply.taskCards : withTaskCard(reply.taskCards, card)
  const receipts = live === null ? {} : { receipts: live.receipts, above: live.above }
  const deliverables = mergeDeliverables(reply.deliverables, deliverablesInPart({ type: 'tool-data', data }))
  return { ...reply, taskCards, deliverables, ...receipts }
}

const finishCalls: Effect = (reply) => ({
  ...reply,
  toolCalls: Object.freeze(reply.toolCalls.map((call) => (call.state === 'running' ? Object.freeze({ ...call, state: 'completed' as const }) : call))),
})

function withdrawOfferOf(data: Fields): WithdrawOffer | null {
  if (!Array.isArray(data.requests)) return null
  const requests = data.requests.flatMap((request: unknown) => {
    const fields = fieldsOf(request)
    return typeof fields.grant_id === 'number'
      ? [Object.freeze({ grant_id: fields.grant_id, action: textOf(fields.action) ?? null, reason: textOf(fields.reason) ?? null })]
      : []
  })
  return Object.freeze({ message: String(data.message ?? ''), requests: Object.freeze(requests) })
}

const thinking: Effect = (reply, data) =>
  typeof data.delta === 'string' ? { ...reply, reasoningChars: reply.reasoningChars + data.delta.length } : reply

const progress: Effect = (reply, data) =>
  typeof data.text === 'string' ? { ...reply, activity: Object.freeze([...reply.activity, data.text]) } : reply

const withdrawOffer: Effect = (reply, data) => ({ ...reply, withdrawOffer: withdrawOfferOf(data) ?? reply.withdrawOffer })

const limitReached: Effect = (reply, data) => (data.message ? { ...reply, limitReached: String(data.message) } : reply)

/** What each data line's type does to the reply; a type not named here leaves it as it is. */
const EFFECTS: Readonly<Record<string, Effect>> = {
  'tool-start': startCall,
  'tool-end': endCall,
  'tool-data': toolData,
  reasoning: thinking,
  progress,
  finish: finishCalls,
  withdraw_offer: withdrawOffer,
  limit_reached: limitReached,
}

/** The reply with one more frame read into it. Never mutates. */
export function withFrame(reply: ReplyRecord, frame: RecordedFrame): ReplyRecord {
  if ('text' in frame) return Object.freeze({ ...reply, text: reply.text + frame.text })
  if ('error' in frame) return Object.freeze({ ...reply, error: turnErrorOf(frame.error) })
  const line = fieldsOf(frame.data)
  const type = textOf(line.type)
  const effect = type !== undefined && Object.prototype.hasOwnProperty.call(EFFECTS, type) ? EFFECTS[type] : undefined
  return effect === undefined ? reply : Object.freeze(effect(reply, fieldsOf(line.data)))
}
