/**
 * PRD-261 B-02c: the scripted backend behind the fake Deliverables area (src/sdk/deliverables.ts). Not an SDK name.
 *
 * A test sets what GET /api/deliverables answers (setDeliverables): Deliverables the fake filters and pages by
 * offset as the backend does (orchestrator/api/deliverables.py list_deliverables, the query core's
 * hooks/use-deliverables-api.ts:165 buildListQuery sends, core 101a0bf33f64fb4f89af81b4293415be60b661ac), a list
 * answer (fixtures/deliverables/*.json: one with success: false answers every page that way, as the backend's 200
 * failure does), a backend function of its own, or react-query's whole answer, which the hook hands back as it is.
 * One Deliverable comes from the same rows, a 404 for any other id (fixtures/errors/404.json is the body), unless
 * a test sets its answer (setDetail). It keeps what the theme asked for (each useDeliverables and useDeliverable
 * call, each download) and how the authenticated pictures answer (setBlobUrls). resetDeliverablesSource puts it back.
 */
import type {
  AuthenticatedBlobUrl,
  Deliverable,
  DeliverableDateRange,
  DeliverableDetailResponse,
  DeliverableFilters,
  DeliverableListResponse,
  DeliverableQuery,
  DeliverablesOptions,
  DeliverablesQuery,
} from '@automatos/theme-sdk'
import notFound from '../../../fixtures/errors/404.json'
import { cell, log } from '../cell.ts'

/** hooks/use-deliverables-api.ts:146: the rows one page holds. */
export const DELIVERABLES_PAGE_SIZE = 24
/** hooks/use-deliverables-api.ts:149: what a success: false page throws when it carries no words of its own. */
export const LIST_FAILED = 'The Deliverables list answered success: false.'
/** What a fetch that can't reach the backend throws in a browser (a TypeError): the backend down. */
export const NETWORK_FAILED = 'Failed to fetch'
/** orchestrator/api/deliverables.py:124: the status of a Deliverable the workspace doesn't hold. */
export const NOT_FOUND_STATUS = 404

/** One page the hook asks the backend for. */
export interface DeliverablesPageAsk {
  readonly filters: DeliverableFilters
  readonly offset: number
  readonly limit: number
}

export type DeliverablesBackend = (ask: DeliverablesPageAsk) => DeliverableListResponse
/** What setDeliverables takes: rows, a list answer, a backend, or react-query's whole answer. */
export type DeliverablesSource = readonly Deliverable[] | DeliverableListResponse | DeliverablesBackend | DeliverablesQuery

export type ListMode =
  | { readonly kind: 'backend'; readonly backend: DeliverablesBackend; readonly rows: readonly Deliverable[] }
  | { readonly kind: 'answer'; readonly answer: DeliverablesQuery }

/** One useDeliverables call: what the theme asked the list for. */
export interface DeliverablesAsk {
  readonly filters: DeliverableFilters | undefined
  readonly options: DeliverablesOptions | undefined
}

/** One useDeliverable call: the id asked for, and whether with its content. */
export interface DetailAsk {
  readonly id: string | null
  readonly includeContent: boolean
}

/** One Download: the API path, the name it saves under, and the theme's words for a failure (useFileDownload's). */
export interface DownloadAsk {
  readonly url: string
  readonly filename: string
  /** What a failed download would say; absent when the theme gave no words of its own (the host's default). */
  readonly failedMessage?: string
}

export type BlobUrls = (url: string | undefined, forcedType?: string) => AuthenticatedBlobUrl

/** The backend's error, as core's api-client.ts:1245 httpErrorOf throws it: the detail, the status, the body. */
export type HttpError = Error & { readonly status: number; readonly body: unknown }

const NO_ROWS: readonly Deliverable[] = Object.freeze([])
const NO_PICTURE: BlobUrls = () => Object.freeze({ src: null, error: null })
const DAY_START: readonly [number, number, number, number] = [0, 0, 0, 0]
const WEEK_DAYS = 7

/** hooks/use-deliverables-api.ts:156 dateRangeToFrom: the first moment a range takes in; null for all. */
function fromOf(range: DeliverableDateRange, now: Date): number | null {
  if (range === 'all') return null
  const from = new Date(now)
  if (range === 'today') from.setHours(...DAY_START)
  else if (range === 'week') from.setDate(now.getDate() - WEEK_DAYS)
  else from.setMonth(now.getMonth() - 1)
  return from.getTime()
}

function searched(row: Deliverable, search: string): boolean {
  const words = search.trim().toLowerCase()
  if (!words) return true
  return [row.title, row.summary ?? '', row.file_path].some((field) => field.toLowerCase().includes(words))
}

function tagged(row: Deliverable, tag: string | null | undefined): boolean {
  const wanted = tag?.trim().toLowerCase()
  return !wanted || (row.tags ?? []).some((own) => own.toLowerCase() === wanted)
}

/** orchestrator/api/deliverables.py:45-54: whether a row passes the list's filters. */
function matches(row: Deliverable, filters: DeliverableFilters, from: number | null): boolean {
  if (filters.artifact_type && row.artifact_type !== filters.artifact_type) return false
  if (filters.source_type && row.source_type !== filters.source_type) return false
  if (filters.source_type_exclude?.includes(row.source_type)) return false
  if (filters.source_id && row.source_id !== filters.source_id) return false
  if (filters.agent_id !== null && row.agent_id !== filters.agent_id) return false
  if (!searched(row, filters.search) || !tagged(row, filters.tag)) return false
  return from === null || Date.parse(row.created_at) >= from
}

/** A row as a list holds it: a file's text comes only with one Deliverable asked for its content. */
function listed(row: Deliverable): Deliverable {
  const { content: _content, content_url: _url, content_error: _error, content_truncated: _truncated, ...rest } = row
  return Object.freeze(rest)
}

/** The backend over `rows`, in the order given: the ones that pass the filters, one page from `offset`. */
export function rowsBackend(rows: readonly Deliverable[]): DeliverablesBackend {
  return ({ filters, offset, limit }) => {
    const from = fromOf(filters.date_range, new Date())
    const found = rows.filter((row) => matches(row, filters, from))
    const deliverables = Object.freeze(found.slice(offset, offset + limit).map(listed))
    return Object.freeze({ success: true, deliverables, total: found.length, limit, offset })
  }
}

function isRows(source: DeliverablesSource): source is readonly Deliverable[] {
  return Array.isArray(source)
}

function modeOf(source: DeliverablesSource): ListMode {
  if (isRows(source)) return Object.freeze({ kind: 'backend', backend: rowsBackend(source), rows: source })
  if (typeof source === 'function') return Object.freeze({ kind: 'backend', backend: source, rows: NO_ROWS })
  if ('fetchNextPage' in source) return Object.freeze({ kind: 'answer', answer: source })
  if (!source.success) return Object.freeze({ kind: 'backend', backend: () => source, rows: NO_ROWS })
  return Object.freeze({ kind: 'backend', backend: rowsBackend(source.deliverables), rows: source.deliverables })
}

const EMPTY: ListMode = modeOf(NO_ROWS)
const list = cell<ListMode>(EMPTY)
const detail = cell<DeliverableQuery | null>(null)
const blobUrls = cell<BlobUrls>(NO_PICTURE)
const listAsks = log<DeliverablesAsk>()
const detailAsks = log<DetailAsk>()
const downloadAsks = log<DownloadAsk>()

/** What GET /api/deliverables answers from now on (an empty list until a test sets it). */
export function setDeliverables(source: DeliverablesSource): void {
  list.set(modeOf(source))
}

export function useListMode(): ListMode {
  return list.use()
}

/** What useDeliverable answers from now on, whatever the id; null goes back to the rows. */
export function setDetail(answer: DeliverableQuery | null): void {
  detail.set(answer)
}

export function useDetailAnswer(): DeliverableQuery | null {
  return detail.use()
}

export function httpError(status: number, body: unknown): HttpError {
  const said = (body as { readonly detail?: unknown } | null)?.detail
  const message = typeof said === 'string' && said ? said : `HTTP ${status}`
  return Object.assign(new Error(message), { status, body })
}

/** GET /api/deliverables/<id>: the row (its content only when asked for), or the backend's 404. */
export function detailOf(rows: readonly Deliverable[], id: string, includeContent: boolean): DeliverableDetailResponse {
  const row = rows.find((candidate) => candidate.id === id)
  if (row === undefined) throw httpError(NOT_FOUND_STATUS, notFound)
  return Object.freeze({ success: true, deliverable: includeContent ? row : listed(row) })
}

/** How useAuthenticatedBlobUrl answers from now on (by default: no picture yet). */
export function setBlobUrls(answer: BlobUrls): void {
  blobUrls.set(answer)
}

export function useBlobUrls(): BlobUrls {
  return blobUrls.use()
}

export function recordListAsk(ask: DeliverablesAsk): void {
  listAsks.add(Object.freeze({ ...ask }))
}

export function recordDetailAsk(ask: DetailAsk): void {
  detailAsks.add(Object.freeze({ ...ask }))
}

export function recordDownload(ask: DownloadAsk): void {
  downloadAsks.add(Object.freeze({ ...ask }))
}

/** Every useDeliverables call since the last reset, oldest first. */
export function deliverablesAsked(): readonly DeliverablesAsk[] {
  return listAsks.all()
}

/** Every useDeliverable call since the last reset, oldest first. */
export function detailsAsked(): readonly DetailAsk[] {
  return detailAsks.all()
}

/** Every download since the last reset, oldest first. */
export function downloadsAsked(): readonly DownloadAsk[] {
  return downloadAsks.all()
}

/** The Deliverables backend as a test starts with it: an empty list, nothing asked, no pictures. */
export function resetDeliverablesSource(): void {
  list.set(EMPTY)
  detail.set(null)
  blobUrls.set(NO_PICTURE)
  listAsks.clear()
  detailAsks.clear()
  downloadAsks.clear()
}
