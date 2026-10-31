import { useId, useRef } from 'react'
import { type Brief, BriefVoice, useNeedsYou } from '@automatos/theme-sdk'

import { Panel } from '../../components/panel'
import { useEntrance } from '../entrance'
import { briefDay, briefSections, emptyLine, type ShownSection } from './brief-rows'
import { BriefingRow } from './briefing-row'
import styles from './briefing.module.css'
import { useFoldAway, usePanelHold } from './use-fold'

/**
 * HUD 1.2.0 (PRD-268): BRIEFING, the day's brief as HUD draws it, in place of what it folds back into (the screen
 * places it: the right column in three and two columns, the transcript's slot in one and on the phone). A HUD panel
 * with the brief's day as its value: the greeting (Auto's words), the host's Listen (the SDK's BriefVoice: core reads
 * the brief in Auto's voice, with its AI caption and Stop; HUD never speaks) with `▸ SPEAKING` beside it while Auto
 * reads, and the brief's sections, each its label and exact count, its rows numbered across the brief as Listen numbers
 * them (a folded section shows the rows the brief carries under its exact count); an empty brief says so in its own
 * sentence. It glows while anything needs you, read as NEEDS YOU reads it (the SDK's useNeedsYou, the brief's own
 * count until that answers), so something raised after the brief was made still lights it: on the screen it stands in
 * for NEEDS YOU, the one panel that may (the one-live-border rule).
 * It folds back after 60 s, a clock held while Auto reads it or the focus is in it, or on any press outside it
 * (use-fold.ts), and enters once with a fade and a 4 px rise, nothing at all under reduced motion (entrance.ts).
 */

export const BRIEFING_TITLE = 'Briefing'
/** Beside Listen while Auto reads the brief (the host's own status line tells a screen reader). */
export const SPEAKING_WORDS = '▸ Speaking'

export interface BriefingPanelProps {
  readonly brief: Brief
  /** Folds BRIEFING back into the screen it stands in for. */
  readonly onFold: () => void
}

function BriefSectionRows({ shown }: { readonly shown: ShownSection }) {
  const labelId = useId()
  return (
    <div className={styles.section} role="group" aria-labelledby={labelId} data-section={shown.section}>
      <h3 id={labelId} className={styles.sectionLabel}>
        {shown.label} <span className={styles.count}>{shown.count}</span>
      </h3>
      <ol className={styles.rows}>
        {shown.rows.map((numbered) => (
          <BriefingRow key={numbered.row.id} shown={numbered} />
        ))}
      </ol>
    </div>
  )
}

export function BriefingPanel({ brief, onFold }: BriefingPanelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { speaking, focused } = usePanelHold(ref)
  useFoldAway(onFold, speaking || focused, ref)
  const entrance = useEntrance()
  const needsYou = useNeedsYou().data?.total ?? brief.counts.needs_you
  const sections = briefSections(brief)
  return (
    <div ref={ref} className={styles.briefing} data-hud-enter={entrance}>
      <Panel title={BRIEFING_TITLE} value={briefDay(brief.date)} live={needsYou > 0}>
        <div className={styles.head}>
          <p className={styles.greeting} data-ai-generated="true">
            {brief.greeting}
          </p>
          <div className={styles.listen}>
            <BriefVoice />
            {speaking && (
              <span className={styles.speaking} aria-hidden="true">
                {SPEAKING_WORDS}
              </span>
            )}
          </div>
        </div>
        {sections.length === 0 ? (
          <p className={styles.empty}>{emptyLine(brief)}</p>
        ) : (
          sections.map((shown) => <BriefSectionRows key={shown.section} shown={shown} />)
        )}
      </Panel>
    </div>
  )
}
