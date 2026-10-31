/**
 * PRD-261 B-02c: stand-ins for SDK cards ToolApproval and MissionApproval. They mirror core's
 * frontend/lib/theme-sdk/host-cards/approvals.tsx (101a0bf33f64fb4f89af81b4293415be60b661ac): the payload checked
 * as the chat checks it (lib/chat/approvals.ts; a TypeError when its id is not an id), chat.tsx's titles and badge,
 * and the two wrappers of a protected surface (components/theme-host/protected-surface.tsx: data-protected-surface
 * on the card's root, data-protected-surface-inner inside it). The buttons are the host widgets' (Approve & run and
 * Deny; Approve & run and Reject); they make no call: each click is kept (cardActions), a tool card then shows its
 * outcome and tells onDecided, and a Mission card closes itself (onClose), as core's do once the call went through.
 * SDK 1.3.0 (PRD-268 §6.11.4): a card whose payload carries `approval_view` (checked as core checks it,
 * src/internal/scripted/approval-view.ts) shows who asked, the action, its target, the preview and the rule before
 * its buttons, and answers keys 1 (Deny, Reject) and 3 (Approve & run) while it has focus (approval-view.tsx).
 */
import type { ApprovalDecision, CardOrigin } from '@automatos/theme-sdk'
import { type ReactElement, type ReactNode, useMemo, useState } from 'react'
import {
  MISSION_APPROVAL_TITLE,
  MISSION_SOURCE,
  missionCardOf,
  type MissionCard,
  TOOL_APPROVAL_TITLE,
  toolCardOf,
  type ToolCard,
  UNNAMED_ACTION,
} from '../../internal/scripted/approvals.ts'
import { type CardName, recordCardAction } from '../../internal/scripted/cards-log.ts'
import { ApprovalViewParts, useApprovalBody } from './approval-view.tsx'

type Sdk = typeof import('@automatos/theme-sdk')

/** The host widgets' buttons and outcome lines (components/widgets/ToolApprovalWidget, MissionApprovalWidget). */
export const APPROVE_LABEL = 'Approve & run'
export const DENY_LABEL = 'Deny'
export const REJECT_LABEL = 'Reject'
export const CLOSE_LABEL = 'Close'
export const APPROVED_LINE = 'Approved — the action ran.'
export const DENIED_LINE = 'Denied — the action will not run.'

const OUTCOME_LINES: Readonly<Record<ApprovalDecision, string>> = Object.freeze({ approved: APPROVED_LINE, denied: DENIED_LINE })

function rejected(card: string, what: string): TypeError {
  return new TypeError(`Automatos theme SDK: ${card} needs ${what}.`)
}

/** approvals.tsx:57: the tool card for `data`, or a TypeError without a whole-number grant id. */
function checkedToolCard(data: unknown): ToolCard {
  const card = toolCardOf(data)
  if (card === null) throw rejected('ToolApproval', 'a whole-number grant_id')
  return card
}

/** approvals.tsx:63: the Mission card for `data`, or a TypeError without a Mission id. */
function checkedMissionCard(data: unknown): MissionCard {
  const card = missionCardOf(data)
  if (card === null) throw rejected('MissionApproval', 'a mission_id of letters, digits, - and _')
  return card
}

interface SurfaceProps {
  readonly surface: CardName
  readonly title: string
  readonly origin: CardOrigin
  readonly badge: string
  readonly children: ReactNode
}

/** The card's two guarded wrappers, its title and its badge (where it came from). */
function ProtectedCard({ surface, title, origin, badge, children }: SurfaceProps): ReactElement {
  return (
    <section data-protected-surface={surface} aria-label={title} data-conversation-id={origin.conversationId}>
      <div data-protected-surface-inner="">
        <h3>{title}</h3>
        <p>{origin.source || badge}</p>
        {children}
      </div>
    </section>
  )
}

function CloseButton({ onClose }: { readonly onClose?: () => void }): ReactElement | null {
  return onClose === undefined ? null : (
    <button type="button" onClick={onClose}>
      {CLOSE_LABEL}
    </button>
  )
}

/** cards.ToolApproval: the grant's action and question, Approve & run and Deny, then the outcome. */
export const ToolApproval: Sdk['ToolApproval'] = function ToolApproval({ data, title = TOOL_APPROVAL_TITLE, onDecided, onClose, ...origin }) {
  const card = useMemo(() => checkedToolCard(data), [data])
  const [outcome, setOutcome] = useState<ApprovalDecision | null>(null)
  const decide = (decision: ApprovalDecision): void => {
    recordCardAction({ card: 'tool-approval', id: String(card.data.grant_id), action: decision })
    setOutcome(decision)
    onDecided?.(decision)
  }
  const view = card.data.approval_view
  const keys = { refuse: () => decide('denied'), allowOnce: () => decide('approved'), disabled: outcome !== null }
  const body = useApprovalBody(view, title, keys)
  return (
    <ProtectedCard surface="tool-approval" title={title} origin={origin} badge={card.data.action || UNNAMED_ACTION}>
      <div {...body.body}>
        {card.data.message ? <p>{card.data.message}</p> : null}
        {card.data.question_md ? <p>{card.data.question_md}</p> : null}
        {view ? <ApprovalViewParts view={view} ruleId={body.ruleId} /> : null}
        {outcome === null ? (
          <div>
            <button type="button" onClick={() => decide('approved')} {...body.allowOnceKey}>
              {APPROVE_LABEL}
            </button>
            <button type="button" onClick={() => decide('denied')} {...body.refuseKey}>
              {DENY_LABEL}
            </button>
          </div>
        ) : (
          <p role="status">{OUTCOME_LINES[outcome]}</p>
        )}
      </div>
      <CloseButton onClose={onClose} />
    </ProtectedCard>
  )
}

/** cards.MissionApproval: the plan's goal and tasks, Approve & run and Reject; the card closes after either. */
export const MissionApproval: Sdk['MissionApproval'] = function MissionApproval({ data, title = MISSION_APPROVAL_TITLE, onClose, ...origin }) {
  const card = useMemo(() => checkedMissionCard(data), [data])
  const decide = (decision: 'approved' | 'rejected'): void => {
    recordCardAction({ card: 'mission-approval', id: card.data.mission_id, action: decision })
    onClose?.()
  }
  const view = card.data.approval_view
  const body = useApprovalBody(view, title, { refuse: () => decide('rejected'), allowOnce: () => decide('approved'), disabled: false })
  return (
    <ProtectedCard surface="mission-approval" title={title} origin={origin} badge={MISSION_SOURCE}>
      <div {...body.body}>
        <p>{card.data.goal}</p>
        <ol>
          {card.data.tasks.map((task, index) => (
            <li key={`${index}-${task.title}`}>{task.title}</li>
          ))}
        </ol>
        {view ? <ApprovalViewParts view={view} ruleId={body.ruleId} /> : null}
        <button type="button" onClick={() => decide('approved')} {...body.allowOnceKey}>
          {APPROVE_LABEL}
        </button>
        <button type="button" onClick={() => decide('rejected')} {...body.refuseKey}>
          {REJECT_LABEL}
        </button>
      </div>
      <CloseButton onClose={onClose} />
    </ProtectedCard>
  )
}
