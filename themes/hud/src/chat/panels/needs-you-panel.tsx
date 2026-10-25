import { BOARD_HREF, HostLink, type NeedsYou, useNeedsYou } from '@automatos/theme-sdk'

import { Panel } from '../../components/panel'
import styles from './panels.module.css'
import { KIND_MARKS, needsYouRows, type NeedsYouRow } from './work-rows'

/**
 * NEEDS YOU, under TODAY: the Command Center's one Needs-you number in the header (the SDK's useNeedsYou, which a
 * board change refreshes at once) and the first rows behind it (work-rows.ts), each its title linked to where it is
 * answered, and its kind as a glyph and a word; the rest are a link to the board. Live while anything needs you.
 */

export const NEEDS_YOU_TITLE = 'Needs you'
export const NEEDS_YOU_LOADING = 'Loading what needs you…'
export const NEEDS_YOU_FAILED = "Couldn't load what needs you."
export const NOTHING_NEEDS_YOU = 'Nothing needs you.'
/** How many rows the panel lists. */
export const NEEDS_YOU_SHOWN = 3

/** The link to the rest, on the board. */
export const moreLine = (count: number): string => `${count} more on the board`

function NeedsYouItem({ row }: { readonly row: NeedsYouRow }) {
  const mark = KIND_MARKS[row.kind]
  return (
    <li className={styles.row}>
      <span className={styles.rowHead}>
        <HostLink href={row.href} className={styles.rowLink}>
          {row.title}
        </HostLink>
        <span className={styles.status} data-tone={mark.tone}>
          <span aria-hidden="true">{mark.glyph}</span> {mark.word}
        </span>
      </span>
      {row.detail && <span className={styles.detail}>{row.detail}</span>}
    </li>
  )
}

function NeedsYouRows({ needs }: { readonly needs: NeedsYou }) {
  const shown = needsYouRows(needs).slice(0, NEEDS_YOU_SHOWN)
  const more = needs.total - shown.length
  return (
    <>
      {shown.length > 0 && (
        <ul className={styles.rows}>
          {shown.map((row) => (
            <NeedsYouItem key={row.key} row={row} />
          ))}
        </ul>
      )}
      {more > 0 && (
        <HostLink href={BOARD_HREF} className={styles.more}>
          {moreLine(more)}
        </HostLink>
      )}
    </>
  )
}

/** The rows while anything needs you, else the note in their place: loading, a failure, or nothing. */
function NeedsYouBody({ needs, error }: { readonly needs: NeedsYou | null; readonly error: string | null }) {
  if (needs !== null && needs.total > 0) return <NeedsYouRows needs={needs} />
  const note = needs === null ? (error === null ? NEEDS_YOU_LOADING : NEEDS_YOU_FAILED) : NOTHING_NEEDS_YOU
  return <p className={styles.note}>{note}</p>
}

export function NeedsYouPanel() {
  const { data, error } = useNeedsYou()
  return (
    <Panel title={NEEDS_YOU_TITLE} value={data === null ? undefined : String(data.total)} live={(data?.total ?? 0) > 0}>
      <NeedsYouBody needs={data} error={error} />
    </Panel>
  )
}
