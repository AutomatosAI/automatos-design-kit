import type { Brief, HostChatMessage, HostMissionSuggestion, Suggestion } from '@automatos/theme-sdk'

/**
 * Play 1.3.0 (PRD-268 §6.12.4) — what Play's chat decides about the proactive surfaces, from the SDK's data. Pure.
 *
 * - The day's brief in a conversation: SDK 1.3.0 hands a theme's chat each message's words, not its parts, so Play
 *   cannot read the `brief@1` part the brief's message carries. That message's text part is the brief's prose
 *   (§6.11.2: `parts = [{type: 'text', text: prose}, {type: 'brief@1', brief}]`), so the reply whose words are exactly
 *   the day's brief's prose is the brief's message, and Play draws the card in its place. Another day's brief, which
 *   useBrief no longer holds, stays its prose, as on any client that can't draw the card.
 * - One suggestion surface: while the turn's own Mission suggestion is unanswered (PlayMissionSuggestion shows it, and
 *   no Mission is being planned yet), the suggestion pinned above the message box steps aside.
 * - The pinned suggestion is the newest open one (useSuggestions lists them newest first) that the brief on screen
 *   doesn't already list with its own Start and Hide, so each suggestion's Start is on screen once.
 */

/** True when `message` is the day's brief's message: Auto's, finished, its words exactly the brief's prose. */
export function isBriefMessage(message: HostChatMessage, brief: Brief): boolean {
  if (message.role !== 'assistant' || message.writing) return false
  const prose = brief.prose.trim()
  return prose !== '' && message.text.trim() === prose
}

/** True while the turn's Mission suggestion waits for an answer: one is offered and no Mission is planned from it. */
export function missionSuggestionOpen(suggestion: HostMissionSuggestion | null, planningMissionId: string | null): boolean {
  return suggestion !== null && !planningMissionId
}

/** The newest open suggestion not `listed` already (the brief on screen shows those with their Start), or null. */
export function newestOpenSuggestion(
  list: readonly Suggestion[] | null | undefined,
  listed: readonly string[] = [],
): Suggestion | null {
  return (list ?? []).find((suggestion) => suggestion.status === 'open' && !listed.includes(suggestion.id)) ?? null
}

/** The suggestions a brief lists in its Suggested section, by id: their rows carry Start and Hide. */
export function briefSuggestionIds(brief: Brief | null | undefined): readonly string[] {
  return (brief?.sections.suggestions ?? []).flatMap((row) => (row.opens?.type === 'suggestion' ? [row.opens.id] : []))
}

/** The brief the chat has on screen: on an empty chat the day's brief, in a conversation only when its message is in it. */
export function briefOnScreen(
  brief: Brief | null | undefined,
  messages: readonly HostChatMessage[],
): Brief | null {
  if (!brief) return null
  return messages.length === 0 || messages.some((message) => isBriefMessage(message, brief)) ? brief : null
}
