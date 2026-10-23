/**
 * PRD-261 B-02b: the fake of SDK area `pages/playbooks`. It mirrors core's
 * frontend/lib/theme-sdk/pages/playbooks.ts (at 101a0bf33f64fb4f89af81b4293415be60b661ac) in the page areas'
 * frozen views (src/internal/page-views.ts), with core's checks (:172-198, :240): a playbook is its template
 * id or its number; a read given a null id asks for nothing, one given a malformed id asks for nothing and says
 * so in `error`; an action given a malformed id, a body or inputs that are not plain objects throws a TypeError
 * (runAsync rejects) before anything is sent. Reads answer what a test set (host.setPageQuery), runs what it
 * set (host.setPageAction), each kept with the theme's arguments.
 */
import type {
  Playbook, PlaybookDeleted, PlaybookDraft, PlaybookFilters, PlaybookId, PlaybookList, PlaybookRunFilters, PlaybookRunInput,
  PlaybookRunList, PlaybookRunStarted, PlaybookSaved, PlaybookUpdateInput,
} from '@automatos/theme-sdk'
import { refuse } from '../internal/cell.ts'
import { usePageAction, usePageQuery } from '../internal/page-views.ts'

type Sdk = typeof import('@automatos/theme-sdk')

/** playbooks.ts:172-175. */
const PLAYBOOK_TEMPLATE_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,199}$/
const NOT_A_PLAYBOOK_ID = 'Not a playbook id.'
const NOT_A_BODY = 'A playbook body is a plain object.'
const NOT_INPUTS = "A run's inputs are a plain object."

/** playbooks.ts:182. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** playbooks.ts:187: a template id, or a whole number. */
function isPlaybookId(value: unknown): boolean {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0
  return typeof value === 'string' && PLAYBOOK_TEMPLATE_ID.test(value)
}

const isNone = (value: unknown): boolean => value === null || value === undefined
/** playbooks.ts:240: a malformed id's refusal, or null. */
const refusalOf = (value: unknown): string | null => (isNone(value) || isPlaybookId(value) ? null : NOT_A_PLAYBOOK_ID)
const checkedId = (value: PlaybookId): PlaybookId => (isPlaybookId(value) ? value : refuse(NOT_A_PLAYBOOK_ID))
const checkedObject = <T>(value: T, reason: string): T => (isPlainObject(value) ? value : refuse(reason))

const prepareCreate = (body: PlaybookDraft): PlaybookDraft => checkedObject(body, NOT_A_BODY)
const prepareUpdate = (input: PlaybookUpdateInput): PlaybookUpdateInput => ({ id: checkedId(input?.id), body: checkedObject(input?.body, NOT_A_BODY) })

function prepareRun(input: PlaybookRunInput): PlaybookRunInput {
  const id = checkedId(input?.id)
  if (input.inputs !== undefined) checkedObject(input.inputs, NOT_INPUTS)
  return { ...input, id }
}

/** playbooks.ts:263. */
export const useWorkflowPlaybooks = ((filters?: PlaybookFilters) =>
  usePageQuery<PlaybookList>('useWorkflowPlaybooks', [filters])) satisfies Sdk['useWorkflowPlaybooks']

/** playbooks.ts:268: a null id asks for nothing. */
export const useWorkflowPlaybook = ((playbookId: PlaybookId | null) =>
  usePageQuery<Playbook>('useWorkflowPlaybook', [playbookId], refusalOf(playbookId), isNone(playbookId))) satisfies Sdk['useWorkflowPlaybook']

/** playbooks.ts:274. */
export const usePlaybookExecutions = ((playbookId: PlaybookId | null, filters?: PlaybookRunFilters) =>
  usePageQuery<PlaybookRunList>('usePlaybookExecutions', [playbookId, filters], refusalOf(playbookId), isNone(playbookId))) satisfies Sdk['usePlaybookExecutions']

/** playbooks.ts:280. */
export const useCreatePlaybook = (() => usePageAction<PlaybookDraft, PlaybookSaved>('useCreatePlaybook', prepareCreate)) satisfies Sdk['useCreatePlaybook']

/** playbooks.ts:285. */
export const useUpdatePlaybook = (() => usePageAction<PlaybookUpdateInput, PlaybookSaved>('useUpdatePlaybook', prepareUpdate)) satisfies Sdk['useUpdatePlaybook']

/** playbooks.ts:290. */
export const useDeletePlaybook = (() => usePageAction<PlaybookId, PlaybookDeleted>('useDeletePlaybook', checkedId)) satisfies Sdk['useDeletePlaybook']

/** playbooks.ts:295. */
export const useExecutePlaybook = (() => usePageAction<PlaybookRunInput, PlaybookRunStarted>('useExecutePlaybook', prepareRun)) satisfies Sdk['useExecutePlaybook']
