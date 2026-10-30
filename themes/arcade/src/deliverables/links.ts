// After themes/hud/src/chat/deliverable-link.ts (HUD 1.1.2, itself from Play 1.1.1): a Deliverable's link.
import { DELIVERABLE_PARAM, DELIVERABLES_HREF } from '@automatos/theme-sdk'

/**
 * One Deliverable's page: /deliverables?deliverable=<id>, which Arcade's Inventory opens as the item's own window
 * (src/deliverables/inventory-page.tsx). The id is checked once more before it goes into the link (the host's
 * Deliverable id: letters, digits, - and _). Pure.
 */

const DELIVERABLE_ID = /^[A-Za-z0-9_-]{1,128}$/

export function isDeliverableId(id: string): boolean {
  return DELIVERABLE_ID.test(id)
}

export function deliverableHref(id: string): string {
  return `${DELIVERABLES_HREF}?${DELIVERABLE_PARAM}=${encodeURIComponent(id)}`
}
