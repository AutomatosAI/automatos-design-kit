import {
  type Deliverable,
  DELIVERABLE_FEED_FILTERS,
  DELIVERABLES_HREF,
  type DeliverablesOptions,
  HostLink,
  useDeliverables,
} from '@automatos/theme-sdk'

import { Panel } from '../../components/panel'
import { deliverableHref, isDeliverableId } from '../deliverable-link'
import { deliverableTag, madeWhen } from './panel-rows'
import styles from './panels.module.css'

/**
 * DELIVERABLES (the design's right column): the newest three from the SDK's Deliverables feed (every Deliverable
 * but a heartbeat's), each its title linked to its page, and its type and when it was made; the header links to
 * the Deliverables page. The list can answer HTTP 200 with success: false (the design's ground rule), so that is
 * checked too. It asks again every minute, so what a turn makes shows up here.
 */

export const DELIVERABLES_TITLE = 'Deliverables'
export const ALL_DELIVERABLES = 'All'
/** How many Deliverables the panel lists. */
export const DELIVERABLES_SHOWN = 3
export const DELIVERABLES_LOADING = 'Loading the Deliverables…'
export const DELIVERABLES_FAILED = "Couldn't load the Deliverables."
export const NO_DELIVERABLES = 'No Deliverables yet.'

const REFRESH_MS = 60_000
const REFRESH: DeliverablesOptions = { refetchInterval: REFRESH_MS }

function DeliverableRow({ deliverable, now }: { readonly deliverable: Deliverable; readonly now: Date }) {
  const when = madeWhen(deliverable.created_at, now)
  const meta = when ? `${deliverableTag(deliverable)} · ${when}` : deliverableTag(deliverable)
  return (
    <li className={styles.deliverable}>
      {isDeliverableId(deliverable.id) ? (
        <HostLink href={deliverableHref(deliverable.id)} className={styles.deliverableTitle}>
          {deliverable.title}
        </HostLink>
      ) : (
        <span className={styles.deliverableTitle}>{deliverable.title}</span>
      )}
      <span className={styles.tag}>{meta}</span>
    </li>
  )
}

/** The panel's rows, or the note in their place: loading, a failure (a thrown one or success: false), or none. */
function DeliverablesBody({ rows, failed }: { readonly rows: readonly Deliverable[] | null; readonly failed: boolean }) {
  if (failed) return <p className={styles.note}>{DELIVERABLES_FAILED}</p>
  if (rows === null) return <p className={styles.note}>{DELIVERABLES_LOADING}</p>
  if (rows.length === 0) return <p className={styles.note}>{NO_DELIVERABLES}</p>
  const now = new Date()
  return (
    <ul className={styles.rows}>
      {rows.slice(0, DELIVERABLES_SHOWN).map((deliverable) => (
        <DeliverableRow key={deliverable.id} deliverable={deliverable} now={now} />
      ))}
    </ul>
  )
}

export function DeliverablesPanel() {
  const query = useDeliverables(DELIVERABLE_FEED_FILTERS, REFRESH)
  const page = query.data?.pages[0]
  const failed = (query.isError && page === undefined) || page?.success === false
  const all = (
    <HostLink href={DELIVERABLES_HREF} className={styles.headerLink}>
      {ALL_DELIVERABLES}
    </HostLink>
  )
  return (
    <Panel title={DELIVERABLES_TITLE} value={all}>
      <DeliverablesBody rows={page?.deliverables ?? null} failed={failed} />
    </Panel>
  )
}
