import { type HostChatMessage, type HostDeliverable, type HostReceipt, receiptLine, receiptLink } from '@automatos/theme-sdk'

import type { ItemKind } from '../art/agents-icons'

/**
 * What a reply did, as the story's event lines (the design's ★ lines: "Scout searched the web · 3 results"): its
 * receipts in the host's own words (receiptLine), each linking where the host says it may; or, for a reply with no
 * receipts, its tool calls, each by the server's one-line summary. A refused receipt or a failed call is a ✕ line;
 * a skipped call, and an ask waiting on its approval card, show none. Pure.
 */

export type EventTone = 'event' | 'failed'

export interface EventLine {
  readonly key: string
  readonly tone: EventTone
  readonly text: string
  readonly href: string | null
}

function receiptLines(receipts: readonly HostReceipt[]): EventLine[] {
  return receipts.flatMap((receipt, index): EventLine[] => {
    if (receipt.status === 'waiting' || receipt.status === 'skipped') return []
    const failed = receipt.status === 'refused'
    const reason = failed && receipt.reason ? `: ${receipt.reason}` : ''
    return [{
      key: `receipt-${index}`,
      tone: failed ? 'failed' : 'event',
      text: `${receiptLine(receipt)}${reason}`,
      href: failed ? null : receiptLink(receipt),
    }]
  })
}

/** "web_search" as "web search". */
export function toolWords(name: string): string {
  return name.replace(/[_-]+/g, ' ').trim() || 'a tool'
}

function toolLines(message: HostChatMessage): EventLine[] {
  return message.toolCalls.flatMap((call): EventLine[] => {
    if (call.skipped || call.waiting) return []
    const words = toolWords(call.toolName)
    if (call.state === 'error') {
      return [{ key: call.toolCallId, tone: 'failed', text: `${words}: ${call.error ?? 'it failed'}`, href: null }]
    }
    const text = call.state === 'running' ? `${words}…` : (call.summary ?? `used ${words}`)
    return [{ key: call.toolCallId, tone: 'event', text, href: null }]
  })
}

export function eventLines(message: HostChatMessage): readonly EventLine[] {
  const receipts = message.receipts ?? []
  return receipts.length > 0 ? receiptLines(receipts) : toolLines(message)
}

/** A chat Deliverable's kind as an item icon: the chat tells a document, a picture or a video apart. */
export function itemKindOf(deliverable: HostDeliverable): ItemKind {
  return deliverable.kind === 'document' ? 'document' : 'image'
}

export const KIND_WORDS: Readonly<Record<HostDeliverable['kind'], string>> = {
  document: 'Document',
  image: 'Image',
  video: 'Video',
}
