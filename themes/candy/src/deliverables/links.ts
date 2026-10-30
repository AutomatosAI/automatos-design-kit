// After themes/arcade/src/deliverables/links.ts (Arcade 1.0.0, itself after HUD 1.1.2 and Play 1.1.1): a
// Deliverable's link, as it is there, and its place in the host's Explorer.
import { DELIVERABLE_EXPLORER_HREF, DELIVERABLE_PARAM, DELIVERABLE_TAB_LABELS, DELIVERABLES_HREF, visibleDeliverableTabs } from '@automatos/theme-sdk'

/**
 * One Deliverable's page: /deliverables?deliverable=<id>, which Candy's shelf opens as the Deliverable's sheet
 * (src/deliverables/deliverables-page.tsx). The id is checked once more before it goes into the link (the host's
 * Deliverable id: letters, digits, - and _). Its place in the host's Explorer is the link core's own sheet opens
 * ("Open in Explorer": the Explorer's ?path=). The host's other sections of Deliverables (Blogs, Templates, Brand
 * kit, Socials while offered, the Explorer) stay the host's pages, linked from the shelf. Pure.
 */

const DELIVERABLE_ID = /^[A-Za-z0-9_-]{1,128}$/
const EXPLORER = 'Explorer'

export function isDeliverableId(id: string): boolean {
  return DELIVERABLE_ID.test(id)
}

export function deliverableHref(id: string): string {
  return `${DELIVERABLES_HREF}?${DELIVERABLE_PARAM}=${encodeURIComponent(id)}`
}

/** The Explorer at the Deliverable's place in the workspace; the Explorer itself for one with no path. */
export function explorerHref(path: string | null | undefined): string {
  const place = path?.trim()
  return place ? `${DELIVERABLE_EXPLORER_HREF}?path=${encodeURIComponent(place)}` : DELIVERABLE_EXPLORER_HREF
}

export interface SectionLink {
  readonly href: string
  readonly label: string
}

/** The host's other sections of Deliverables, then the Explorer. */
export function sectionLinks(socials: boolean): readonly SectionLink[] {
  const tabs = visibleDeliverableTabs(socials).filter((tab) => tab !== 'outputs')
  return [
    ...tabs.map((tab) => ({ href: `${DELIVERABLES_HREF}?tab=${tab}`, label: DELIVERABLE_TAB_LABELS[tab] })),
    { href: DELIVERABLE_EXPLORER_HREF, label: EXPLORER },
  ]
}
