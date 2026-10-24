import { plural, type AgentSummary } from './agents-summary'
import styles from './agents.module.css'

/** The core page's stats strip: four cells, each a number and a line under it. */

export const STATS_LABEL = 'Agent statistics'

interface Cell {
  readonly label: string
  readonly value: string
  readonly tone: 'ok' | 'err' | 'quiet'
  readonly delta: string
}

function cellsOf(summary: AgentSummary): Cell[] {
  const online = summary.total > 0 ? Math.round((summary.active / summary.total) * 100) : 0
  return [
    { label: 'Total', value: String(summary.total), tone: 'quiet', delta: plural(summary.total, 'agent') },
    { label: 'Active', value: String(summary.active), tone: summary.active > 0 ? 'ok' : 'quiet', delta: `${online}% online` },
    {
      label: 'Attention',
      value: String(summary.attention),
      tone: summary.attention > 0 ? 'err' : 'quiet',
      delta: summary.failing > 0 ? `${summary.failing} failing` : 'All healthy',
    },
    { label: 'Inactive', value: String(summary.inactive), tone: 'quiet', delta: 'not running' },
  ]
}

export function AgentStats({ summary }: { readonly summary: AgentSummary }) {
  return (
    <section aria-label={STATS_LABEL}>
      <dl className={styles.stats}>
        {cellsOf(summary).map((cell) => (
          <div key={cell.label} className={styles.cell}>
            <dt className={styles.cellLabel}>{cell.label}</dt>
            <dd className={styles.cellValue} data-tone={cell.tone}>
              {cell.value}
            </dd>
            <dd className={styles.cellDelta}>{cell.delta}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
