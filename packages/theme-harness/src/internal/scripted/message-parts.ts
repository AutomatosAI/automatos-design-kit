/**
 * PRD-268 K17 (SDK 1.4.0): a message's parts as the fake chat hands them to a theme (HostChatMessage.knownParts,
 * src/sdk/chat.ts). Not an SDK name. Pure.
 *
 * Mirrors core's frontend/lib/theme-sdk/internal/message-parts.ts (at d92cabf202f4a04f48a429d5f79a05cbe6c1eefb): the
 * parts a theme can read are `text` (the words, on any message), `brief@1` (the day's brief, read as the host's thread
 * reads one: internal/proactive/wire.ts briefOf), `suggestion@1` (a suggestion's id: the part's own, else the stored
 * message's `source.suggestion_id`) and `reply_chips@1` (the chips the host's ReplyChips would draw: trimmed, at most
 * 24 characters, no repeats, the first three, less any that reads as a slash command, and the part only while two or
 * more remain). brief@1, suggestion@1 and reply_chips@1 count only on Auto's messages. A part of any other type, or
 * one that isn't what its type says, is left out, never thrown on; the rest keep the message's order. Everything
 * handed back is a frozen copy.
 *
 * The raw parts are the ones core's chat controller holds (lib/chat/hooks.ts): a stored message's own (a conversation
 * fixture's `parts`), else one text part of its words; a message the turn sends or streams carries one text part of
 * its words once it has any. So a live reply's brief, suggestion and chip parts reach a theme only once its
 * conversation opens again as a stored one, as in core until its chat streams them.
 */
import type { HostBriefPart, HostChatRole, HostMessagePart, HostReplyChipsPart, HostSuggestionPart, HostTextPart } from '@automatos/theme-sdk'
import { REPLY_CHIPS_MIN, replyChipsOf } from '../../sdk/cards/reply-chips.tsx'
import { frozenCopy } from '../page-views.ts'
import { briefOf, isProactiveId, recordOf } from '../proactive/wire.ts'

type Fields = Readonly<Record<string, unknown>>

/** A stored message's raw parts, and its source (a suggestion's post may name the suggestion there). */
export interface StoredParts {
  readonly parts: readonly unknown[]
  readonly source: unknown
}

interface PartReader {
  readonly read: (part: Fields, source: unknown) => HostMessagePart | null
  /** Only Auto's messages carry it, as the host draws it. */
  readonly assistantOnly: boolean
}

/** chat.d.ts HostMessagePart's types (lib/proactive/types.ts BRIEF_PART, SUGGESTION_PART; turn_parts.py REPLY_CHIPS_PART). */
export const TEXT_PART: HostTextPart['type'] = 'text'
export const BRIEF_PART: HostBriefPart['type'] = 'brief@1'
export const SUGGESTION_PART: HostSuggestionPart['type'] = 'suggestion@1'
export const REPLY_CHIPS_PART: HostReplyChipsPart['type'] = 'reply_chips@1'
/** The composer runs a message that starts with this as a command: a chip never does. */
const SLASH_COMMAND = '/'
const ASSISTANT: HostChatRole = 'assistant'
const NO_PARTS: readonly HostMessagePart[] = Object.freeze([])

function textPart(part: Fields): HostTextPart | null {
  const { text } = part
  return typeof text === 'string' ? Object.freeze<HostTextPart>({ type: TEXT_PART, text }) : null
}

function briefPart(part: Fields): HostBriefPart | null {
  const brief = briefOf(part.brief)
  return brief === null ? null : Object.freeze<HostBriefPart>({ type: BRIEF_PART, brief: frozenCopy(brief) })
}

function suggestionPart(part: Fields, source: unknown): HostSuggestionPart | null {
  const own = part.suggestion_id
  const id = isProactiveId(own) ? own : recordOf(source)?.suggestion_id
  return isProactiveId(id) ? Object.freeze<HostSuggestionPart>({ type: SUGGESTION_PART, suggestion_id: id }) : null
}

function replyChipsPart(part: Fields): HostReplyChipsPart | null {
  const { replies } = part
  if (!Array.isArray(replies) || !replies.every((reply): reply is string => typeof reply === 'string')) return null
  const chips = replyChipsOf(replies.filter((reply) => !reply.trim().startsWith(SLASH_COMMAND)))
  if (chips.length < REPLY_CHIPS_MIN) return null
  return Object.freeze<HostReplyChipsPart>({ type: REPLY_CHIPS_PART, replies: Object.freeze([...chips]) })
}

/** The reader of each part type a theme may read. */
const READERS: ReadonlyMap<string, PartReader> = new Map<string, PartReader>([
  [TEXT_PART, { read: textPart, assistantOnly: false }],
  [BRIEF_PART, { read: briefPart, assistantOnly: true }],
  [SUGGESTION_PART, { read: suggestionPart, assistantOnly: true }],
  [REPLY_CHIPS_PART, { read: replyChipsPart, assistantOnly: true }],
])

/** One part as a theme reads it, or null when its type is unknown, not this message's to carry, or it is malformed. */
function knownPart(value: unknown, assistant: boolean, source: unknown): HostMessagePart | null {
  const part = recordOf(value)
  const type = part?.type
  const reader = typeof type === 'string' ? READERS.get(type) : undefined
  if (part === null || reader === undefined || (reader.assistantOnly && !assistant)) return null
  return reader.read(part, source)
}

/** message-parts.ts hostParts: a message's raw parts of the types a theme can read, checked and frozen, in order. */
export function knownPartsOf(role: HostChatRole, parts: unknown, source: unknown = null): readonly HostMessagePart[] {
  const list: readonly unknown[] = Array.isArray(parts) ? parts : []
  if (list.length === 0) return NO_PARTS
  const assistant = role === ASSISTANT
  return Object.freeze(list.map((part) => knownPart(part, assistant, source)).filter((part): part is HostMessagePart => part !== null))
}

/** The raw parts core's controller holds for a message: a stored one's own, else one text part of its words, once it has any. */
export function rawPartsOf(text: string, stored: StoredParts | null): readonly unknown[] {
  if (stored !== null) return stored.parts
  return text === '' ? NO_PARTS : [{ type: TEXT_PART, text }]
}
