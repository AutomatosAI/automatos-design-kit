/**
 * PRD-268 §6.11.4 (SDK 1.3.0): the approval view on the ToolApproval and MissionApproval stand-ins, after core's
 * frontend/components/widgets/approval-view-parts.tsx (at 1a8956c874dc42cff05b96f431c50b7d722a71aa): who asked, the
 * action, its target, the exact preview (as text, whatever its kind) and the rule that asked, before the buttons and
 * inside the card's protected surface, with no data attribute of their own. While the card's body, or a control inside
 * it, has focus, 1 refuses and 3 allows once, each only when the view offers it (2 does nothing: Always allow is not
 * built), never a key typed into a field; the buttons announce their key. A card without a view is today's.
 */
import type { ApprovalAnswer, ApprovalViewData } from '@automatos/theme-sdk'
import { type HTMLAttributes, type KeyboardEvent, type ReactElement, useId } from 'react'

export const REFUSE_KEY = '1'
export const ALLOW_ONCE_KEY = '3'
export const ASKED_BY_LABEL = 'Asked by'
const TYPING_TAGS: ReadonlySet<string> = new Set(['INPUT', 'TEXTAREA', 'SELECT'])
const TYPING_ROLES: ReadonlySet<string> = new Set(['textbox', 'searchbox', 'combobox', 'spinbutton'])
const PREVIEW_STYLE = Object.freeze({ whiteSpace: 'pre-wrap' as const, overflowWrap: 'anywhere' as const, maxHeight: '160px', overflowY: 'auto' as const })

/** What the keys do: the buttons' own calls, and whether they may run now. */
export interface ApprovalKeys {
  readonly refuse: () => void
  readonly allowOnce: () => void
  readonly disabled: boolean
}

type ButtonKey = Pick<HTMLAttributes<HTMLButtonElement>, 'aria-keyshortcuts'>

export interface ApprovalBody {
  readonly ruleId: string
  readonly body: HTMLAttributes<HTMLDivElement>
  readonly refuseKey: ButtonKey
  readonly allowOnceKey: ButtonKey
}

function isTypingInto(target: EventTarget): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || TYPING_TAGS.has(target.tagName) || TYPING_ROLES.has(target.getAttribute('role') ?? '')
}

function answerFor(key: string, keys: ApprovalKeys, answers: readonly ApprovalAnswer[]): (() => void) | null {
  if (key === REFUSE_KEY && answers.includes('refuse')) return keys.refuse
  if (key === ALLOW_ONCE_KEY && answers.includes('allow_once')) return keys.allowOnce
  return null
}

/** approval-view-parts.tsx approvalKeyHandler. */
function keyHandler(keys: ApprovalKeys, answers: readonly ApprovalAnswer[]) {
  return (event: KeyboardEvent<HTMLElement>): void => {
    const plain = !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey
    if (keys.disabled || !plain || isTypingInto(event.target)) return
    const answer = answerFor(event.key, keys, answers)
    if (answer === null) return
    event.preventDefault()
    event.stopPropagation()
    answer()
  }
}

const keyOf = (view: ApprovalViewData | undefined, answer: ApprovalAnswer, key: string): ButtonKey =>
  view?.answers.includes(answer) ? { 'aria-keyshortcuts': key } : {}

/** approval-view-parts.tsx useApprovalCardBody: with a view, a focusable group named by the action and described by the rule. */
export function useApprovalBody(view: ApprovalViewData | undefined, title: string, keys: ApprovalKeys): ApprovalBody {
  const ruleId = useId()
  const buttons = { refuseKey: keyOf(view, 'refuse', REFUSE_KEY), allowOnceKey: keyOf(view, 'allow_once', ALLOW_ONCE_KEY) }
  if (view === undefined) return { ruleId, body: {}, ...buttons }
  const body: HTMLAttributes<HTMLDivElement> = {
    role: 'group', tabIndex: 0, 'aria-label': `${title}: ${view.action.summary}`, 'aria-describedby': ruleId, onKeyDown: keyHandler(keys, view.answers),
  }
  return { ruleId, body, ...buttons }
}

/** approval-view-parts.tsx ApprovalViewParts: who asked, the action, its target, the exact preview and the rule. */
export function ApprovalViewParts({ view, ruleId }: { readonly view: ApprovalViewData; readonly ruleId: string }): ReactElement {
  return (
    <div>
      <p>{ASKED_BY_LABEL} {view.asked_by.name} · {view.action.verb}</p>
      <p>{view.action.summary}</p>
      {view.target ? <p>→ {view.target.label}{view.target.detail ? ` · ${view.target.detail}` : ''}</p> : null}
      {view.preview ? <pre style={PREVIEW_STYLE}>{view.preview.body}</pre> : null}
      <p id={ruleId}>{view.rule.sentence}</p>
    </div>
  )
}
