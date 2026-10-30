import {
  type BriefRow,
  chatHref,
  type CoreNavItem,
  missionHref,
  QUESTIONS_HREF,
  ticketHref,
} from '@automatos/theme-sdk'

import { deliverableHref } from '../chat/deliverable-link'

/**
 * Play 1.3.0 (PRD-268 §6.11.2, §6.12.3) — what pressing a brief row's action does in Play: the row's action is drawn
 * as text by the host's BriefCard ("Start →", "Open →"), and the card asks the theme to run it. Start and Hide on a
 * suggestion's row are the proactive area's Start and Hide, by the suggestion's id; any other action goes where the
 * row opens, on the SDK's own paths (a ticket, a Mission, the Questions tab for a question, a chat, a Deliverable),
 * and a settings row to the host's Settings when the core nav offers it to this caller. A row with nowhere to go has
 * no step: the card then leaves it as it was. Pure.
 */

/** The core nav's Settings item (Docs and Settings sit in its footer), which it leaves out for a caller without it. */
export const SETTINGS_NAV_ID = 'settings'

export type BriefStep =
  | { readonly kind: 'start' | 'hide'; readonly id: string }
  | { readonly kind: 'go'; readonly href: string }

/** The Settings page's path, from the core nav's footer; null when this caller has no Settings. */
export function settingsHrefOf(footer: readonly CoreNavItem[]): string | null {
  return footer.find((item) => item.id === SETTINGS_NAV_ID)?.href ?? null
}

/** Where a row opens, on the SDK's paths; null for a suggestion (it has no page) and for no Settings. */
export function briefRowHref(opens: BriefRow['opens'], settingsHref: string | null): string | null {
  if (!opens) return null
  switch (opens.type) {
    case 'ticket':
      return ticketHref(opens.id)
    case 'mission':
      return missionHref(opens.id)
    case 'question':
      return QUESTIONS_HREF
    case 'chat':
      return chatHref(opens.id)
    case 'deliverable':
      return deliverableHref(opens.id)
    case 'settings':
      return settingsHref
    default:
      return null
  }
}

/** What the row's action does: Start or Hide its suggestion, or go where it opens; null when it can do nothing. */
export function briefStepOf(row: BriefRow, settingsHref: string | null): BriefStep | null {
  const verb = row.action?.verb
  if (!verb) return null
  if ((verb === 'start' || verb === 'hide') && row.opens?.type === 'suggestion') return { kind: verb, id: row.opens.id }
  const href = briefRowHref(row.opens, settingsHref)
  return href === null ? null : { kind: 'go', href }
}
