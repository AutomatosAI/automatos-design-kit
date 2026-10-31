import { useId } from 'react'
import type { Brief } from '@automatos/theme-sdk'

import { briefSections, emptyLine, type ShownSection } from './brief-rows'
import { BriefingRow } from './briefing-row'
import styles from './briefing.module.css'
import type { RowReading } from './use-reading'

/**
 * HUD 1.2.0 (PRD-268): the brief's sections as BRIEFING draws them, each its label and exact count over its rows
 * numbered across the brief as Listen numbers them, or the brief's own sentence for an empty day. HUD 1.3.0: the same
 * sections draw the brief Auto posted into the conversation (thread/thread-brief.tsx), one heading level down; and in
 * BRIEFING, while Auto reads the brief, each row's place in the reading (use-reading.ts), the rows building in as he
 * reaches them where motion is allowed (`building`).
 */

export interface BriefSectionsProps {
  readonly brief: Brief
  /** The sections' heading level: 3 in BRIEFING, 4 inside a message, under its own heading. */
  readonly level?: 3 | 4
  /** Each row's place in Auto's reading, by its index across the brief; none while he reads nothing. */
  readonly readingOf?: (index: number) => RowReading | undefined
  /** Rows build in as Auto reaches them (motion is allowed). */
  readonly building?: boolean
}

type SectionProps = Required<Pick<BriefSectionsProps, 'level'>> & Pick<BriefSectionsProps, 'readingOf' | 'building'>

function BriefSection({ shown, level, readingOf, building = false }: SectionProps & { readonly shown: ShownSection }) {
  const labelId = useId()
  const Heading = level === 4 ? 'h4' : 'h3'
  return (
    <div className={styles.section} role="group" aria-labelledby={labelId} data-section={shown.section}>
      <Heading id={labelId} className={styles.sectionLabel}>
        {shown.label} <span className={styles.count}>{shown.count}</span>
      </Heading>
      <ol className={styles.rows} data-build={building ? 'true' : undefined}>
        {shown.rows.map((numbered) => (
          <BriefingRow key={numbered.row.id} shown={numbered} reading={readingOf?.(numbered.number - 1)} />
        ))}
      </ol>
    </div>
  )
}

export function BriefSections({ brief, level = 3, readingOf, building }: BriefSectionsProps) {
  const sections = briefSections(brief)
  if (sections.length === 0) return <p className={styles.empty}>{emptyLine(brief)}</p>
  return (
    <>
      {sections.map((shown) => (
        <BriefSection key={shown.section} shown={shown} level={level} readingOf={readingOf} building={building} />
      ))}
    </>
  )
}
