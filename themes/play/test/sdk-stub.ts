// Stands in for the host's @automatos/theme-sdk in Play's tests (vitest.config.ts points the module
// name here): the host serves the real one through its import map, and the kit vendors its types only.
// It holds every SDK name a module the tests import reads; core's pure helpers are ported in
// test/support/sdk-ports.ts. Each stand-in names the core file and line it mirrors, in core's frontend/ at
// 0dd8b846e41772c8dd7ef159e4373bcb9419b06a. A test sets the host with the controls below: the files folder
// assetUrl answers from, the storage area's scope (test/storage-port.ts, core's storage area ported), the
// Deliverables list's answer and its pictures, one Deliverable's answer, the URL's query string, the
// backend's health, the workspace and the OS motion setting (window.matchMedia, as core reads it); and it
// reads back what Play asked of the host. resetStub puts every one back. The harness's SDK
// (packages/theme-harness, PRD-261 B-02b) replaces this file and test/support/sdk-ports.ts.
import type {
  AuthenticatedBlobUrl,
  DeliverableFilters,
  DeliverableQuery,
  DeliverablesOptions,
  DeliverablesQuery,
  DeliverableTab,
  FileDownload,
  HostHealth,
  HostLinkProps,
  HostStartChat,
  HostWorkspace,
  HostWorkspaceState,
} from '@automatos/theme-sdk'
import { createElement, forwardRef, useMemo, useSyncExternalStore } from 'react'
import { resetStorage } from './storage-port.ts'

export { readThemeState, removeThemeState, subscribeThemeState, THEME_STATE_LIMITS, writeThemeState } from './storage-port.ts'
export { changeInAnotherTab, resetStorage, setStorage, STORAGE_DEFAULTS, THEME_STATE_KEY_PREFIX } from './storage-port.ts'
export { deliverableDownloadUrl, deliverableFilename, deliverableFileUrl, fileDownloadUrl, liveReceiptsOf } from './support/sdk-ports.ts'

type Sdk = typeof import('@automatos/theme-sdk')

/** One value a stand-in hook reads; the components reading it render again when a test sets it. */
interface Cell<T> {
  readonly set: (next: T) => void
  readonly use: () => T
}

function cell<T>(initial: T): Cell<T> {
  let value = initial
  const listeners = new Set<() => void>()
  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
  const get = (): T => value
  return {
    set: (next) => {
      value = next
      Array.from(listeners).forEach((listener) => listener())
    },
    use: () => useSyncExternalStore(subscribe, get, get),
  }
}

// ---- assets (lib/theme-sdk/assets.ts) ----

let filesRoot: string | null = null
let asked: readonly string[] = []

/** The folder assetUrl puts in front of a path; null makes it answer null, as the host does when it knows no package. */
export function setFilesRoot(root: string | null): void {
  filesRoot = root
  asked = []
}

/** Every path assetUrl was asked for since the last setFilesRoot. */
export function askedPaths(): readonly string[] {
  return asked
}

export function assetUrl(path: string): string | null {
  asked = [...asked, path]
  return filesRoot === null ? null : `${filesRoot}${path}`
}

// ---- deliverables (lib/theme-sdk/deliverables.ts) ----

/** :147, the host's FEED_DEFAULT_FILTERS (hooks/use-deliverables-api.ts:126 and :142): every Deliverable but a heartbeat's. */
export const DELIVERABLE_FEED_FILTERS: DeliverableFilters = Object.freeze({
  artifact_type: null,
  source_type: null,
  source_type_exclude: Object.freeze(['heartbeat']),
  source_id: null,
  agent_id: null,
  date_range: 'all',
  search: '',
  tag: null,
})

/** :150, the host's TAB_LABELS (lib/deliverables/tabs.ts:6). */
export const DELIVERABLE_TAB_LABELS: Readonly<Record<DeliverableTab, string>> = Object.freeze({
  outputs: 'Outputs',
  blogs: 'Blogs',
  templates: 'Templates',
  brand: 'Brand kit',
  socials: 'Socials',
})

/** lib/deliverables/tabs.ts:2, in the strip's order. */
const DELIVERABLE_TABS: readonly DeliverableTab[] = Object.freeze(['outputs', 'blogs', 'templates', 'brand', 'socials'])

/** Each kind's name (components/icons/deliverable-icon.tsx:21-30), as :158 reads it. */
const KIND_LABELS: Readonly<Record<string, string>> = Object.freeze({
  report: 'Reports',
  image: 'Images',
  document: 'Documents',
  code: 'Code',
  slide: 'Slides',
  spreadsheet: 'Spreadsheets',
  blog_post: 'Blog Posts',
  video: 'Videos',
})

/** :153 over lib/deliverables/tabs.ts:25: Socials only while the platform offers it. */
export const visibleDeliverableTabs: Sdk['visibleDeliverableTabs'] = ((socialsAvailable) =>
  DELIVERABLE_TABS.filter((tab) => tab !== 'socials' || socialsAvailable))

/** :158: a kind's name ("Reports"); a kind the host has no name for is named as it is. */
export const deliverableLabel: Sdk['deliverableLabel'] = ((kind) =>
  Object.prototype.hasOwnProperty.call(KIND_LABELS, kind) ? KIND_LABELS[kind] : kind)

/** One call of useDeliverables: what Play asked the list for. */
export interface DeliverablesAsk {
  readonly filters: DeliverableFilters | undefined
  readonly options: DeliverablesOptions | undefined
}

type BlobUrls = (url: string | undefined, forcedType?: string) => AuthenticatedBlobUrl

/** react-query's answer before the first page: loading, nothing to ask for. */
const LOADING_LIST: DeliverablesQuery = Object.freeze({
  data: undefined,
  isLoading: true,
  isError: false,
  error: null,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: async () => undefined,
  refetch: async () => undefined,
})
const NO_PICTURE: BlobUrls = () => Object.freeze({ src: null, error: null })

const list = cell<DeliverablesQuery>(LOADING_LIST)
let listAsks: readonly DeliverablesAsk[] = []
let blobUrls: BlobUrls = NO_PICTURE

/** :163 (react-query's infinite list, hooks/use-deliverables-api.ts:227): the answer a test set; each call is kept. */
export const useDeliverables: Sdk['useDeliverables'] = ((filters, options) => {
  listAsks = [...listAsks, Object.freeze({ filters, options })]
  return list.use()
})

/** :178 (FilePreview's fetch with the caller's token): what the test's function answers for the file. */
export const useAuthenticatedBlobUrl: Sdk['useAuthenticatedBlobUrl'] = ((url, forcedType) => blobUrls(url, forcedType))

/** What useDeliverables answers from now on: react-query's result, with the test's own fetchNextPage and refetch. */
export function setDeliverables(answer: DeliverablesQuery): void {
  list.set(answer)
}

/** Every useDeliverables call since the last resetStub, oldest first. */
export function deliverablesAsked(): readonly DeliverablesAsk[] {
  return listAsks
}

/** How useAuthenticatedBlobUrl answers from now on (by default: no picture yet). */
export function setBlobUrls(answer: BlobUrls): void {
  blobUrls = answer
}

/** One call of useDeliverable: the id Play asked for, and whether with its content. */
export interface DetailAsk {
  readonly id: string | null
  readonly includeContent: boolean
}

/** One Deliverable before its answer (LOADING_DETAIL), and while its id is null (react-query's disabled query). */
const DETAIL_START = { data: undefined, isError: false, error: null, refetch: async () => undefined } as const
const LOADING_DETAIL: DeliverableQuery = Object.freeze({ ...DETAIL_START, isLoading: true })
const IDLE_DETAIL: DeliverableQuery = Object.freeze({ ...DETAIL_START, isLoading: false })

const detail = cell<DeliverableQuery>(LOADING_DETAIL)
let detailAsks: readonly DetailAsk[] = []

/** :168 (hooks/use-deliverables-api.ts:250, idle while the id is null): the answer a test set; each call is kept. */
export const useDeliverable: Sdk['useDeliverable'] = ((id, includeContent = false) => {
  detailAsks = [...detailAsks, Object.freeze({ id, includeContent })]
  const answer = detail.use()
  return id === null ? IDLE_DETAIL : answer
})

/** What useDeliverable answers from now on: react-query's result, with the test's own refetch. */
export function setDetail(answer: DeliverableQuery): void {
  detail.set(answer)
}

/** Every useDeliverable call since the last resetStub, oldest first. */
export function detailsAsked(): readonly DetailAsk[] {
  return detailAsks
}

/** One Download: the API path fetched with the caller's token, and the name it saves under. */
export interface DownloadAsk {
  readonly url: string
  readonly filename: string
}

let downloadAsks: readonly DownloadAsk[] = []

const FILE_DOWNLOAD: FileDownload = Object.freeze({
  download: async (url: string, filename: string) => {
    downloadAsks = [...downloadAsks, Object.freeze({ url, filename })]
  },
  downloading: false,
})

/** :173 (hooks/use-api-file-download.ts:20): each download kept, none ever in progress or failing. */
export const useFileDownload: Sdk['useFileDownload'] = (() => FILE_DOWNLOAD)

/** Every download Play asked for since the last resetStub, oldest first. */
export function downloadsAsked(): readonly DownloadAsk[] {
  return downloadAsks
}

// ---- navigation (lib/theme-sdk/navigation.tsx) ----

/** :24 and :25, lib/ticket-links.ts:53 and :55. */
export const DELIVERABLES_HREF = '/deliverables'
export const DELIVERABLE_PARAM = 'deliverable'
/** :35, lib/deliverables/tabs.ts:15. */
export const DELIVERABLE_EXPLORER_HREF = '/deliverables/explorer'
/** :23, lib/ticket-links.ts:50. */
export const CHAT_HREF = '/chat'

const search = cell<string>('')

/** :85 (the App Router's useSearchParams): a copy of the query string, a new one when the URL's query changes. */
export const useHostSearchParams: Sdk['useHostSearchParams'] = (() => {
  const query = search.use()
  return useMemo(() => new URLSearchParams(query), [query])
})

/** The URL's query string from now on, without its '?' ('' for none). */
export function setSearchParams(query: string): void {
  search.set(query)
}

/** internal/href.ts:11-42: a path inside the app, or https out of it, with no control character or whitespace. */
const INTERNAL_HREF = /^\/(?![/\\])/
const EXTERNAL_HREF = /^https:\/\/[^/\\\s]/i
const UNSAFE_CHAR = /[\u0000-\u001f\u007f\s]/
const BACKSLASH = '\\'
const EXTERNAL_TARGET = '_blank'
const EXTERNAL_REL = 'noopener noreferrer'

const isInternalHref = (href: string): boolean => INTERNAL_HREF.test(href) && !UNSAFE_CHAR.test(href) && !href.includes(BACKSLASH)
const isExternalHref = (href: string): boolean => EXTERNAL_HREF.test(href) && !UNSAFE_CHAR.test(href)

/** :91: the host's next/link (an <a>) for a path inside the app, a new tab for https, a TypeError for anything else. */
export const HostLink = forwardRef<HTMLAnchorElement, HostLinkProps>(function HostLink({ href, children, ...rest }, ref) {
  if (isInternalHref(href)) return createElement('a', { ...rest, ref, href }, children)
  if (isExternalHref(href)) return createElement('a', { ...rest, ref, href, target: EXTERNAL_TARGET, rel: EXTERNAL_REL }, children)
  throw new TypeError(`Automatos theme SDK: HostLink cannot link to "${String(href)}".`)
}) satisfies Sdk['HostLink']

// ---- context (lib/theme-sdk/context.ts) ----

/** The workspace a test starts in: fake data, Socials not offered. */
export const WORKSPACE_DEFAULTS: HostWorkspace = Object.freeze({
  id: 'workspace-1',
  name: 'Example workspace',
  slug: 'example',
  plan: 'pro',
  socialsAvailable: false,
})

const workspaceState = (workspace: HostWorkspace | null): HostWorkspaceState => Object.freeze({ workspace, isLoading: false })
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const CHECK_NOTHING = (): void => undefined

const workspace = cell<HostWorkspaceState>(workspaceState(WORKSPACE_DEFAULTS))
const connection = cell<HostHealth['connection']>('connected')

/** :81: the workspace as a theme sees it (the host's socials.available as socialsAvailable). */
export const useWorkspace: Sdk['useWorkspace'] = (() => workspace.use())

/** :137 (the host's GET /health, hooks/use-backend-health.ts): the connection a test set. */
export const useHealth: Sdk['useHealth'] = (() => {
  const now = connection.use()
  return useMemo(() => Object.freeze({ connection: now, checking: false, check: CHECK_NOTHING }), [now])
})

const hasMatchMedia = (): boolean => typeof window.matchMedia === 'function'

function subscribeReducedMotion(onChange: () => void): () => void {
  if (!hasMatchMedia()) return () => undefined
  const query = window.matchMedia(REDUCED_MOTION)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const reducedMotionNow = (): boolean => hasMatchMedia() && window.matchMedia(REDUCED_MOTION).matches

/** :146 over hooks/use-media-preferences.ts:12-28: the OS setting through matchMedia (jsdom has none: motion allowed). */
export const useMediaPreferences: Sdk['useMediaPreferences'] = (() => {
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionNow, () => true)
  return useMemo(() => Object.freeze({ reducedMotion }), [reducedMotion])
})

/** The workspace from now on: the defaults with these changes, or null (not loaded, or nobody signed in). */
export function setWorkspace(changes: Partial<HostWorkspace> | null): void {
  workspace.set(workspaceState(changes === null ? null : Object.freeze({ ...WORKSPACE_DEFAULTS, ...changes })))
}

/** Whether the backend answers, from now on. */
export function setHealth(next: HostHealth['connection']): void {
  connection.set(next)
}

// ---- chat (lib/theme-sdk/chat.ts) ----

let chatsStarted = 0

const START_CHAT: HostStartChat = Object.freeze({
  startChat: () => {
    chatsStarted += 1
  },
  ready: true,
})

/** :415 (the host's useStartChat: a fresh draft, then the chat page): ready, and each press counted. */
export const useStartChat: Sdk['useStartChat'] = (() => START_CHAT)

/** How many times Play started a chat since the last resetStub. */
export function startedChats(): number {
  return chatsStarted
}

// ---- cards (lib/theme-sdk/cards.ts) ----

/** :43 (host-cards/content.tsx:70, the host's sanitising react-markdown): the text as it is, read as no Markdown. */
export const MarkdownView: Sdk['MarkdownView'] = (({ children, className }) => createElement('div', { className }, children))

// ---- every control at once ----

/** The host as a test starts with it: each control's default, nothing asked, no theme state in the window's storage. */
export function resetStub(): void {
  resetStorage()
  setFilesRoot(null)
  list.set(LOADING_LIST)
  listAsks = []
  blobUrls = NO_PICTURE
  detail.set(LOADING_DETAIL)
  detailAsks = []
  downloadAsks = []
  search.set('')
  workspace.set(workspaceState(WORKSPACE_DEFAULTS))
  connection.set('connected')
  chatsStarted = 0
}
