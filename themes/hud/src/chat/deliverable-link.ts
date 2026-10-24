// Copied from themes/play/src/components/play/chat/deliverable-link.ts (Play 1.1.1) as it is, but for the comments.
import { DELIVERABLE_PARAM, DELIVERABLES_HREF, type HostDeliverable } from '@automatos/theme-sdk'

/**
 * A Deliverable's link and type in words: the id is checked once more before it goes into the link (the host's
 * Deliverable id: letters, digits, - and _), and the link is the host's own page for one Deliverable,
 * /deliverables?deliverable=<id>, built on the SDK's routes. Pure.
 */

const DELIVERABLE_ID = /^[A-Za-z0-9_-]{1,128}$/

/** The kind in words, for the card's type tag. */
export const KIND_WORDS: Readonly<Record<HostDeliverable['kind'], string>> = {
  document: 'Document',
  image: 'Image',
  video: 'Video',
}

export function isDeliverableId(id: string): boolean {
  return DELIVERABLE_ID.test(id)
}

/** The host's page for one Deliverable. */
export function deliverableHref(id: string): string {
  return `${DELIVERABLES_HREF}?${DELIVERABLE_PARAM}=${encodeURIComponent(id)}`
}
