import { HostLink, type HostDeliverable } from '@automatos/theme-sdk'

import styles from './cards.module.css'
import { deliverableHref, isDeliverableId, KIND_WORDS } from './deliverable-link'

/**
 * The Deliverable Auto just made, inline in his reply (after Play's, themes/play/src/components/play/chat/
 * deliverable-card.tsx, Play 1.1.1): its type as a tag, its title, "just now", and Open, the host's page for it
 * (the SDK's HostLink). The id is checked once more before it goes into the link: a card with a bad id has no Open.
 */

export const JUST_NOW = 'just now'
export const OPEN = 'Open'

export function DeliverableCard({ deliverable }: { readonly deliverable: HostDeliverable }) {
  const href = isDeliverableId(deliverable.id) ? deliverableHref(deliverable.id) : null
  return (
    <article className={styles.deliverable} aria-label={`Deliverable: ${deliverable.title}`}>
      <div className={styles.deliverableText}>
        <h3 className={styles.deliverableTitle}>{deliverable.title}</h3>
        <p className={styles.deliverableMeta}>
          {KIND_WORDS[deliverable.kind]} · {JUST_NOW}
        </p>
      </div>
      {href && (
        <HostLink href={href} className={styles.primary} aria-label={`${OPEN} ${deliverable.title}`}>
          {OPEN}
        </HostLink>
      )}
    </article>
  )
}
