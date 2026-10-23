/**
 * PRD-261 B-02c: stand-ins for SDK cards TaskCard, WithdrawOfferCard, MissionSuggestionCard and MissionCreatedCard.
 * They mirror core's frontend/lib/theme-sdk/host-cards/chat-cards.tsx (101a0bf33f64fb4f89af81b4293415be60b661ac),
 * which hands each payload to the chat's own card (components/chatbot/task-card.tsx, withdraw-offer-card.tsx,
 * mission-suggestion-card.tsx, mission-created-card.tsx): what each card says and its buttons, by the same names.
 * The buttons make no call; each click is kept (cardActions). Each root carries data-protected-surface.
 */
import { type ReactElement, useState } from 'react'
import { recordCardAction } from '../../internal/scripted/cards-log.ts'

type Sdk = typeof import('@automatos/theme-sdk')

/** components/chatbot/withdraw-offer-card.tsx and mission-suggestion-card.tsx: the cards' names and buttons. */
export const WITHDRAW_GROUP = 'Withdraw request'
export const WITHDRAW_LABEL = 'Withdraw'
export const KEEP_LABEL = 'Keep it'
export const WITHDRAWN_LINE = 'Withdrawn.'
export const KEPT_LINE = 'Kept.'
export const CREATE_MISSION_LABEL = 'Create Mission'
export const DISMISS_SUGGESTION_LABEL = 'Dismiss suggestion'
export const MISSION_CREATED_LINE = 'Mission created'
const TASK_PREFIX = 'Task'

/** cards.TaskCard: a ticket's number, title, status and agent. */
export const TaskCard: Sdk['TaskCard'] = function TaskCard({ card }) {
  const name = `${TASK_PREFIX} ${card.number ?? card.id}`
  return (
    <article data-protected-surface="task-card" aria-label={name}>
      <h4>{card.title}</h4>
      <p>{card.status}</p>
      <p>{card.assigned_agent}</p>
    </article>
  )
}

type WithdrawChoice = 'withdrawn' | 'kept'

const CHOICE_LINES: Readonly<Record<WithdrawChoice, string>> = Object.freeze({ withdrawn: WITHDRAWN_LINE, kept: KEPT_LINE })

interface WithdrawRowProps {
  readonly grantId: number
  readonly action: string
  readonly choice: WithdrawChoice | undefined
  readonly onChoice: (choice: WithdrawChoice) => void
}

function WithdrawRow({ grantId, action, choice, onChoice }: WithdrawRowProps): ReactElement {
  const choose = (picked: WithdrawChoice): void => {
    recordCardAction({ card: 'withdraw-offer', id: String(grantId), action: picked })
    onChoice(picked)
  }
  if (choice !== undefined) return <li>{CHOICE_LINES[choice]}</li>
  return (
    <li>
      <span>{action}</span>
      <button type="button" onClick={() => choose('withdrawn')}>
        {WITHDRAW_LABEL}
      </button>
      <button type="button" onClick={() => choose('kept')}>
        {KEEP_LABEL}
      </button>
    </li>
  )
}

/** cards.WithdrawOfferCard: the offer's words, then each request with Withdraw and Keep it. */
export const WithdrawOfferCard: Sdk['WithdrawOfferCard'] = function WithdrawOfferCard({ offer }) {
  const [choices, setChoices] = useState<Readonly<Record<number, WithdrawChoice>>>({})
  return (
    <div data-protected-surface="withdraw-offer" role="group" aria-label={WITHDRAW_GROUP}>
      <p>{offer.message}</p>
      <ul>
        {offer.requests.map((request) => (
          <WithdrawRow
            key={request.grant_id}
            grantId={request.grant_id}
            action={request.action ?? request.reason ?? ''}
            choice={choices[request.grant_id]}
            onChoice={(choice) => setChoices((known) => ({ ...known, [request.grant_id]: choice }))}
          />
        ))}
      </ul>
    </div>
  )
}

/**
 * cards.MissionSuggestionCard: the goal and its size, Create Mission, and a way to dismiss it. Its root is a plain
 * element with no landmark role or name, as core's components/chatbot/mission-suggestion-card.tsx draws it, so a
 * theme's own labelled section around it stays the one "Mission suggestion" region.
 */
export const MissionSuggestionCard: Sdk['MissionSuggestionCard'] = function MissionSuggestionCard({ goal, complexity, chatId }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return <></>
  return (
    <div data-protected-surface="mission-suggestion">
      <p>{goal}</p>
      <p>{complexity}</p>
      <button type="button" onClick={() => recordCardAction({ card: 'mission-suggestion', id: chatId, action: 'created' })}>
        {CREATE_MISSION_LABEL}
      </button>
      <button type="button" aria-label={DISMISS_SUGGESTION_LABEL} onClick={() => setDismissed(true)}>
        ×
      </button>
    </div>
  )
}

/** cards.MissionCreatedCard: the Mission the chat created. */
export const MissionCreatedCard: Sdk['MissionCreatedCard'] = function MissionCreatedCard({ missionId }): ReactElement {
  return (
    <div data-protected-surface="mission-created" role="status" data-mission-id={missionId}>
      {MISSION_CREATED_LINE}
    </div>
  )
}
