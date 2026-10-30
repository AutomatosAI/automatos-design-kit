/**
 * PRD-268 §6.11.4 (SDK 1.3.0): an approval card's `approval_view` (ApprovalView@1: who asked, the exact action, its
 * target, its preview and the rule that asked), read as core reads it. Not an SDK name.
 *
 * Mirrors core's frontend/lib/chat/approvals.ts approvalViewOf (at 1a8956c874dc42cff05b96f431c50b7d722a71aa): a view is
 * dropped, and the card stays as it was, when it isn't an object, when who asked, the action or the rule isn't what it
 * says, or when its grant_id isn't an id or isn't the card's own (a grant's number, or its Mission's id). A target or a
 * preview that isn't what it says is left out, the view kept. Only Refuse and Allow once are answers (Always allow is
 * not built). Pure.
 */
import type { ApprovalAnswer, ApprovalViewData } from '@automatos/theme-sdk'

type Fields = Readonly<Record<string, unknown>>

/** approvals.ts MISSION_ID: an id's own characters, a grant id's digits among them. */
const CARD_ID = /^[A-Za-z0-9_-]{1,128}$/
const ASKERS: ReadonlySet<string> = new Set(['auto', 'agent'])
const PREVIEW_KINDS: ReadonlySet<string> = new Set(['text', 'markdown', 'diff'])
const ANSWERS: ReadonlySet<string> = new Set<ApprovalAnswer>(['refuse', 'allow_once'])

function recordOf(value: unknown): Fields | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Fields) : null
}

function textOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function askedByOf(value: unknown): ApprovalViewData['asked_by'] | null {
  const fields = recordOf(value)
  const kind = textOf(fields?.kind)
  const name = textOf(fields?.name)
  if (kind === undefined || !ASKERS.has(kind) || name === undefined) return null
  return { kind: kind as ApprovalViewData['asked_by']['kind'], name }
}

function pairOf<A extends string, B extends string>(value: unknown, first: A, second: B): Readonly<Record<A | B, string>> | null {
  const fields = recordOf(value)
  const one = textOf(fields?.[first])
  const two = textOf(fields?.[second])
  return one !== undefined && two !== undefined ? ({ [first]: one, [second]: two } as Record<A | B, string>) : null
}

function targetOf(value: unknown): Pick<ApprovalViewData, 'target'> {
  const fields = recordOf(value)
  const label = textOf(fields?.label)
  return label === undefined ? {} : { target: { label, detail: textOf(fields?.detail) } }
}

function previewOf(value: unknown): Pick<ApprovalViewData, 'preview'> {
  const fields = recordOf(value)
  const kind = textOf(fields?.kind)
  const body = textOf(fields?.body)
  if (kind === undefined || !PREVIEW_KINDS.has(kind) || body === undefined) return {}
  return { preview: { kind: kind as NonNullable<ApprovalViewData['preview']>['kind'], body } }
}

function answersOf(value: unknown): ApprovalAnswer[] {
  const answers: readonly unknown[] = Array.isArray(value) ? value : []
  return answers.filter((answer): answer is ApprovalAnswer => typeof answer === 'string' && ANSWERS.has(answer))
}

/** approvals.ts approvalViewOf: the card's ApprovalView@1, checked, or undefined. Never mutates. */
export function approvalViewOf(value: unknown, cardId: string): ApprovalViewData | undefined {
  const fields = recordOf(value)
  const id = typeof fields?.grant_id === 'number' ? String(fields.grant_id) : textOf(fields?.grant_id)
  if (fields === null || id === undefined || !CARD_ID.test(id) || id !== cardId) return undefined
  const askedBy = askedByOf(fields.asked_by)
  const action = pairOf(fields.action, 'verb', 'summary')
  const rule = pairOf(fields.rule, 'id', 'sentence')
  if (askedBy === null || action === null || rule === null) return undefined
  const expiresAt = textOf(fields.expires_at)
  return Object.freeze({
    grant_id: id,
    asked_by: askedBy,
    action,
    ...targetOf(fields.target),
    ...previewOf(fields.preview),
    rule,
    answers: answersOf(fields.answers),
    ...(expiresAt === undefined ? {} : { expires_at: expiresAt }),
  })
}

/** approvals.ts viewField: `{ approval_view }` when the card carries a view that checks out, else nothing. */
export function viewField(value: unknown, cardId: string): { readonly approval_view?: ApprovalViewData } {
  const view = approvalViewOf(value, cardId)
  return view === undefined ? {} : { approval_view: view }
}
