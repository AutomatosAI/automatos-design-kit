import { captionFor } from '@automatos/mascot/media'
import type { MascotName } from '@automatos/mascot/types'

import { clip, toolDetail } from './labels'

/**
 * The state chip under the core (the Command design: "SEARCHING THE WEB"): what Auto is doing, in words, the text
 * twin of the rings and of Auto himself. The state's own words are @automatos/mascot's captions; the chat adds what
 * it knows, after Play's chat caption (themes/play/src/components/play/chat/caption.ts, Play 1.1.1): the running
 * search's query, the kind of Deliverable that just landed, a nap that is not the backend being down, and an
 * approval card waiting for the owner. The words are sentence case; the chip sets them in capitals. Pure.
 */

export interface ChipFacts {
  /** The input of the tool call running on the newest reply (its query, page or title). */
  readonly runningInput?: unknown
  /** The kind of the newest Deliverable the reply made ("document"), when it made one. */
  readonly deliverableKind?: string
  /** Automatos isn't answering: Auto sleeps for that reason, not for a nap. */
  readonly backendDown?: boolean
  /** An approval card waits for the owner's answer: Auto listens for it. */
  readonly approvalWaiting?: boolean
}

/** Asleep after the idle timeout, not because Automatos is down. */
export const NAPPING = 'Having a little nap'
/** Listening for the owner's answer on an approval card. */
export const AWAITING_ANSWER = 'Waiting for your answer on the card'
/** The conversation on its way. */
export const OPENING = 'Opening this conversation…'
/** How much of a running call's detail the chip shows. */
export const CHIP_DETAIL_CHARS = 40

const DETAIL_SEPARATOR = ' · '
const BUSY: ReadonlySet<MascotName> = new Set<MascotName>(['searching', 'reading', 'working'])

export function chipWords(state: MascotName, facts: ChipFacts = {}): string {
  if (state === 'sleeping' && !facts.backendDown) return NAPPING
  if (state === 'listening' && facts.approvalWaiting) return AWAITING_ANSWER
  if (state === 'celebrate' && facts.deliverableKind) return captionFor(state, facts.deliverableKind)
  const detail = BUSY.has(state) ? toolDetail(facts.runningInput) : null
  return detail ? `${captionFor(state)}${DETAIL_SEPARATOR}${clip(detail, CHIP_DETAIL_CHARS)}` : captionFor(state)
}

/** Auto's name on the core, then what he is doing (Mascot.dc.html names him "Auto, <state>"). */
export function autoLabel(words: string): string {
  return `Auto: ${words}`
}
