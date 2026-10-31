import { useRef } from 'react'
import { type Brief, BriefVoice, useNeedsYou } from '@automatos/theme-sdk'

import { Panel } from '../../components/panel'
import { useEntrance } from '../entrance'
import { briefDay } from './brief-rows'
import { BriefSections } from './brief-sections'
import { BriefThumbs } from './brief-thumbs'
import styles from './briefing.module.css'
import { useFoldAway, usePanelHold } from './use-fold'
import { useBriefReading } from './use-reading'

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
 * HUD 1.3.0 (SDK 1.4.0): its rows built in time with Auto's voice, from the row Listen says he reads (onSpeakingRow,
 * use-reading.ts): `▸` on the row being read, each row drawn as he reaches it, or, where nothing may move, every row at
 * once and only the marker moving; and the brief's thumbs in its footer (brief-thumbs.tsx).
 */

export const BRIEFING_TITLE = 'Briefing'
/** Beside Listen while Auto reads the brief (the host's own status line tells a screen reader). */
export const SPEAKING_WORDS = '▸ Speaking'

export interface BriefingPanelProps {
  readonly brief: Brief
  /** Folds BRIEFING back into the screen it stands in for. */
  readonly onFold: () => void
}

export function BriefingPanel({ brief, onFold }: BriefingPanelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { speaking, focused } = usePanelHold(ref)
  useFoldAway(onFold, speaking || focused, ref)
  const entrance = useEntrance()
  const building = entrance !== undefined
  const { onSpeakingRow, stateOf } = useBriefReading(speaking, building)
  const needsYou = useNeedsYou().data?.total ?? brief.counts.needs_you
  return (
    <div ref={ref} className={styles.briefing} data-hud-enter={entrance}>
      <Panel title={BRIEFING_TITLE} value={briefDay(brief.date)} live={needsYou > 0}>
        <div className={styles.head}>
          <p className={styles.greeting} data-ai-generated="true">
            {brief.greeting}
          </p>
          <div className={styles.listen}>
            <BriefVoice onSpeakingRow={onSpeakingRow} />
            {speaking && (
              <span className={styles.speaking} aria-hidden="true">
                {SPEAKING_WORDS}
              </span>
            )}
          </div>
        </div>
        <BriefSections brief={brief} readingOf={stateOf} building={building} />
        <BriefThumbs brief={brief} />
      </Panel>
    </div>
  )
}
