import type { Brief, BriefRating } from '@automatos/theme-sdk'

import styles from './briefing.module.css'
import { useBriefRating } from './use-brief-rating'

/**
 * HUD 1.3.0 (PRD-268): BRIEFING's footer, the brief's thumbs (use-brief-rating.ts). A mono question, then USEFUL and
 * NOT USEFUL as HUD's square outline buttons, each a glyph and its word, named by the word. Rated, the thumb the person
 * gave stays pressed, neither takes a press again (aria-disabled, so the focus stays on the thumb pressed rather than
 * dropping to the page), and HUD's own words say so as a status; refused, the reason in one line. The question and the
 * words are HUD's, not Auto's.
 */

export const THUMBS_LABEL = 'Rate this brief'
export const THUMBS_QUESTION = 'Was this brief useful?'
export const THUMB_WORDS: Readonly<Record<BriefRating, string>> = { up: 'Useful', down: 'Not useful' }
export const THUMB_GLYPHS: Readonly<Record<BriefRating, string>> = { up: '▲', down: '▼' }
export const RATED_LINE = 'Rated. Thanks.'
const THUMBS = Object.keys(THUMB_WORDS) as readonly BriefRating[]

export function BriefThumbs({ brief }: { readonly brief: Brief }) {
  const { rating, busy, refused, rate } = useBriefRating(brief)
  return (
    <footer className={styles.thumbs}>
      <div className={styles.thumbRow} role="group" aria-label={THUMBS_LABEL}>
        <span className={styles.question} aria-hidden="true">
          {THUMBS_QUESTION}
        </span>
        {THUMBS.map((thumb) => (
          <button
            key={thumb}
            type="button"
            className={styles.thumb}
            aria-pressed={rating === thumb}
            aria-busy={busy}
            aria-disabled={rating !== null || busy}
            onClick={() => rate(thumb)}
          >
            <span aria-hidden="true">{THUMB_GLYPHS[thumb]}</span> {THUMB_WORDS[thumb]}
          </button>
        ))}
      </div>
      {rating !== null && (
        <p className={styles.rated} role="status">
          {RATED_LINE}
        </p>
      )}
      {refused !== null && (
        <p className={styles.refused} role="alert">
          {refused}
        </p>
      )}
    </footer>
  )
}
