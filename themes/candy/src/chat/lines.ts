// After themes/arcade/src/chat/lines.ts (Arcade 1.0.0): what a reply did, as Candy's tool chips.
import { type HostChatMessage, type HostDeliverable, type HostReceipt, receiptLine, receiptLink } from '@automatos/theme-sdk'

import { kindSetOf, type CardSet } from '../ui/sets'

/**
 * What a reply did, as the chips over Auto's bubble (the design's "✓ Searched Knowledge · spring lookbook"): its
 * receipts in the host's own words (receiptLine), each linking where the host says it may; or, for a reply with no
 * receipts, its tool calls, each by the server's one-line summary. A refused receipt (its reason in the host's words)
 * or a failed call is a ✕ chip, a call still running a ● chip; a skipped call, and an ask waiting on its approval
 * card, show none. Every chip carries its glyph and its words, so the colour is never the only sign. Pure.
 */

export type ChipTone = 'done' | 'running' | 'failed'

export interface ToolChip {
  readonly key: string
  readonly tone: ChipTone
  readonly text: string
  readonly href: string | null
}

export const CHIP_GLYPHS: Readonly<Record<ChipTone, string>> = {
  done: '✓',
  running: '●',
  failed: '✕',
}

function receiptChips(receipts: readonly HostReceipt[]): ToolChip[] {
  return receipts.flatMap((receipt, index): ToolChip[] => {
    if (receipt.status === 'waiting' || receipt.status === 'skipped') return []
    const failed = receipt.status === 'refused'
    // receiptLine already says a refused call's reason; Arcade's lines.ts adds it a second time.
    return [{
      key: `receipt-${index}`,
      tone: failed ? 'failed' : 'done',
      text: receiptLine(receipt),
      href: failed ? null : receiptLink(receipt),
    }]
  })
}

/** "web_search" as "web search". */
export function toolWords(name: string): string {
  return name.replace(/[_-]+/g, ' ').trim() || 'a tool'
}

function toolChips(message: HostChatMessage): ToolChip[] {
  return message.toolCalls.flatMap((call): ToolChip[] => {
    if (call.skipped || call.waiting) return []
    const words = toolWords(call.toolName)
    if (call.state === 'error') {
      return [{ key: call.toolCallId, tone: 'failed', text: `${words}: ${call.error ?? 'it failed'}`, href: null }]
    }
    if (call.state === 'running') return [{ key: call.toolCallId, tone: 'running', text: `${words}…`, href: null }]
    return [{ key: call.toolCallId, tone: 'done', text: call.summary ?? `Used ${words}`, href: null }]
  })
}

export function toolChipsOf(message: HostChatMessage): readonly ToolChip[] {
  const receipts = message.receipts ?? []
  return receipts.length > 0 ? receiptChips(receipts) : toolChips(message)
}

/** A chat Deliverable's kind in words: the chat tells a document, an image and a video apart. */
export const KIND_WORDS: Readonly<Record<HostDeliverable['kind'], string>> = {
  document: 'Document',
  image: 'Image',
  video: 'Video',
}

/** The gradient a Deliverable's square wears: its kind's, as on the Deliverables page. */
export function deliverableSet(deliverable: HostDeliverable): CardSet {
  return kindSetOf(deliverable.kind)
}
