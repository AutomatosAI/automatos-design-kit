/**
 * PRD-261 B-02c: the fake of SDK area `cards`. It mirrors core's frontend/lib/theme-sdk/cards.ts (at
 * 101a0bf33f64fb4f89af81b4293415be60b661ac), which re-exports the host's cards from host-cards/*: here each is a
 * stand-in (src/sdk/cards/*.tsx) with the props of packages/theme-sdk/areas/cards.d.ts and data-protected-surface on
 * its root, but AiLabelFence, which draws its children alone, as core's does since #1365 (frame-cards.tsx). The
 * approvals are checked as core checks them; no card makes a call: each click is kept, for a test to read through
 * cardsControls.cardActions (host.ts gathers the controls), as are MarkdownView's props (cardsControls.markdownViews);
 * resetCards forgets them. SDK 1.3.0 (PRD-268) adds the proactive defaults, after core's host-cards/proactive-cards.tsx at
 * 1a8956c874dc42cff05b96f431c50b7d722a71aa: BriefCard, SuggestionCard, StatusLabel, ReadinessList, CalibrationCard and
 * ReplyChips, each with core's prop checks, words, data attributes and AI marks; and an approval's `approval_view`.
 */
import { cardActions, markdownViews, resetCardsLog } from '../internal/scripted/cards-log.ts'

export { MissionApproval, ToolApproval } from './cards/approvals.tsx'
export { MissionCreatedCard, MissionSuggestionCard, TaskCard, WithdrawOfferCard } from './cards/chat-cards.tsx'
export { FilePreview, MadeBy, MarkdownView } from './cards/content.tsx'
export { FirstRunNudge, HeaderUtilities, TrialExhaustedBanner } from './cards/chrome.tsx'
export { AiLabelFence, CorePage } from './cards/frame-cards.tsx'
export { BriefCard } from './cards/brief-card.tsx'
export { SuggestionCard } from './cards/suggestion-card.tsx'
export { StatusLabel } from './cards/status-label.tsx'
export { ReadinessList } from './cards/readiness-list.tsx'
export { CalibrationCard } from './cards/calibration-card.tsx'
export { ReplyChips } from './cards/reply-chips.tsx'

/** The controls of this area, gathered by host.ts: every click on a card and every MarkdownView's props since the last reset. */
export const cardsControls = Object.freeze({ cardActions, markdownViews })

/** The cards as a test starts with them: no click or MarkdownView kept. */
export function resetCards(): void {
  resetCardsLog()
}

export type { CardAction, CardName } from '../internal/scripted/cards-log.ts'
