// The placement of the host's cards, after themes/arcade/src/chat/cards.tsx (Arcade 1.0.0), itself from HUD 1.1.2 and
// Play 1.1.1: the same cards and props, in Candy's words.
import {
  type HostChatApproval,
  type HostChatMessage,
  type HostMissionSuggestion,
  MissionApproval,
  type MissionApprovalData,
  MissionCreatedCard,
  MissionSuggestionCard,
  TaskCard,
  ToolApproval,
  type ToolApprovalData,
  WithdrawOfferCard,
} from '@automatos/theme-sdk'

import { recentMessages } from './reply'
import styles from './cards.module.css'
import ui from '../ui/ui.module.css'

/**
 * The host's own cards in the thread: an approval a reply raised (the SDK's ToolApproval and MissionApproval,
 * protected surfaces whose buttons make the host's calls), the withdraw offer and the tickets a reply carries, and a
 * Mission Auto suggests or created. Candy only places them: each sits in a host strip in Studio's own type, with a
 * small Candy label over it, nothing of Candy's drawn over it and no Candy rule reaching inside it.
 */

export const CHOICE_WAITING = 'Auto needs your answer'
export const CHOICE_MADE = 'You answered'
export const LOOSE_CHOICES = 'Still waiting for your answer'
export const TICKETS_LABEL = 'Tickets'
export const SUGGESTION_LABEL = 'Mission suggestion'
export const MISSION_CREATED_LABEL = 'Mission created'

function ApprovalCard({ approval }: { readonly approval: HostChatApproval }) {
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

/** One approval in its own section, so answering renames the section in place and never remounts the card. */
function Choice({ approval, waiting }: { readonly approval: HostChatApproval; readonly waiting: string }) {
  const open = approval.status === 'waiting'
  const heading = open ? waiting : CHOICE_MADE
  return (
    <section className={styles.choice} aria-label={heading}>
      <p className={styles.choiceHead} data-waiting={open ? 'true' : undefined}>
        <span aria-hidden="true">{open ? '! ' : '✓ '}</span>
        {heading}
      </p>
      <div className={`${ui.host} ${styles.hostCard}`}>
        <ApprovalCard approval={approval} />
      </div>
    </section>
  )
}

/** The approvals a reply raised, under the reply. */
export function Choices({ approvals }: { readonly approvals: readonly HostChatApproval[] }) {
  return (
    <>
      {approvals.map((approval) => (
        <Choice key={approval.key} approval={approval} waiting={CHOICE_WAITING} />
      ))}
    </>
  )
}

/** Approvals whose reply left the conversation (Try again, a failed request), after it. */
export function LooseChoices({ approvals }: { readonly approvals: readonly HostChatApproval[] }) {
  return (
    <>
      {approvals.map((approval) => (
        <Choice key={approval.key} approval={approval} waiting={LOOSE_CHOICES} />
      ))}
    </>
  )
}

/** The withdraw offer and the tickets a reply carries: the host's WithdrawOfferCard and TaskCard. */
export function ReplyCards({ message }: { readonly message: HostChatMessage }) {
  const { taskCards: tickets, withdrawOffer } = message
  if (!withdrawOffer && tickets.length === 0) return null
  return (
    <div className={styles.cardStack}>
      {withdrawOffer && (
        <div className={`${ui.host} ${styles.hostCard}`}>
          <WithdrawOfferCard offer={withdrawOffer} />
        </div>
      )}
      {tickets.length > 0 && (
        <section className={styles.cardStack} aria-label={TICKETS_LABEL}>
          {tickets.map((card) => (
            <div key={card.id} className={`${ui.host} ${styles.hostCard}`}>
              <TaskCard card={card} />
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

export interface MissionCardsProps {
  readonly suggestion: HostMissionSuggestion | null
  readonly planningMissionId: string | null
  readonly chatId: string
  readonly messages: readonly HostChatMessage[]
}

/** A Mission Auto suggests (the host's MissionSuggestionCard), or the one the chat created (MissionCreatedCard). */
export function MissionCards({ suggestion, planningMissionId, chatId, messages }: MissionCardsProps) {
  if (planningMissionId) {
    return (
      <section className={`${ui.host} ${styles.hostCard}`} aria-label={MISSION_CREATED_LABEL}>
        <MissionCreatedCard missionId={planningMissionId} />
      </section>
    )
  }
  if (!suggestion) return null
  return (
    <section className={`${ui.host} ${styles.hostCard}`} aria-label={SUGGESTION_LABEL}>
      <MissionSuggestionCard
        goal={suggestion.goal}
        complexity={suggestion.complexity}
        agentId={suggestion.agentId}
        chatId={chatId}
        recentMessages={recentMessages(messages)}
      />
    </section>
  )
}
