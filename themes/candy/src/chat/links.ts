// After themes/arcade/src/deliverables/links.ts (Arcade 1.0.0), itself from HUD 1.1.2 and Play 1.1.1: a Deliverable's link.
import { DELIVERABLE_PARAM, DELIVERABLES_HREF } from '@automatos/theme-sdk'

/**
 * One Deliverable's page: /deliverables?deliverable=<id>, which Candy's Deliverables page opens. The id is checked
 * once more before it goes into the link (the host's Deliverable id: letters, digits, - and _). Pure.
 */

const DELIVERABLE_ID = /^[A-Za-z0-9_-]{1,128}$/

export function isDeliverableId(id: string): boolean {
  return DELIVERABLE_ID.test(id)
}

export function deliverableHref(id: string): string {
  return `${DELIVERABLES_HREF}?${DELIVERABLE_PARAM}=${encodeURIComponent(id)}`
}
