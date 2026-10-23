/**
 * PRD-261 B-02c: the approvals a turn raises, read as core reads them, for the fake chat (src/sdk/chat.ts) and
 * the ToolApproval and MissionApproval stand-ins (src/sdk/cards/approvals.tsx). Not an SDK name.
 *
 * Mirrors core's frontend/lib/chat/approvals.ts (101a0bf33f64fb4f89af81b4293415be60b661ac): a 'tool-data'
 * part's `tool_approval` (a grant waiting for the owner) and `mission_approval` (a Mission plan), each field
 * checked off the wire, the ids checked before they could reach a request path; a filed card keeps the reply
 * that raised it and whether the owner answered or closed it. Pure.
 */
import type { MissionApprovalData, MissionApprovalTask, OversightTier, ToolApprovalData } from '@automatos/theme-sdk'

/** approvals.ts:23-28: chat.tsx's card titles and badges. */
export const TOOL_APPROVAL_TITLE = 'Action approval needed'
export const MISSION_APPROVAL_TITLE = 'Mission plan — approval needed'
export const UNNAMED_ACTION = 'platform_action'
export const MISSION_SOURCE = 'platform_create_mission'

/** approvals.ts:31-34: a grant id is a whole number; a Mission id is an id's own characters. */
const GRANT_ID = /^\d{1,15}$/
const MISSION_ID = /^[A-Za-z0-9_-]{1,128}$/
const RISK_TIERS: ReadonlySet<string> = new Set(['monitor', 'human_on_the_loop', 'human_in_the_loop'])
const TOOL_DATA = 'tool-data'

export type ToolCard = { readonly kind: 'tool'; readonly key: string; readonly data: ToolApprovalData }
export type MissionCard = { readonly kind: 'mission'; readonly key: string; readonly data: MissionApprovalData }
export type ApprovalCard = ToolCard | MissionCard

/** waiting: not answered; answered: approved or denied (the card shows the outcome); closed: gone. */
export type ApprovalStatus = 'waiting' | 'answered' | 'closed'

export type FiledApproval = ApprovalCard & {
  readonly replyId: string
  readonly status: ApprovalStatus
  readonly filedAt: Date
}

type Fields = Readonly<Record<string, unknown>>
type Oversight = Pick<ToolApprovalData, 'risk_tier' | 'risk_class' | 'oversight_rationale' | 'requires_approval'>

function recordOf(value: unknown): Fields | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Fields) : null
}

function textOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function numberOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function flagOf(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function grantIdOf(value: unknown): number | null {
  const text = typeof value === 'number' ? String(value) : textOf(value)
  return text !== undefined && GRANT_ID.test(text) ? Number(text) : null
}

/** approvals.ts:65: the oversight fields both cards show, each only when it is what it says. */
function oversightOf(fields: Fields): Oversight {
  const tier = textOf(fields.risk_tier)
  return {
    risk_tier: tier !== undefined && RISK_TIERS.has(tier) ? (tier as OversightTier) : undefined,
    risk_class: textOf(fields.risk_class),
    oversight_rationale: textOf(fields.oversight_rationale),
    requires_approval: flagOf(fields.requires_approval),
  }
}

/** approvals.ts:75: a tool approval's card, or null when it carries no whole-number grant id. */
export function toolCardOf(value: unknown): ToolCard | null {
  const fields = recordOf(value)
  const grantId = grantIdOf(fields?.grant_id)
  if (fields === null || grantId === null) return null
  const question = fields.question_md
  const data: ToolApprovalData = {
    grant_id: grantId,
    action: textOf(fields.action) ?? '',
    message: textOf(fields.message),
    question_md: typeof question === 'string' || question === null ? question : undefined,
    permission_level: textOf(fields.permission_level),
    params: recordOf(fields.params) ?? undefined,
    ...oversightOf(fields),
  }
  return Object.freeze({ kind: 'tool', key: `tool-${grantId}`, data: Object.freeze(data) })
}

function taskOf(value: unknown): MissionApprovalTask | null {
  const fields = recordOf(value)
  const title = textOf(fields?.title)
  if (fields === null || title === undefined) return null
  return Object.freeze({
    title,
    agent_role: textOf(fields.agent_role),
    sequence: numberOf(fields.sequence),
    temp_id: textOf(fields.temp_id),
    match_agent: textOf(fields.match_agent),
    match_reason: textOf(fields.match_reason),
    match_is_override: flagOf(fields.match_is_override),
  })
}

/** approvals.ts:106: a Mission plan's card, or null when its mission_id is not an id. */
export function missionCardOf(value: unknown): MissionCard | null {
  const fields = recordOf(value)
  const missionId = textOf(fields?.mission_id)
  if (fields === null || missionId === undefined || !MISSION_ID.test(missionId)) return null
  const listed: readonly unknown[] = Array.isArray(fields.tasks) ? fields.tasks : []
  const tasks = listed.flatMap((task) => taskOf(task) ?? [])
  const data: MissionApprovalData = {
    mission_id: missionId,
    goal: textOf(fields.goal) ?? '',
    state: textOf(fields.state),
    task_count: numberOf(fields.task_count) ?? tasks.length,
    tasks: Object.freeze(tasks),
    cost_estimate_usd: numberOf(fields.cost_estimate_usd),
    cost_ceiling_usd: numberOf(fields.cost_ceiling_usd),
    approval_deadline_at: textOf(fields.approval_deadline_at),
    ...oversightOf(fields),
  }
  return Object.freeze({ kind: 'mission', key: `mission-${missionId}`, data: Object.freeze(data) })
}

/** approvals.ts:127: the cards a forwarded part raises; none for any other part. */
export function approvalsInPart(part: unknown): readonly ApprovalCard[] {
  const forwarded = recordOf(part)
  const data = recordOf(forwarded?.data)
  if (forwarded?.type !== TOOL_DATA || data === null) return []
  return [missionCardOf(data.mission_approval), toolCardOf(data.tool_approval)].flatMap((card) => (card === null ? [] : [card]))
}

/** approvals.ts:141: `filed` with the cards it doesn't hold yet, each under `replyId`, waiting. Never mutates. */
export function fileApprovals(
  filed: readonly FiledApproval[],
  raised: readonly ApprovalCard[],
  replyId: string,
  filedAt: Date,
): readonly FiledApproval[] {
  const known = new Set(filed.map((card) => card.key))
  const fresh = raised.filter((card) => !known.has(card.key))
  if (fresh.length === 0) return filed
  return [...filed, ...fresh.map((card): FiledApproval => Object.freeze({ ...card, replyId, status: 'waiting', filedAt }))]
}

/** approvals.ts:154: `filed` with one card's status changed (a closed card stays closed). Never mutates. */
export function withStatus(filed: readonly FiledApproval[], key: string, status: ApprovalStatus): readonly FiledApproval[] {
  const changes = (card: FiledApproval): boolean => card.key === key && card.status !== status && card.status !== 'closed'
  return filed.some(changes) ? filed.map((card) => (changes(card) ? Object.freeze({ ...card, status }) : card)) : filed
}

export function isWaitingCard(card: FiledApproval): boolean {
  return card.status === 'waiting'
}
