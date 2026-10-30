/**
 * PRD-261 B-02b: the one way the harness's page areas (src/sdk/pages-*.ts) answer, as core's
 * frontend/lib/theme-sdk/internal/query-view.ts (at 101a0bf33f64fb4f89af81b4293415be60b661ac) does for core's:
 * a read is a frozen `{ data, isLoading, isFetching, error, refetch }` (:15) and a write a frozen
 * `{ run, runAsync, isRunning, error, result, reset }` (:24), the data and results deep, frozen copies (:77).
 * There is no backend: a read answers what a test set for its hook (host.setPageQuery; until then it is
 * loading, as before any answer), and a write resolves with what a test set (host.setPageAction; until then
 * null). Every read and every run is kept, with its arguments (host.pageAsks(), host.pageRuns()). SDK 1.3.0's
 * proactive area (src/sdk/proactive.ts) answers the same way; a read may also answer 'idle', no data and not loading,
 * as core's useBrief does while the host holds no brief for the day (the workspace's brief is off, or not opened yet).
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { log, refuse } from './cell.ts'

type Sdk = typeof import('@automatos/theme-sdk')

/** query-view.ts:15. */
export interface ThemeQuery<T> {
  readonly data: T | null
  readonly isLoading: boolean
  readonly isFetching: boolean
  readonly error: string | null
  readonly refetch: () => void
}

/** query-view.ts:24. */
export interface ThemeAction<V, R> {
  readonly run: (variables: V) => void
  readonly runAsync: (variables: V) => Promise<R>
  readonly isRunning: boolean
  readonly error: string | null
  readonly result: R | null
  readonly reset: () => void
}

/** The page areas' reads, by hook name. */
export type PageQueryHook =
  | 'useAgents' | 'useAgentStats'
  | 'useMissions' | 'useMission' | 'useMissionField' | 'useRecommendedAssignments'
  | 'useActivityFeed' | 'useActivityStats' | 'useActivitySchedule' | 'useQuestions' | 'useNeedsYou' | 'useWatches'
  | 'useDocuments' | 'useDocumentStats' | 'useTeams' | 'useDocumentTeamCounts' | 'useCloudConnections'
  | 'useWorkflowPlaybooks' | 'useWorkflowPlaybook' | 'usePlaybookExecutions'
  | 'useBrief' | 'useReadiness' | 'useSuggestions'

/** The page areas' writes, by hook name. */
export type PageActionHook =
  | 'useFieldQuery' | 'useApproveMission' | 'useRejectMission' | 'usePauseMission' | 'useResumeMission' | 'useCancelMission'
  | 'useReplanMission' | 'useRerunMission' | 'useSaveAsRoutine' | 'useUpdateMissionSettings'
  | 'useUploadDocument' | 'useDeleteDocument' | 'useTriggerSync' | 'useSelectRootFolder'
  | 'useCreatePlaybook' | 'useUpdatePlaybook' | 'useDeletePlaybook' | 'useExecutePlaybook'
  | 'useCheckReadiness' | 'useStartSuggestion' | 'useHideSuggestion' | 'useAnswerCalibration'

/** What a read's data is, as the SDK types it. */
export type PageData<K extends PageQueryHook> = NonNullable<ReturnType<Sdk[K]>['data']>
type ActionOf<K extends PageActionHook> = ReturnType<Sdk[K]>
/** What a write is handed, and what it resolves with, as the SDK types them. */
export type PageVariables<K extends PageActionHook> = Parameters<ActionOf<K>['run']>[0]
export type PageResult<K extends PageActionHook> = NonNullable<ActionOf<K>['result']>

/** How a read answers: its data, its error's message, still loading, or 'idle': asked nothing, no data and not loading. */
export type PageQueryAnswer<T> = { readonly data: T } | { readonly error: string } | 'loading' | 'idle'
/** How a write answers a run: its result (or a promise of it); a throw or a rejection is its error. */
export type PageActionAnswer<V, R> = (variables: V) => R | Promise<R>

/** One read a theme made: the hook and its arguments. */
export interface PageAsk {
  readonly hook: PageQueryHook
  readonly args: readonly unknown[]
}

/** One write a theme ran (or one database call of useDatabaseKnowledge): the hook and its variables. */
export interface PageRun {
  readonly hook: string
  readonly variables: unknown
}

const LOADING = 'loading'
const IDLE_ANSWER = 'idle'
const answers = new Map<string, PageQueryAnswer<unknown>>()
const actions = new Map<string, PageActionAnswer<unknown, unknown>>()
const asks = log<PageAsk>()
const runs = log<PageRun>()
const refetches = log<PageQueryHook>()
const listeners = new Set<() => void>()
let version = 0

function changed(): void {
  version += 1
  Array.from(listeners).forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const versionNow = (): number => version

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** query-view.ts:77: a deep, frozen copy of the lists and plain objects; any other value as it is. */
export function frozenCopy<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map((entry: unknown) => frozenCopy(entry))) as T
  if (!isPlainRecord(value)) return value
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, frozenCopy(entry)]))) as T
}

/** query-view.ts:65: an error as a theme sees it, its message. */
export function messageOf(error: unknown): string | null {
  if (error === null || error === undefined) return null
  return error instanceof Error ? error.message : String(error)
}

/** A read as the answer a test set makes it: loading until there is one. */
function viewOf<T>(answer: PageQueryAnswer<unknown> | undefined, refetch: () => void): ThemeQuery<T> {
  const loading = answer === undefined || answer === LOADING
  const data = typeof answer === 'object' && 'data' in answer ? frozenCopy(answer.data as T) : null
  const error = typeof answer === 'object' && 'error' in answer ? answer.error : null
  return Object.freeze({ data, isLoading: loading, isFetching: loading, error, refetch })
}

/**
 * query-view.ts:93: a read of `hook` with `args`; `refusal` (a malformed id) asks for nothing and is the error,
 * and `asksNothing` (a null id) asks for nothing and is not loading.
 */
export function usePageQuery<T>(hook: PageQueryHook, args: readonly unknown[], refusal: string | null = null, asksNothing = false): ThemeQuery<T> {
  const now = useSyncExternalStore(subscribe, versionNow, versionNow)
  const key = JSON.stringify(args)
  const idle = refusal !== null || asksNothing
  // A new read when its arguments change: the effect keeps the arguments of the render that changed them.
  useEffect(() => {
    if (!idle) asks.add(Object.freeze({ hook, args: frozenCopy(args) }))
  }, [hook, key, idle])
  const refetch = useCallback(() => refetches.add(hook), [hook])
  return useMemo(() => {
    const answer = answers.get(hook)
    if (idle || answer === IDLE_ANSWER) return Object.freeze({ data: null, isLoading: false, isFetching: false, error: refusal, refetch })
    return viewOf<T>(answer, refetch)
  }, [now, hook, idle, refusal, refetch])
}

interface RunState<R> {
  readonly isRunning: boolean
  readonly error: string | null
  readonly result: R | null
}

const IDLE: RunState<never> = Object.freeze({ isRunning: false, error: null, result: null })

/** The answer a test set for `hook`, run on `variables`; null until a test sets one. */
async function answerRun(hook: string, variables: unknown): Promise<unknown> {
  runs.add(Object.freeze({ hook, variables }))
  const answer = actions.get(hook)
  return frozenCopy(answer === undefined ? null : await answer(variables))
}

/** A write's variables as they are: the default check. */
function unchecked<V>(variables: V): V {
  return variables
}

/**
 * query-view.ts:115: a write of `hook`. `prepare` (module-level, or memoised on the hook's arguments) checks
 * the variables first: a refused `run` throws its TypeError, a refused `runAsync` rejects with it, and nothing
 * is sent. A failed run is the action's `error`; `runAsync` also rejects with it.
 */
export function usePageAction<V, R>(hook: PageActionHook, prepare: (variables: V) => V = unchecked): ThemeAction<V, R> {
  const [state, setState] = useState<RunState<R>>(IDLE)
  const start = useCallback((checked: V): Promise<R> => {
    setState({ isRunning: true, error: null, result: null })
    return answerRun(hook, checked).then(
      (result) => {
        setState({ isRunning: false, error: null, result: result as R })
        return result as R
      },
      (error: unknown) => {
        setState({ isRunning: false, error: messageOf(error), result: null })
        throw error
      },
    )
  }, [hook])
  const runAsync = useCallback((variables: V): Promise<R> => new Promise<V>((resolve) => resolve(prepare(variables))).then(start), [prepare, start])
  const run = useCallback((variables: V): void => {
    start(prepare(variables)).catch(() => undefined)
  }, [prepare, start])
  const reset = useCallback(() => setState(IDLE), [])
  return useMemo(() => Object.freeze({ run, runAsync, reset, ...state }), [run, runAsync, reset, state])
}

/** A database call of useDatabaseKnowledge, kept as a run and answered as one (hook 'useDatabaseKnowledge.<call>'). */
export function databaseCall<R>(call: string, variables: unknown, fallback: R): Promise<R> {
  const hook = `useDatabaseKnowledge.${call}`
  return answerRun(hook, variables).then((answer) => (actions.has(hook) ? (answer as R) : fallback))
}

/** A whole-number id, or a TypeError in the SDK's words. */
export function checkedWholeId(value: unknown, what: string): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : refuse(`${String(value)} is not a ${what} id.`)
}

/** The controls of the page areas, gathered by host.ts. */
export const pageControls = Object.freeze({
  /** How `hook`'s reads answer from now on: `{ data }`, `{ error }` (its message), 'loading' or 'idle' (no data, not loading). */
  setPageQuery<K extends PageQueryHook>(hook: K, answer: PageQueryAnswer<PageData<K>>): void {
    answers.set(hook, answer)
    changed()
  },
  /** How `hook`'s runs answer from now on: a function of the variables, whose throw or rejection is the error. */
  setPageAction<K extends PageActionHook>(hook: K, answer: PageActionAnswer<PageVariables<K>, PageResult<K>>): void {
    actions.set(hook, answer as PageActionAnswer<unknown, unknown>)
  },
  /** How one of useDatabaseKnowledge's calls answers ('createSource', 'executeQuery', …), as setPageAction. */
  setDatabaseCall(call: string, answer: PageActionAnswer<unknown, unknown>): void {
    actions.set(`useDatabaseKnowledge.${call}`, answer)
  },
  /** Every read a theme mounted since the last reset, oldest first (each argument change is a new read). */
  pageAsks(): readonly PageAsk[] {
    return asks.all()
  },
  /** Every write a theme ran since the last reset, oldest first. */
  pageRuns(): readonly PageRun[] {
    return runs.all()
  },
  /** Every refetch a theme asked for since the last reset, by hook. */
  pageRefetches(): readonly PageQueryHook[] {
    return refetches.all()
  },
})

export function resetPages(): void {
  answers.clear()
  actions.clear()
  asks.clear()
  runs.clear()
  refetches.clear()
  changed()
}
