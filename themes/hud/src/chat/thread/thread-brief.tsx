import type { Brief } from '@automatos/theme-sdk'

import { Panel } from '../../components/panel'
import { briefDay } from '../briefing/brief-rows'
import { BriefSections } from '../briefing/brief-sections'
import { HudMarkdown } from '../markdown'
import styles from './thread.module.css'

/**
 * HUD 1.3.0 (PRD-268, SDK 1.4.0): the day's brief as Auto posted it into the conversation (a message's brief@1 part,
 * thread/message-parts.ts), drawn in his AUTO row in the message's place: a HUD panel titled Brief with the brief's day
 * as its value, the greeting, his Read (the message's own words, the brief's prose: drawn here once, never a second
 * time as the message's text), and the brief's sections as BRIEFING draws them (briefing/brief-sections.tsx: every row
 * numbered across the brief, its why, its state, its action named by the row, Start on a suggestion's row), one heading
 * level down. It is the conversation's record of that brief: the host's Listen and the thumbs stay in BRIEFING, on the
 * day's brief the host holds. Every word is Auto's (data-ai-generated).
 */

export const THREAD_BRIEF_TITLE = 'Brief'

export function ThreadBrief({ brief }: { readonly brief: Brief }) {
  return (
    <div className={styles.brief} data-thread-part="brief@1">
      <Panel title={THREAD_BRIEF_TITLE} value={briefDay(brief.date)} level={3}>
        <p className={styles.greeting} data-ai-generated="true">
          {brief.greeting}
        </p>
        {brief.prose && (
          <div className={styles.prose} data-ai-generated="true">
            <HudMarkdown text={brief.prose} />
          </div>
        )}
        <BriefSections brief={brief} level={4} />
      </Panel>
    </div>
  )
}
