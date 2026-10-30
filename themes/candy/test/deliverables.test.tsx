// Candy's Deliverables (/deliverables) on the harness's Deliverables fake, after Arcade's Inventory tests
// (themes/arcade/test/inventory.test.tsx): the shelf lists the host's Deliverables newest first as gradient tiles
// (each kind its card set), the pills count each kind and ask the host's list for one, the search box's words reach
// the list, a tile opens its sheet and Escape or Close puts the focus back on it, the loading, failure, empty and
// no-match states say so, Show more asks for the next page, and ?deliverable= and ?tab=outputs are this page. The
// rows are made up.
import type { Deliverable, DeliverableListResponse } from '@automatos/theme-sdk'
import { act, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'

import { FILTERS_LABEL, SEARCH_LABEL, SECTIONS_LABEL } from '../src/deliverables/controls.tsx'
import { BAD_LINK, DeliverablesPage } from '../src/deliverables/deliverables-page.tsx'
import { EMPTY_LINE, FAILED, GRID_LABEL, LOADING, MORE, RETRY, SHOW_ALL } from '../src/deliverables/results.tsx'
import { CLOSE, DOWNLOAD, DOWNLOAD_FAILED, EXPLORER } from '../src/deliverables/sheet.tsx'

// The search words reach the host after a pause and every answer lands on a later tick: give a loaded machine room.
configure({ asyncUtilTimeout: 3000 })

const STAMP = new Date().toISOString()
const CONTENT_URL = (id: string): string => `/api/workspaces/ws-harness/files/content?path=outputs%2F${id}.md`

function deliverable(id: string, title: string, artifactType: string, fields: Partial<Deliverable> = {}): Deliverable {
  return {
    id, workspace_id: 'ws-harness', source_type: 'mission', source_id: null, agent_id: null, agent_name: 'Quill', artifact_type: artifactType,
    title, summary: null, storage_type: 'workspace', file_path: `outputs/${id}.md`, file_name: null, file_type: 'md', file_size_bytes: null,
    preview_url: null, preview_type: null, extra: {}, status: 'active', created_at: STAMP, updated_at: STAMP, content: `# ${title}`,
    content_url: CONTENT_URL(id), ...fields,
  }
}

const ROWS: readonly Deliverable[] = [
  deliverable('d1', 'Laptop shortlist', 'report'),
  deliverable('d2', 'Chemistry revision plan', 'document'),
  deliverable('d3', 'Bake-sale poster', 'image', { file_type: 'png', file_path: 'outputs/d3.png', content: null }),
  deliverable('d4', 'Club budget', 'spreadsheet', { source_type: 'upload', agent_name: null, file_type: 'csv', content: 'a,b\n1,2' }),
  deliverable('d5', 'Assembly slides', 'slide'),
  deliverable('d6', 'Science fair recap', 'blog_post', { source_type: 'chat' }),
  deliverable('d7', 'Reading list', 'document'),
]

const shelf = (): HTMLElement => screen.getByRole('region', { name: GRID_LABEL })
const pills = (): HTMLElement => screen.getByRole('group', { name: FILTERS_LABEL })
const tile = (title: string): HTMLElement => within(shelf()).getByRole('link', { name: new RegExp(`^${title},`) })
const setOf = (element: HTMLElement): string | null => element.querySelector('[data-set]')?.getAttribute('data-set') ?? null
const tileTitles = (): string[] => within(shelf()).queryAllByRole('link').map((link) => link.getAttribute('aria-label')?.split(',')[0] ?? '')

/** One page the host's list asks its backend for. */
interface PageAsk {
  readonly offset: number
  readonly limit: number
}

/** The host's list over `rows`, failing while `failing()` says so. */
function backendOver(rows: readonly Deliverable[], failing: () => boolean): (ask: PageAsk) => DeliverableListResponse {
  return ({ offset, limit }) => (failing()
    ? { success: false, deliverables: [], total: 0, limit, offset, error: 'The list could not be read.' }
    : { success: true, deliverables: rows.slice(offset, offset + limit), total: rows.length, limit, offset })
}

beforeEach(() => {
  host.reset()
  host.setReducedMotion(true)
  host.setPathname('/deliverables')
})

describe('the shelf', () => {
  it("draws each Deliverable as a tile in its kind's gradient, with its word, title and line", async () => {
    host.setDeliverables(ROWS)
    render(<DeliverablesPage />)
    await within(shelf()).findAllByRole('link')
    const sets = ['Laptop shortlist', 'Chemistry revision plan', 'Bake-sale poster', 'Club budget', 'Assembly slides', 'Science fair recap'].map((title) => setOf(tile(title)))
    expect(sets).toEqual(['1', '2', '3', '2', '1', '3'])
    expect(tile('Laptop shortlist')).toHaveAttribute('href', '/deliverables?deliverable=d1')
    expect(within(tile('Science fair recap')).getByText('Blog post')).toBeInTheDocument()
    expect(within(tile('Laptop shortlist')).getByText('Quill · Mission · Today')).toBeInTheDocument()
    expect(within(tile('Club budget')).getByText('Upload · Today')).toBeInTheDocument()
  })

  it('counts every kind in its pill, in the design order, and asks the host for one kind under its pill', async () => {
    host.setDeliverables(ROWS)
    render(<DeliverablesPage />)
    await within(shelf()).findAllByRole('link')
    const labels = within(pills()).getAllByRole('button').map((pill) => pill.textContent)
    expect(labels).toEqual(['All 7', 'Reports 1', 'Documents 2', 'Images 1', 'Spreadsheets 1', 'Slides 1', 'Blog Posts 1'])
    expect(within(pills()).getByRole('button', { name: 'All 7' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(pills()).getByRole('button', { name: 'Documents 2' }))
    expect(within(pills()).getByRole('button', { name: 'Documents 2' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(tileTitles()).toEqual(['Chemistry revision plan', 'Reading list']))
    expect(host.deliverablesAsked().at(-1)?.filters?.artifact_type).toBe('document')
    expect(host.deliverablesAsked().at(-1)?.filters?.source_type_exclude).toEqual(['heartbeat'])
  })

  it("narrows the shelf and the counts to the search box's words, through the host's list", async () => {
    host.setDeliverables(ROWS)
    render(<DeliverablesPage />)
    await within(shelf()).findAllByRole('link')
    fireEvent.change(screen.getByRole('searchbox', { name: SEARCH_LABEL }), { target: { value: 'plan' } })
    await waitFor(() => expect(tileTitles()).toEqual(['Chemistry revision plan']))
    expect(host.deliverablesAsked().at(-1)?.filters?.search).toBe('plan')
    expect(within(pills()).getAllByRole('button').map((pill) => pill.textContent)).toEqual(['All 1', 'Documents 1'])
  })

  it('says when the search leaves nothing, and Show all brings every Deliverable back', async () => {
    host.setDeliverables(ROWS)
    render(<DeliverablesPage />)
    await within(shelf()).findAllByRole('link')
    fireEvent.change(screen.getByRole('searchbox', { name: SEARCH_LABEL }), { target: { value: 'zebra' } })
    expect(await within(shelf()).findByText('Nothing matches “zebra”.')).toBeInTheDocument()
    fireEvent.click(within(shelf()).getByRole('button', { name: SHOW_ALL }))
    await waitFor(() => expect(tileTitles()).toHaveLength(ROWS.length))
    expect(screen.getByRole('searchbox', { name: SEARCH_LABEL })).toHaveValue('')
  })

  it('asks for the next page with Show more, counting a kind as "24+" until every page is in', async () => {
    const many = Array.from({ length: 30 }, (_, index) => deliverable(`r${index}`, `Report ${index}`, 'report'))
    host.setDeliverables(many)
    render(<DeliverablesPage />)
    await within(shelf()).findAllByRole('link')
    expect(tileTitles()).toHaveLength(24)
    expect(within(pills()).getAllByRole('button').map((pill) => pill.textContent)).toEqual(['All 30', 'Reports 24+'])
    fireEvent.click(within(shelf()).getByRole('button', { name: MORE }))
    await waitFor(() => expect(tileTitles()).toHaveLength(30))
    expect(within(pills()).getByRole('button', { name: 'Reports 30' })).toBeInTheDocument()
    expect(within(shelf()).queryByRole('button', { name: MORE })).not.toBeInTheDocument()
  })

  it("links to the host's other sections of Deliverables and its Explorer", () => {
    render(<DeliverablesPage />)
    const links = within(screen.getByRole('navigation', { name: SECTIONS_LABEL })).getAllByRole('link')
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Blogs', '/deliverables?tab=blogs'],
      ['Templates', '/deliverables?tab=templates'],
      ['Brand kit', '/deliverables?tab=brand'],
      ['Explorer', '/deliverables/explorer'],
    ])
  })
})

describe('the states', () => {
  it('is busy with a line while the first page loads, and draws no tile', () => {
    host.setDeliverables(ROWS)
    render(<DeliverablesPage />)
    expect(shelf()).toHaveAttribute('aria-busy', 'true')
    expect(within(shelf()).getByRole('status')).toHaveTextContent(LOADING)
    expect(within(shelf()).queryAllByRole('link')).toHaveLength(0)
  })

  it('says the list failed, and Try again asks the host again', async () => {
    let failing = true
    host.setDeliverables(backendOver(ROWS, () => failing))
    render(<DeliverablesPage />)
    expect(await within(shelf()).findByRole('alert')).toHaveTextContent(FAILED)
    failing = false
    fireEvent.click(within(shelf()).getByRole('button', { name: RETRY }))
    await waitFor(() => expect(tileTitles()).toHaveLength(ROWS.length))
  })

  it('shows Auto and the way to the chat while there are no Deliverables', async () => {
    host.setDeliverables([])
    render(<DeliverablesPage />)
    expect(await within(shelf()).findByText(EMPTY_LINE)).toBeInTheDocument()
    expect(within(shelf()).getByRole('link', { name: 'Go to chat' })).toHaveAttribute('href', '/chat')
    expect(within(pills()).getAllByRole('button').map((pill) => pill.textContent)).toEqual(['All 0'])
  })
})

describe('one Deliverable', () => {
  it('opens its sheet from its tile with the content, and Escape puts the focus back on the tile', async () => {
    host.setDeliverables(ROWS)
    render(<DeliverablesPage />)
    const report = await within(shelf()).findByRole('link', { name: /^Laptop shortlist,/ })
    act(() => report.focus())
    fireEvent.click(report)
    const sheet = screen.getByRole('dialog', { name: 'Laptop shortlist' })
    expect(within(sheet).getByRole('heading', { name: 'Laptop shortlist' })).toHaveFocus()
    expect(await within(sheet).findByText('# Laptop shortlist')).toBeInTheDocument()
    expect(within(sheet).getByText('Quill')).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: EXPLORER })).toHaveAttribute('href', '/deliverables/explorer?path=outputs%2Fd1.md')
    expect(host.markdownViews().at(-1)?.skipHtml).toBe(true)
    expect(host.navigations()).toEqual([])
    fireEvent.keyDown(sheet, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(report).toHaveFocus()
  })

  it("downloads it with the host's download, and Close puts the focus back", async () => {
    host.setDeliverables(ROWS)
    render(<DeliverablesPage />)
    fireEvent.click(await within(shelf()).findByRole('link', { name: /^Club budget,/ }))
    const sheet = screen.getByRole('dialog', { name: 'Club budget' })
    fireEvent.click(await within(sheet).findByRole('button', { name: DOWNLOAD }))
    expect(host.downloadsAsked()).toEqual([
      { url: '/api/workspaces/ws-harness/files/raw?path=outputs%2Fd4.md', filename: 'd4.md', failedMessage: DOWNLOAD_FAILED },
    ])
    expect(within(sheet).getByRole('figure', { name: 'd4.md' })).toHaveTextContent('a,b')
    fireEvent.click(within(sheet).getByRole('button', { name: CLOSE }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(tile('Club budget')).toHaveFocus()
  })

  it("opens the Deliverable the host's link names, and closing it leaves the link", async () => {
    host.setDeliverables(ROWS)
    host.setSearchParams('deliverable=d2')
    render(<DeliverablesPage />)
    const sheet = await screen.findByRole('dialog', { name: 'Chemistry revision plan' })
    expect(await within(sheet).findByText('# Chemistry revision plan')).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('button', { name: CLOSE }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(host.navigations().at(-1)).toEqual({ method: 'replace', href: '/deliverables' })
  })

  it('shows the shelf with a quiet line for a link that names no Deliverable', async () => {
    host.setDeliverables(ROWS)
    host.setSearchParams('deliverable=../admin')
    render(<DeliverablesPage />)
    expect(screen.getByText(BAD_LINK)).toHaveAttribute('role', 'status')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await within(shelf()).findAllByRole('link')).toHaveLength(ROWS.length)
  })

  it("is still this page under the host's ?tab=outputs", async () => {
    host.setDeliverables(ROWS)
    host.setSearchParams('tab=outputs')
    render(<DeliverablesPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Deliverables' })).toBeInTheDocument()
    expect(await within(shelf()).findAllByRole('link')).toHaveLength(ROWS.length)
  })
})
