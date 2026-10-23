/**
 * PRD-261 B-02c: the fake Deliverables area (src/sdk/deliverables.ts) over its scripted backend and the fixtures
 * (fixtures/deliverables/*.json, fixtures/errors/404.json). useDeliverables pages by offset, filters as the backend
 * does, and throws a `success: false` page with the backend's words, as core's hooks/use-deliverables-api.ts does,
 * keeping the pages loaded before it. The host state it reads (the workspace, the health) is set through a mock of
 * src/internal/scripted/host-inputs.ts, so these tests need none of the host's controls.
 */
import type { Deliverable, DeliverableFilters, DeliverableListResponse, DeliverableQuery, DeliverablesQuery } from '@automatos/theme-sdk'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import failedFixture from '../fixtures/deliverables/failed.json'
import listFixture from '../fixtures/deliverables/list.json'
import notFoundFixture from '../fixtures/errors/404.json'
import { DELIVERABLES_PAGE_SIZE, LIST_FAILED, NETWORK_FAILED } from '../src/internal/scripted/deliverables-source.ts'
import {
  DELIVERABLE_FEED_FILTERS, DELIVERABLE_TAB_LABELS, deliverableDownloadUrl, deliverableFilename, deliverableFileUrl, deliverableLabel,
  deliverablesControls, fileDownloadUrl, resetDeliverables, useAuthenticatedBlobUrl, useDeliverable, useDeliverables, useFileDownload,
  visibleDeliverableTabs,
} from '../src/sdk/deliverables.ts'

const { deliverablesAsked, detailsAsked, downloadsAsked, setBlobUrls, setDeliverables, setDetail } = deliverablesControls

const inputs = vi.hoisted(() => ({ connection: 'connected' as 'connected' | 'down', signedIn: true }))

vi.mock('../src/internal/scripted/host-inputs.ts', () => ({
  CHAT_HREF: '/chat',
  useHealth: () => ({ connection: inputs.connection, checking: false, check: () => undefined }),
  useWorkspace: () => ({
    workspace: inputs.signedIn ? { id: 'ws-harness', name: 'Harness workspace', slug: 'harness', plan: 'pro', socialsAvailable: false } : null,
    isLoading: false,
  }),
  useHostSearchParams: () => new URLSearchParams(),
  useHostRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  useEdition: () => 'local',
  useTrial: () => null,
}))

const LIST: DeliverableListResponse = listFixture
const FAILED: DeliverableListResponse = failedFixture
const ALL: DeliverableFilters = { ...DELIVERABLE_FEED_FILTERS, source_type_exclude: null }
const TOTAL = 30
const REPORT = LIST.deliverables[0] as Deliverable

/** `count` rows like the fixture's report, d-0 to d-<count - 1>. */
function numbered(count: number): readonly Deliverable[] {
  return Array.from({ length: count }, (_, index) => ({ ...REPORT, id: `d-${index}`, title: `Deliverable ${index}` }))
}

function renderList(filters?: DeliverableFilters) {
  const onView = vi.fn<(query: DeliverablesQuery) => void>()
  function List() {
    onView(useDeliverables(filters))
    return null
  }
  render(<List />)
  const query = (): DeliverablesQuery => {
    const last = onView.mock.lastCall?.[0]
    if (last === undefined) throw new Error('The list has not rendered.')
    return last
  }
  return { query }
}

function renderDetail(id: string | null, includeContent?: boolean) {
  const onView = vi.fn<(query: DeliverableQuery) => void>()
  function Detail() {
    onView(useDeliverable(id, includeContent))
    return null
  }
  render(<Detail />)
  return { query: (): DeliverableQuery | undefined => onView.mock.lastCall?.[0] }
}

const ids = (query: DeliverablesQuery): string[] => (query.data?.pages ?? []).flatMap((page) => page.deliverables.map((row) => row.id))

beforeEach(() => {
  resetDeliverables()
  inputs.connection = 'connected'
  inputs.signedIn = true
})

describe('useDeliverables', () => {
  it('pages by offset: the first page, then Load more asks from where it ended, until the total', async () => {
    setDeliverables(numbered(TOTAL))
    const { query } = renderList()
    expect(query()).toMatchObject({ isLoading: true, data: undefined })
    await waitFor(() => expect(query().isLoading).toBe(false))
    expect(ids(query())).toHaveLength(DELIVERABLES_PAGE_SIZE)
    expect(query()).toMatchObject({ hasNextPage: true, isError: false })
    let result: unknown
    await act(async () => {
      result = await query().fetchNextPage()
    })
    expect(result).toEqual({ isError: false, error: null })
    expect(query().data?.pageParams).toEqual([0, DELIVERABLES_PAGE_SIZE])
    expect(query().data?.pages.map((page) => [page.offset, page.deliverables.length, page.total])).toEqual([
      [0, DELIVERABLES_PAGE_SIZE, TOTAL],
      [DELIVERABLES_PAGE_SIZE, TOTAL - DELIVERABLES_PAGE_SIZE, TOTAL],
    ])
    expect(query().hasNextPage).toBe(false)
  })

  it('filters by type, and the feed\'s filters leave a heartbeat\'s out; a list never carries a file\'s text', async () => {
    setDeliverables(LIST)
    const reports = renderList({ ...ALL, artifact_type: 'report' })
    await waitFor(() => expect(reports.query().isLoading).toBe(false))
    expect(ids(reports.query())).toEqual(['d-report-1', 'd-heartbeat-1'])
    const feed = renderList({ ...DELIVERABLE_FEED_FILTERS, artifact_type: 'report' })
    await waitFor(() => expect(feed.query().isLoading).toBe(false))
    expect(ids(feed.query())).toEqual(['d-report-1'])
    expect(feed.query().data?.pages[0]?.deliverables[0]).not.toHaveProperty('content')
    const tagged = renderList({ ...ALL, tag: 'SCRIPTS', search: 'sorter' })
    await waitFor(() => expect(tagged.query().isLoading).toBe(false))
    expect(ids(tagged.query())).toEqual(['d-code-1'])
    expect(deliverablesAsked().map((ask) => ask.filters?.artifact_type)).toContain('report')
  })

  it('throws a success: false page as core does: the backend\'s words, or core\'s own when it has none', async () => {
    setDeliverables(FAILED)
    const { query } = renderList()
    await waitFor(() => expect(query().isError).toBe(true))
    expect(query()).toMatchObject({ isLoading: false, data: undefined })
    expect((query().error as Error).message).toBe('The Deliverables list could not be read.')
    const { error: _words, ...wordless } = FAILED
    act(() => setDeliverables(() => wordless))
    const second = renderList()
    await waitFor(() => expect(second.query().isError).toBe(true))
    expect((second.query().error as Error).message).toBe(LIST_FAILED)
  })

  it('keeps the pages loaded before a page that failed', async () => {
    const rows = numbered(TOTAL)
    setDeliverables(({ offset, limit }) =>
      offset === 0 ? { success: true, deliverables: rows.slice(0, limit), total: TOTAL, limit, offset } : { ...FAILED, offset },
    )
    const { query } = renderList()
    await waitFor(() => expect(query().isLoading).toBe(false))
    let result: unknown
    await act(async () => {
      result = await query().fetchNextPage()
    })
    expect(result).toMatchObject({ isError: true })
    expect(query()).toMatchObject({ isError: true, isFetchingNextPage: false })
    expect(ids(query())).toHaveLength(DELIVERABLES_PAGE_SIZE)
  })

  it('stays loading, asking nothing, until the workspace is known; fails as a fetch while the backend is down', async () => {
    setDeliverables(LIST)
    inputs.signedIn = false
    const idle = renderList()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(idle.query()).toMatchObject({ isLoading: true, isError: false, data: undefined })
    inputs.signedIn = true
    inputs.connection = 'down'
    const down = renderList()
    await waitFor(() => expect(down.query().isError).toBe(true))
    expect(down.query().error).toBeInstanceOf(TypeError)
    expect((down.query().error as Error).message).toBe(NETWORK_FAILED)
  })

  it('hands back react-query\'s whole answer as it is when a test sets one', () => {
    const answer: DeliverablesQuery = {
      data: { pages: [LIST], pageParams: [0] }, isLoading: false, isError: false, error: null, hasNextPage: false, isFetchingNextPage: false,
      fetchNextPage: async () => undefined, refetch: async () => undefined,
    }
    setDeliverables(answer)
    const { query } = renderList(DELIVERABLE_FEED_FILTERS)
    expect(query()).toBe(answer)
    expect(deliverablesAsked()).toContainEqual({ filters: DELIVERABLE_FEED_FILTERS, options: undefined })
  })
})

describe('useDeliverable', () => {
  it('answers a row of the list, its text only when asked for its content; any other id is the backend\'s 404', async () => {
    setDeliverables(LIST)
    const withText = renderDetail('d-report-1', true)
    await waitFor(() => expect(withText.query()?.isLoading).toBe(false))
    expect(withText.query()?.data?.deliverable).toMatchObject({ id: 'd-report-1', content: REPORT.content })
    const without = renderDetail('d-report-1')
    await waitFor(() => expect(without.query()?.isLoading).toBe(false))
    expect(without.query()?.data?.deliverable).not.toHaveProperty('content')
    const missing = renderDetail('d-gone')
    await waitFor(() => expect(missing.query()?.isError).toBe(true))
    const error = missing.query()?.error as { readonly status?: number; readonly body?: unknown; readonly message?: string }
    expect([error.status, error.body, error.message]).toEqual([404, notFoundFixture, notFoundFixture.detail])
    expect(detailsAsked()).toContainEqual({ id: 'd-report-1', includeContent: true })
  })

  it('refuses an id that is not a Deliverable\'s at once, and is idle (loading) while the id is null', () => {
    const refused = renderDetail('../../admin?x=1')
    expect(refused.query()).toMatchObject({ isLoading: false, isError: true, data: undefined })
    expect((refused.query()?.error as Error).message).toBe('Not a Deliverable id')
    const idle = renderDetail(null)
    expect(idle.query()).toMatchObject({ isLoading: true, isError: false, data: undefined })
  })

  it('answers what a test set, whatever the id', () => {
    const found: DeliverableQuery = { data: { success: true, deliverable: REPORT }, isLoading: false, isError: false, error: null, refetch: async () => undefined }
    setDetail(found)
    expect(renderDetail('d-anything').query()).toBe(found)
  })
})

describe('files, tabs and names', () => {
  it('downloads keep each ask, and the authenticated picture answers what a test set', async () => {
    const onView = vi.fn<(src: string | null) => void>()
    setBlobUrls((url) => ({ src: url ? `blob:harness/${url.split('/').pop()}` : null, error: null }))
    function Files() {
      const { download } = useFileDownload()
      onView(useAuthenticatedBlobUrl('/api/deliverables/d-report-1/thumbnail').src)
      return <button type="button" onClick={() => void download('/api/x', 'x.md')}>Download</button>
    }
    const view = render(<Files />)
    expect(onView).toHaveBeenLastCalledWith('blob:harness/thumbnail')
    view.getByRole('button', { name: 'Download' }).click()
    await waitFor(() => expect(downloadsAsked()).toEqual([{ url: '/api/x', filename: 'x.md' }]))
  })

  it('names the file routes, the file, the tabs and the kinds as core does', () => {
    const content = '/api/workspaces/ws-harness/files/content?path=outputs%2Fa%20b.md'
    expect(fileDownloadUrl(content)).toBe('/api/workspaces/ws-harness/files/raw?path=outputs%2Fa%20b.md')
    expect(fileDownloadUrl('/api/other')).toBe('/api/other')
    expect(deliverableFileUrl({ content_url: null, preview_url: '/api/p.png' })).toBe('/api/p.png')
    expect(deliverableDownloadUrl({ content_url: content, preview_url: null })).toBe('/api/workspaces/ws-harness/files/raw?path=outputs%2Fa%20b.md')
    expect(deliverableDownloadUrl({ content_url: null, preview_url: null })).toBeNull()
    expect(deliverableFilename({ file_name: null, file_path: 'outputs/plan.md' })).toBe('plan.md')
    expect(deliverableFilename({ file_name: null, file_path: '' })).toBe('download')
    expect(visibleDeliverableTabs(false)).toEqual(['outputs', 'blogs', 'templates', 'brand'])
    expect(visibleDeliverableTabs(true)).toContain('socials')
    expect(DELIVERABLE_TAB_LABELS.brand).toBe('Brand kit')
    expect(deliverableLabel('blog_post')).toBe('Blog Posts')
    expect(deliverableLabel('toString')).toBe('toString')
    expect(Object.isFrozen(DELIVERABLE_FEED_FILTERS)).toBe(true)
  })
})
