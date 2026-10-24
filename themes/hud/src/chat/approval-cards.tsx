import {
  type HostChatApproval,
  MissionApproval,
  type MissionApprovalData,
  ToolApproval,
  type ToolApprovalData,
} from '@automatos/theme-sdk'

import styles from './cards.module.css'

/**
 * The approvals a reply raised, inside Auto's reply (after Play's, themes/play/src/components/play/chat/
 * approval-cards.tsx, Play 1.1.1): the host's own cards (the SDK's ToolApproval and MissionApproval, protected
 * surfaces), so Approve & run, Deny and Reject are the host's calls, exactly as in Studio. HUD only places them, in
 * a plain column: nothing of HUD's is drawn over them, and no HUD rule reaches inside them. A tool card tells the
 * chat once it is answered (it then shows its outcome); the Mission card closes itself after a decision. A card
 * whose reply left the conversation (Try again, a request failing mid-turn, the conversation shown again) shows
 * after it until answered or closed: under "Approvals still open" while it waits, under "Approvals" once answered.
 */

export const APPROVALS_LABEL = 'Approvals'
/** The cards whose reply is no longer in the conversation and that still wait for the owner. */
export const LOOSE_APPROVALS_LABEL = 'Approvals still open'

function ApprovalCard({ approval }: { readonly approval: HostChatApproval }) {
  // Where the card came from: its conversation and when it was filed; the badge is the host's.
  const origin = { conversationId: approval.chatId || undefined, createdAt: approval.filedAt }
  if (approval.kind === 'mission') {
    return <MissionApproval data={approval.data as MissionApprovalData} onClose={approval.closed} {...origin} />
  }
  return (
    <ToolApproval
      data={approval.data as ToolApprovalData}
      onDecided={() => approval.answered()}
      onClose={approval.closed}
      {...origin}
    />
  )
}

export interface ApprovalCardsProps {
  readonly approvals: readonly HostChatApproval[]
}

/** The cards a reply raised, inside that reply. */
export function ApprovalCards({ approvals }: ApprovalCardsProps) {
  if (approvals.length === 0) return null
  return (
    <section className={styles.stack} aria-label={APPROVALS_LABEL}>
      {approvals.map((approval) => (
        <div key={approval.key} className={styles.hostCard}>
          <ApprovalCard approval={approval} />
        </div>
      ))}
    </section>
  )
}

/**
 * The cards whose reply left the conversation, after it. Each card is its own section, so answering renames the
 * section around it in place: a card moved into another section would mount afresh, and the tool card would drop
 * the outcome it shows and offer Approve & run again.
 */
export function LooseApprovalCards({ approvals }: ApprovalCardsProps) {
  if (approvals.length === 0) return null
  return (
    <div className={styles.stack}>
      {approvals.map((approval) => (
        <section
          key={approval.key}
          className={styles.hostCard}
          aria-label={approval.status === 'waiting' ? LOOSE_APPROVALS_LABEL : APPROVALS_LABEL}
        >
          <ApprovalCard approval={approval} />
        </section>
      ))}
    </div>
  )
}
