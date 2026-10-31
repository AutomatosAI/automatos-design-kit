import { SayChips, STARTED_LINE } from '../next/next-line'
import { openSuggestion, useSuggestionChoice } from '../next/use-next'
import styles from './thread.module.css'

/**
 * HUD 1.3.0 (PRD-268, SDK 1.4.0): a suggestion Auto posted into the conversation (a message's suggestion@1 part,
 * thread/message-parts.ts), as a card in his AUTO row. The part names the suggestion by its id; the card draws it from
 * the SDK's useSuggestions (the signed-in person's own open suggestions), never from the thread, so it shows only while
 * that suggestion is open and the viewer's: an article named "Auto suggests: <title>", as the host's own suggestion card
 * is named, with `▸ AUTO SUGGESTS` as its heading, its title and its detail as Auto's words
 * (data-ai-generated, drawn as text), then START and HIDE as the `▸ NEXT` line's SAY chips (next/next-line.tsx: each
 * named by its words and the suggestion, HIDE asking why), through the SDK's routes (useSuggestionChoice). Started, the
 * line's words say so in its place for 4 s, then the card is gone; hidden, it is gone at once; refused, the reason in
 * one line, and it stays. Not open (started, hidden or expired elsewhere), or not the viewer's: nothing, and the
 * message's words stand alone. The `▸ NEXT` line skips a suggestion the conversation shows, so one never shows twice.
 * Never spoken: HUD calls no speech API, and Auto's words are in no live region (only HUD's own started and refused
 * lines are statuses, as on the `▸ NEXT` line).
 */

export const SUGGESTS_TITLE = 'Auto suggests'
const SUGGESTS_MARK = '▸'

export function ThreadSuggestion({ id }: { readonly id: string }) {
  const choice = useSuggestionChoice((list, decided) => openSuggestion(list, decided, id))
  const { suggestion } = choice
  if (choice.started) {
    return (
      <p className={styles.started} role="status" data-thread-part="suggestion@1" data-suggestion-id={id}>
        {STARTED_LINE}
      </p>
    )
  }
  if (suggestion === null) return null
  return (
    <article
      className={styles.suggestion}
      aria-label={`${SUGGESTS_TITLE}: ${suggestion.title}`}
      data-thread-part="suggestion@1"
      data-suggestion-id={id}
    >
      <h3 className={styles.suggestsTitle}>
        <span aria-hidden="true">{SUGGESTS_MARK}</span> {SUGGESTS_TITLE}
      </h3>
      <p className={styles.suggestionTitle} data-ai-generated="true">
        {suggestion.title}
      </p>
      {suggestion.detail && (
        <p className={styles.suggestionDetail} data-ai-generated="true">
          {suggestion.detail}
        </p>
      )}
      <SayChips key={suggestion.id} suggestion={suggestion} next={choice} />
      {choice.refused !== null && (
        <p className={styles.refused} role="alert">
          {choice.refused}
        </p>
      )}
    </article>
  )
}
