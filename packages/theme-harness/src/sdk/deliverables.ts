/**
 * PRD-261 B-02c: the fake of SDK area `deliverables`. It mirrors core's frontend/lib/theme-sdk/deliverables.ts
 * (at 101a0bf33f64fb4f89af81b4293415be60b661ac) and the hooks it wraps: hooks/use-deliverables-api.ts:227
 * useDeliverables (react-query's infinite list, a page by offset, `success: false` thrown with the backend's
 * words so the last good pages stay, idle until the workspace is known) and :250 useDeliverable (idle while
 * the id is null, as react-query 4 is: loading, never an error), deliverables.ts:198 (an id that is not a
 * Deliverable's is a settled failure, never a request), lib/deliverables/download.ts and tabs.ts (the file
 * routes, the name, the tabs), components/icons/deliverable-icon.tsx (the kinds' names).
 *
 * The backend is scripted (src/internal/scripted/deliverables-source.ts): deliverablesControls, which host.ts
 * gathers, set what it answers (setDeliverables, setDetail, setBlobUrls) and read back every call (deliverablesAsked,
 * detailsAsked, downloadsAsked); resetDeliverables puts it back. A backend the host's health says is down fails each
 * ask as a fetch that can't connect. Every answer arrives on the next timer tick. Downloads are kept, with the words
 * the theme gave useFileDownload for a failure, and always succeed; the re-ask every `refetchInterval` ms runs whether
 * or not the tab is visible.
 */
import type {
  DeliverableDetailResponse,
  DeliverableFilters,
  DeliverableListResponse,
  DeliverableQuery,
  DeliverablesOptions,
  DeliverablesQuery,
  FileDownload,
} from '@automatos/theme-sdk'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  deliverablesAsked,
  DELIVERABLES_PAGE_SIZE,
  detailOf,
  detailsAsked,
  downloadsAsked,
  type DeliverablesBackend,
  type ListMode,
  LIST_FAILED,
  NETWORK_FAILED,
  recordDetailAsk,
  recordDownload,
  recordListAsk,
  resetDeliverablesSource,
  setBlobUrls,
  setDeliverables,
  setDetail,
  useBlobUrls,
  useDetailAnswer,
  useListMode,
} from '../internal/scripted/deliverables-source.ts'
import { useHealth, useWorkspace } from '../internal/scripted/host-inputs.ts'
import { nextTick } from '../internal/scripted/timing.ts'

type Sdk = typeof import('@automatos/theme-sdk')

/** hooks/use-deliverables-api.ts:114: every Deliverable. */
const DEFAULT_FILTERS: DeliverableFilters = Object.freeze({
  artifact_type: null,
  source_type: null,
  source_type_exclude: null,
  source_id: null,
  agent_id: null,
  date_range: 'all',
  search: '',
  tag: null,
})

/** deliverables.ts:147 over hooks/use-deliverables-api.ts:131: every Deliverable but a heartbeat's. */
export const DELIVERABLE_FEED_FILTERS: Sdk['DELIVERABLE_FEED_FILTERS'] = Object.freeze({
  ...DEFAULT_FILTERS,
  source_type_exclude: Object.freeze(['heartbeat']),
})

/** deliverables.ts:150 over lib/deliverables/tabs.ts:6. */
export const DELIVERABLE_TAB_LABELS: Sdk['DELIVERABLE_TAB_LABELS'] = Object.freeze({
  outputs: 'Outputs',
  blogs: 'Blogs',
  templates: 'Templates',
  brand: 'Brand kit',
  socials: 'Socials',
})

/** lib/chat/deliverables.ts:34: a Deliverable id. */
const DELIVERABLE_ID = /^[A-Za-z0-9_-]{1,128}$/
/** deliverables.ts:182: useDeliverable's error for an id that is not a Deliverable's. */
const NOT_A_DELIVERABLE_ID = 'Not a Deliverable id'

/** What fetchNextPage and refetch resolve with: react-query's result, as Play's shelf reads it (isError). */
interface PageResult {
  readonly isError: boolean
  readonly error: unknown
}

const PAGE_DONE: PageResult = Object.freeze({ isError: false, error: null })

const refusedResult = (error: unknown): PageResult => Object.freeze({ isError: true, error })

// ---- the pure helpers (lib/deliverables/download.ts, tabs.ts, deliverable-icon.tsx) ----

export {
  deliverableDownloadUrl,
  deliverableFilename,
  deliverableFileUrl,
  deliverableLabel,
  fileDownloadUrl,
  visibleDeliverableTabs,
} from '../internal/scripted/deliverable-files.ts'

// ---- the list (hooks/use-deliverables-api.ts:227) ----

interface ListState {
  readonly pages: readonly DeliverableListResponse[]
  readonly loading: boolean
  readonly failed: boolean
  readonly error: unknown
  readonly fetchingNext: boolean
}

type ListAction =
  | { readonly type: 'started' }
  | { readonly type: 'loaded'; readonly pages: readonly DeliverableListResponse[] }
  | { readonly type: 'failed'; readonly error: unknown }
  | { readonly type: 'fetching-next' }
  | { readonly type: 'appended'; readonly page: DeliverableListResponse }

const STARTED: ListState = Object.freeze({ pages: Object.freeze([]), loading: true, failed: false, error: null, fetchingNext: false })

function listReducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case 'started':
      return STARTED
    case 'loaded':
      return { pages: action.pages, loading: false, failed: false, error: null, fetchingNext: false }
    case 'failed':
      return { ...state, loading: false, failed: true, error: action.error, fetchingNext: false }
    case 'fetching-next':
      return { ...state, fetchingNext: true }
    case 'appended':
      return { pages: [...state.pages, action.page], loading: false, failed: false, error: null, fetchingNext: false }
    default:
      return state
  }
}

/** :238 getNextPageParam: the offset after the rows fetched so far, while the total says there are more. */
function nextOffset(page: DeliverableListResponse): number | undefined {
  const fetched = page.offset + page.deliverables.length
  return fetched < page.total ? fetched : undefined
}

/** :210 fetchListPage: one page, a success: false answer thrown with the backend's words. */
async function askPage(backend: DeliverablesBackend, filters: DeliverableFilters, offset: number, down: boolean): Promise<DeliverableListResponse> {
  await nextTick()
  if (down) throw new TypeError(NETWORK_FAILED)
  const page = backend({ filters, offset, limit: DELIVERABLES_PAGE_SIZE })
  if (page.success === false) throw new Error(page.error || LIST_FAILED)
  return page
}

/** A value the latest render saw, for the callbacks that run later. */
function useLatest<T>(value: T): { readonly current: T } {
  const box = useRef(value)
  box.current = value
  return box
}

function useMounted(): { readonly current: boolean } {
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  return mounted
}

/** react-query's refetchInterval: the loaded pages asked again every `ms`. */
function useRefetchEvery(ms: number | undefined, on: boolean, refetch: () => Promise<unknown>): void {
  useEffect(() => {
    if (!on || ms === undefined || ms <= 0) return undefined
    const timer = setInterval(() => {
      void refetch()
    }, ms)
    return () => clearInterval(timer)
  }, [ms, on, refetch])
}

function listQuery(state: ListState, enabled: boolean, actions: Pick<DeliverablesQuery, 'fetchNextPage' | 'refetch'>): DeliverablesQuery {
  const last = state.pages[state.pages.length - 1]
  const loaded = state.pages.length > 0
  const pageParams = Object.freeze(state.pages.map((page) => page.offset))
  return Object.freeze({
    data: loaded ? Object.freeze({ pages: state.pages, pageParams }) : undefined,
    isLoading: !enabled || (state.loading && !loaded),
    isError: state.failed,
    error: state.error,
    hasNextPage: last !== undefined && nextOffset(last) !== undefined,
    isFetchingNextPage: state.fetchingNext,
    ...actions,
  })
}

type ListDispatch = (action: ListAction) => void
type PageAsk = (offset: number) => Promise<DeliverableListResponse>

/** Load more and refetch over `ask`: a failed page keeps the pages loaded before it (P260-FX-12). */
function usePageActions(ask: PageAsk, now: { readonly current: ListState }, dispatch: ListDispatch) {
  const mounted = useMounted()
  const fetchNextPage = useCallback(async (): Promise<PageResult> => {
    const last = now.current.pages[now.current.pages.length - 1]
    const next = last === undefined ? undefined : nextOffset(last)
    if (next === undefined) return PAGE_DONE
    dispatch({ type: 'fetching-next' })
    try {
      const page = await ask(next)
      if (mounted.current) dispatch({ type: 'appended', page })
      return PAGE_DONE
    } catch (error) {
      if (mounted.current) dispatch({ type: 'failed', error })
      return refusedResult(error)
    }
  }, [ask, now, mounted, dispatch])
  const refetch = useCallback(async (): Promise<PageResult> => {
    const offsets = now.current.pages.length > 0 ? now.current.pages.map((page) => page.offset) : [0]
    try {
      const pages = await Promise.all(offsets.map((offset) => ask(offset)))
      if (mounted.current) dispatch({ type: 'loaded', pages: Object.freeze(pages) })
      return PAGE_DONE
    } catch (error) {
      if (mounted.current) dispatch({ type: 'failed', error })
      return refusedResult(error)
    }
  }, [ask, now, mounted, dispatch])
  return useMemo(() => ({ fetchNextPage, refetch }), [fetchNextPage, refetch])
}

/** The first page, on mount and again for each new filter, backend or workspace (the earlier pages dropped). */
function useFirstPage(ask: PageAsk, enabled: boolean, dispatch: ListDispatch): void {
  useEffect(() => {
    if (!enabled) return undefined
    let current = true
    dispatch({ type: 'started' })
    ask(0).then(
      (page) => current && dispatch({ type: 'loaded', pages: Object.freeze([page]) }),
      (error: unknown) => current && dispatch({ type: 'failed', error }),
    )
    return () => {
      current = false
    }
  }, [ask, enabled, dispatch])
}

/** The list over the scripted backend, as react-query's infinite query answers it. */
function useBackendList(mode: ListMode, filters: DeliverableFilters, options: DeliverablesOptions | undefined): DeliverablesQuery {
  const { workspace } = useWorkspace()
  const down = useLatest(useHealth().connection === 'down')
  const backend = mode.kind === 'backend' ? mode.backend : null
  const enabled = backend !== null && workspace !== null
  const [state, dispatch] = useReducer(listReducer, STARTED)
  const now = useLatest(state)
  const key = JSON.stringify(filters)
  const latestFilters = useLatest(filters)
  const ask = useCallback(
    (offset: number): Promise<DeliverableListResponse> =>
      backend === null ? Promise.reject(new Error(LIST_FAILED)) : askPage(backend, latestFilters.current, offset, down.current),
    [backend, key, workspace?.id, latestFilters, down],
  )
  useFirstPage(ask, enabled, dispatch)
  const actions = usePageActions(ask, now, dispatch)
  useRefetchEvery(options?.refetchInterval, enabled, actions.refetch)
  return useMemo(() => listQuery(state, enabled, actions), [state, enabled, actions])
}

/** deliverables.ts:163: the workspace's Deliverables, a page at a time; every call is kept (deliverablesAsked). */
export const useDeliverables: Sdk['useDeliverables'] = (filters, options) => {
  recordListAsk({ filters, options })
  const mode = useListMode()
  const query = useBackendList(mode, filters ?? DEFAULT_FILTERS, options)
  return mode.kind === 'answer' ? mode.answer : query
}

// ---- one Deliverable (hooks/use-deliverables-api.ts:250) ----

interface DetailState {
  readonly data: DeliverableDetailResponse | undefined
  readonly loading: boolean
  readonly error: unknown
  readonly failed: boolean
}

const DETAIL_STARTED: DetailState = Object.freeze({ data: undefined, loading: true, error: null, failed: false })
const settledDetail = (data: DeliverableDetailResponse): DetailState => Object.freeze({ data, loading: false, error: null, failed: false })
const failedDetail = (error: unknown): DetailState => Object.freeze({ data: undefined, loading: false, error, failed: true })

/** deliverables.ts:189 REFUSED_DELIVERABLE: an id that is not a Deliverable's, settled at once as a failure. */
const REFUSED_DELIVERABLE: DeliverableQuery = Object.freeze({
  data: undefined,
  isLoading: false,
  isError: true,
  error: Object.freeze(new Error(NOT_A_DELIVERABLE_ID)),
  refetch: async () => undefined,
})

/** react-query 4's disabled query (no id yet): loading, never an error. */
const IDLE_DETAIL: DeliverableQuery = Object.freeze({ data: undefined, isLoading: true, isError: false, error: null, refetch: async () => undefined })

/** GET /api/deliverables/<id>: from the rows the list was set with (a backend function has none: 404). */
async function askDetail(mode: ListMode, id: string, includeContent: boolean, down: boolean): Promise<DeliverableDetailResponse> {
  await nextTick()
  if (down) throw new TypeError(NETWORK_FAILED)
  return detailOf(mode.kind === 'backend' ? mode.rows : [], id, includeContent)
}

function useBackendDetail(id: string | null, includeContent: boolean, on: boolean): DeliverableQuery {
  const mode = useListMode()
  const { workspace } = useWorkspace()
  const down = useLatest(useHealth().connection === 'down')
  const enabled = on && workspace !== null && id !== null
  const [state, setState] = useState<DetailState>(DETAIL_STARTED)
  const mounted = useMounted()
  const load = useCallback(async (): Promise<PageResult> => {
    if (id === null) return PAGE_DONE
    try {
      const data = await askDetail(mode, id, includeContent, down.current)
      if (mounted.current) setState(settledDetail(data))
      return PAGE_DONE
    } catch (error) {
      if (mounted.current) setState(failedDetail(error))
      return refusedResult(error)
    }
  }, [mode, id, includeContent, workspace?.id, down, mounted])
  useEffect(() => {
    if (!enabled) return
    setState(DETAIL_STARTED)
    void load()
  }, [enabled, load])
  return useMemo(
    () => (enabled ? Object.freeze({ data: state.data, isLoading: state.loading, isError: state.failed, error: state.error, refetch: load }) : IDLE_DETAIL),
    [enabled, state, load],
  )
}

/** deliverables.ts:204: one Deliverable; an id that is not one never reaches the backend. Every call is kept. */
export const useDeliverable: Sdk['useDeliverable'] = (id, includeContent = false) => {
  recordDetailAsk({ id, includeContent })
  const answer = useDetailAnswer()
  const askable = typeof id === 'string' && DELIVERABLE_ID.test(id) ? id : null
  const query = useBackendDetail(askable, includeContent, answer === null)
  if (id !== null && askable === null) return REFUSED_DELIVERABLE
  if (answer !== null) return id === null ? IDLE_DETAIL : answer
  return query
}

// ---- files (hooks/use-api-file-download.ts, FilePreview's useAuthenticatedBlobUrl) ----

/** A download that keeps each file asked for, with the words a failure would show (none fails here). */
function fileDownload(failedMessage: string | undefined): FileDownload {
  const words = failedMessage === undefined ? {} : { failedMessage }
  return Object.freeze({
    download: async (url: string, filename: string) => {
      recordDownload({ url, filename, ...words })
    },
    downloading: false,
  })
}

/** deliverables.ts:212: each download kept with the theme's failure words (downloadsAsked), none in progress or failing. */
export const useFileDownload: Sdk['useFileDownload'] = (failedMessage) => useMemo(() => fileDownload(failedMessage), [failedMessage])

/** deliverables.ts:217: what the test's setBlobUrls answers for the file (by default no picture yet). */
export const useAuthenticatedBlobUrl: Sdk['useAuthenticatedBlobUrl'] = (url, forcedType) => useBlobUrls()(url, forcedType)

// ---- the controls (gathered by src/host.ts) ----

/** The controls of this area, gathered by host.ts: what the backend answers, and what the theme asked of it. */
export const deliverablesControls = Object.freeze({
  setDeliverables,
  deliverablesAsked,
  setDetail,
  detailsAsked,
  setBlobUrls,
  downloadsAsked,
})

/** The Deliverables backend as a test starts with it: an empty list, nothing asked, no pictures. */
export function resetDeliverables(): void {
  resetDeliverablesSource()
}

export type {
  BlobUrls,
  DeliverablesAsk,
  DeliverablesBackend,
  DeliverablesPageAsk,
  DeliverablesSource,
  DetailAsk,
  DownloadAsk,
  HttpError,
} from '../internal/scripted/deliverables-source.ts'
