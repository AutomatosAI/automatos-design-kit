/**
 * PRD-261 B-02c: the fake of SDK area `cards`. It mirrors core's frontend/lib/theme-sdk/cards.ts (at
 * 101a0bf33f64fb4f89af81b4293415be60b661ac), which re-exports the host's cards from host-cards/*: here each is a
 * stand-in (src/sdk/cards/*.tsx) with the props of packages/theme-sdk/areas/cards.d.ts and data-protected-surface on
 * its root. The approvals are checked as core checks them; no card makes a call: each click is kept, for a test to
 * read through cardsControls.cardActions (host.ts gathers the controls); resetCards forgets them.
 */
import { cardActions, resetCardsLog } from '../internal/scripted/cards-log.ts'

export { MissionApproval, ToolApproval } from './cards/approvals.tsx'
export { MissionCreatedCard, MissionSuggestionCard, TaskCard, WithdrawOfferCard } from './cards/chat-cards.tsx'
export { FilePreview, MadeBy, MarkdownView } from './cards/content.tsx'
export { FirstRunNudge, HeaderUtilities, TrialExhaustedBanner } from './cards/chrome.tsx'
export { AiLabelFence, CorePage } from './cards/frame-cards.tsx'

/** The controls of this area, gathered by host.ts: every click on a card since the last reset. */
export const cardsControls = Object.freeze({ cardActions })

/** The cards as a test starts with them: no click kept. */
export function resetCards(): void {
  resetCardsLog()
}

export type { CardAction, CardName } from '../internal/scripted/cards-log.ts'
