/**
 * PRD-261 B-02c: the chat area's receipt helpers, the fake of core's frontend/lib/theme-sdk/chat.ts:420-460 over
 * lib/chat/receipts.ts (at 101a0bf33f64fb4f89af81b4293415be60b661ac), kept beside src/sdk/chat.ts, which exports them.
 */
import type { HostReceipt } from '@automatos/theme-sdk'
import { liveReceiptsIn } from '../internal/scripted/chat-reply.ts'

type Sdk = typeof import('@automatos/theme-sdk')

/** lib/chat/receipts.ts:16-25 and internal/href.ts:11-42. */
const REFUSED_PREFIX = 'tried, refused'
const SKIPPED_PREFIX = 'not run'
const WAITING_SUFFIX = 'waiting for you'
const NO_REASON = 'no reason given'
const CARD_NUMBER = /^#\d/
const INTERNAL_HREF = /^\/(?![/\\])/
const UNSAFE_CHAR = /[\u0000-\u001f\u007f\s]/
const BACKSLASH = '\\'

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
