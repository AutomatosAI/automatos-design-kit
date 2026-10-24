import { type HostChatMessage, TaskCard, WithdrawOfferCard } from '@automatos/theme-sdk'

import styles from './cards.module.css'

/**
 * The host's own cards a reply carries, inside Auto's reply, as the Studio chat shows them (after Play's,
 * themes/play/src/components/play/chat/reply-cards.tsx, Play 1.1.1): the withdraw offer (after a "no" in chat,
 * Withdraw denies the request still waiting on a yes, and the card then reads "Withdrawn."), and the tickets the
 * reply filed or checked, each the host's TaskCard, which follows the board and opens its ticket there. HUD only
 * places them.
 */

export const TICKETS_LABEL = 'Tickets'

export function ReplyCards({ message }: { readonly message: HostChatMessage }) {
  const { taskCards: tickets, withdrawOffer } = message
  if (!withdrawOffer && tickets.length === 0) return null
  return (
    <div className={styles.stack}>
      {withdrawOffer && (
        <div className={styles.hostCard}>
          <WithdrawOfferCard offer={withdrawOffer} />
        </div>
      )}
      {tickets.length > 0 && (
        <section className={styles.stack} aria-label={TICKETS_LABEL}>
          {tickets.map((card) => (
            <div key={card.id} className={styles.hostCard}>
              <TaskCard card={card} />
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
