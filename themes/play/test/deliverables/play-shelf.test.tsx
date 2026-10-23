// PRD-260 T-007a: Play's Deliverables shelf over the SDK's useDeliverables (PRD-261 A-14b). Moved from
// core's components/play/deliverables/__tests__/play-shelf.test.tsx and rewritten for the kit (PB-10):
// the SDK is the harness's fake (packages/theme-harness), whose useDeliverables answers what a test sets, as
// react-query would, and the shelf's seen record is kept in the SDK's storage area (lib/play/seen.ts).
// Every assertion of what Play renders is kept: the cards (title, type, date, the newest in the
// spotlight), the chips setting artifact_type, Load more asking for the next page, a card's link
// (?deliverable=<id>), the pictures through the host's authenticated path, the loading, empty and error
// states (a list answer of success: false included), Auto's caption, focus after the last Load more
// (P260-FX-22, M20), and the page's other sections. The kit adds the shelf switch (PlayShelf, K8, which
// core asserts in play-deliverable.test.tsx) on the fake host's query string. What core's real hook did
// under it (the offset on the wire, a success: false page thrown and its data kept, the re-ask every
// SHELF_REFRESH_MS) and what the host does with a card's link or Start a chat are core's to prove, and the
// ledger names those tests (test/moved-from-core/deliverables.json). Roles, attributes and text only (CSS
// modules are proxies). "Now" is pinned to a local date.
import { DELIVERABLE_FEED_FILTERS, DELIVERABLE_PARAM, type DeliverableQuery } from '@automatos/theme-sdk'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AutoMascotProps } from '../../src/components/mascot/auto-mascot.tsx'
import { BAD_LINK, FILTER_GROUP_LABEL, PlayShelf, SECTIONS_LABEL, SHELF_TITLE, ShelfScreen } from '../../src/components/play/deliverables/play-shelf.tsx'
import { MORE_FAILED, SHELF_FAILED } from '../../src/components/play/deliverables/shelf-body.tsx'
import { readSeen, writeSeen } from '../../src/lib/play/seen.ts'
import { SHELF_REFRESH_MS } from '../../src/lib/play/shelf.ts'
import { host } from '@automatos/theme-harness/host'
import { answer, at, numbered, page, PAGE_SIZE, ROWS } from '../support/deliverables.ts'

// Auto as his state and caption only, as core's test has him: data-state, and the caption as text.
vi.mock('../../src/components/mascot/auto-mascot.tsx', async () => {
  const { createElement } = await import('react')
  return {
    AutoMascot: ({ state, caption }: Pick<AutoMascotProps, 'state' | 'caption'>) =>
      createElement('div', { 'data-testid': 'auto', 'data-state': state }, caption),
  }
})

const NOW = new Date(2026, 9, 14, 15, 30) // Wed 14 Oct 2026, 15:30
const TOTAL = 30
/** What the hook throws for a list page that answered success: false: the backend's words, for the log only. */
const LIST_ERROR = new Error('list failed: relation v_workspace_outputs does not exist')

function renderShelf() {
  const user = userEvent.setup()
  const view = render(<ShelfScreen now={NOW} />)
  return { user, view }
}

function cards() {
  return within(screen.getByRole('list', { name: 'Deliverables' })).getAllByRole('link')
}

function lastAsk() {
  const asks = host.deliverablesAsked()
  return asks[asks.length - 1]
}

const lastFilters = () => lastAsk()?.filters
const auto = () => screen.getByTestId('auto')
const cardLink = (title: string) => screen.getByRole('heading', { name: title }).closest('a')

/** The '[shelf]' line the log got for a list that didn't load, with the error it carried. */
function shelfLogged(detail: string) {
  return [expect.stringContaining('[shelf]'), expect.objectContaining({ message: expect.stringContaining(detail) })]
}

/** The first page of TOTAL numbered Deliverables, and the last one. */
function twoPages() {
  const rows = numbered(TOTAL)
  return [page(rows.slice(0, PAGE_SIZE), TOTAL), page(rows.slice(PAGE_SIZE), TOTAL, PAGE_SIZE)] as const
}

beforeEach(() => {
  host.reset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ShelfScreen — the cards', () => {
  it("shows each Deliverable's title, type and date, the newest in the spotlight, from the feed's filters", () => {
    answer({ data: { pages: [page(ROWS)] } })
    renderShelf()

    expect(screen.getByRole('heading', { level: 1, name: 'Your shelf' })).toBeInTheDocument()
    expect(screen.getByText('4 Deliverables')).toBeInTheDocument()
    const [laptop, chem, poster, slides] = cards()
    expect(laptop).toHaveTextContent('Laptop shortlist')
    expect(laptop).toHaveTextContent('Newest')
    expect(laptop).toHaveTextContent('Report')
    expect(laptop).toHaveTextContent('Today')
    expect(chem).toHaveTextContent('Yesterday')
    expect(chem).not.toHaveTextContent('Newest')
    expect(poster).toHaveTextContent('Image')
    expect(poster).toHaveTextContent('Mon')
    expect(slides).toHaveTextContent('Slides')
    expect(slides).toHaveTextContent('4 Oct')
    expect(host.deliverablesAsked().map((ask) => ask.filters)).toContainEqual({ ...DELIVERABLE_FEED_FILTERS, artifact_type: null })
    expect(lastFilters()?.source_type_exclude).toEqual(['heartbeat'])
  })

  it('links each card to the core page of that Deliverable (K8)', () => {
    answer({ data: { pages: [page(ROWS)] } })
    renderShelf()
    expect(cards().map((card) => card.getAttribute('href'))).toEqual([
      '/deliverables?deliverable=d-laptop',
      '/deliverables?deliverable=d-chem',
      '/deliverables?deliverable=d-poster',
      '/deliverables?deliverable=d-slides',
    ])
  })

  it("loads each picture through the core's authenticated path: an image's preview, else the thumbnail", () => {
    const blobUrl = vi.fn((url: string | undefined) => ({ src: url ? `blob:core/${url.split('/').pop()}` : null, error: null }))
    host.setBlobUrls(blobUrl)
    answer({ data: { pages: [page(ROWS)] } })
    renderShelf()

    const asked = blobUrl.mock.calls.map(([url]) => url)
    expect(asked).toContain('/api/deliverables/d-laptop/thumbnail')
    expect(asked).toContain('/api/workspaces/files/poster.png')
    const thumbs = screen.getAllByTestId('shelf-thumb')
    expect(thumbs[0]).toHaveAttribute('data-kind', 'report')
    expect(thumbs[0]?.querySelector('img')).toHaveAttribute('src', 'blob:core/thumbnail')
    expect(thumbs[2]?.querySelector('img')).toHaveAttribute('src', 'blob:core/poster.png')
    expect(thumbs[1]?.querySelector('img')).toBeNull()
  })

  it('shows Auto proud of the count', () => {
    answer({ data: { pages: [page(ROWS)] } })
    renderShelf()
    expect(auto()).toHaveAttribute('data-state', 'idle')
    expect(auto()).toHaveTextContent('4 on the shelf. Nice collection!')
  })

  it('makes Auto celebrate a Deliverable this account has not seen in this workspace, and the host remembers it', () => {
    writeSeen({ ids: ['d-chem'], newest: at(13) })
    answer({ data: { pages: [page(ROWS.slice(0, 2))] } })
    renderShelf()
    expect(auto()).toHaveAttribute('data-state', 'celebrate')
    expect(auto()).toHaveTextContent('Your report is ready')
    expect(readSeen().record?.ids).toEqual(['d-chem', 'd-laptop'])
  })

  it('asks again every SHELF_REFRESH_MS while open: a new Deliverable lands as the Newest card and Auto celebrates it', () => {
    answer({ data: { pages: [page(ROWS.slice(1))] } })
    renderShelf()
    expect(lastAsk()?.options).toEqual({ refetchInterval: SHELF_REFRESH_MS })
    expect(cards()).toHaveLength(3)
    expect(cards()[0]).toHaveTextContent('Chemistry revision plan')
    expect(auto()).toHaveAttribute('data-state', 'idle')

    // A running Mission files a report while the shelf is open, and the next ask brings it.
    answer({ data: { pages: [page(ROWS)] } })
    const [newest] = cards()
    expect(newest).toHaveTextContent('Laptop shortlist')
    expect(newest).toHaveTextContent('Newest')
    expect(cards()).toHaveLength(4)
    expect(auto()).toHaveAttribute('data-state', 'celebrate')
    expect(auto()).toHaveTextContent('Your report is ready')
  })
})

describe('ShelfScreen — the chips', () => {
  it("sets the list's artifact_type from a chip, and All clears it", async () => {
    answer({ data: { pages: [page(ROWS)] } })
    const { user } = renderShelf()
    const chips = within(screen.getByRole('group', { name: FILTER_GROUP_LABEL }))
    expect(chips.getAllByRole('button').map((chip) => chip.textContent)).toEqual([
      'All',
      'Reports',
      'Documents',
      'Images',
      'Spreadsheets',
      'Slides',
    ])
    expect(chips.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(chips.getByRole('button', { name: 'Reports' }))
    expect(lastFilters()).toEqual({ ...DELIVERABLE_FEED_FILTERS, artifact_type: 'report' })
    expect(chips.getByRole('button', { name: 'Reports' })).toHaveAttribute('aria-pressed', 'true')
    expect(chips.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(chips.getByRole('button', { name: 'Slides' }))
    expect(lastFilters()?.artifact_type).toBe('slide')
    await user.click(chips.getByRole('button', { name: 'All' }))
    expect(lastFilters()).toEqual({ ...DELIVERABLE_FEED_FILTERS, artifact_type: null })
  })

  it('names the type in the empty state of a chip', async () => {
    answer({ data: { pages: [page([])] } })
    const { user } = renderShelf()
    await user.click(screen.getByRole('button', { name: 'Spreadsheets' }))
    expect(screen.getByText('No spreadsheets yet. Ask Auto for one and it lands here.')).toBeInTheDocument()
  })
})

describe('ShelfScreen — Load more', () => {
  it('asks the hook for the next page while there is one', async () => {
    const result = answer({ data: { pages: [page(ROWS, TOTAL)] }, hasNextPage: true })
    const { user } = renderShelf()
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(result.fetchNextPage).toHaveBeenCalledTimes(1)
  })

  it('shows no Load more on the last page, and a disabled one while the next is on its way', () => {
    answer({ data: { pages: [page(ROWS)] } })
    renderShelf()
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
    cleanup()
    answer({ data: { pages: [page(ROWS, TOTAL)] }, hasNextPage: true, isFetchingNextPage: true })
    renderShelf()
    expect(screen.getByRole('button', { name: 'Loading more…' })).toBeDisabled()
  })

  it('keeps the list and says so when Load more fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const result = answer({ data: { pages: [page(ROWS, TOTAL)] }, hasNextPage: true })
    result.fetchNextPage.mockResolvedValue({ isError: true, error: new Error('timeout') })
    const { user } = renderShelf()
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(MORE_FAILED)
    expect(cards()).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Load more' })).toBeEnabled()
  })

  it('keeps the list when the next page answers success: false (the hook throws it), and Load more asks again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const [first] = twoPages()
    const loaded = { pages: [first] }
    answer({ data: loaded, hasNextPage: true }).fetchNextPage.mockResolvedValue({ isError: true, error: LIST_ERROR })
    const { user } = renderShelf()
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(MORE_FAILED)

    // react-query keeps the page it has, and reports the error the hook threw.
    const failed = answer({ data: loaded, hasNextPage: true, isError: true, error: LIST_ERROR })
    expect(cards()).toHaveLength(PAGE_SIZE)
    expect(screen.getByText(`${TOTAL} Deliverables`)).toBeInTheDocument()
    expect(screen.queryByText(SHELF_FAILED)).toBeNull()
    expect(console.error).toHaveBeenCalledWith(...shelfLogged('v_workspace_outputs'))
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(failed.fetchNextPage).toHaveBeenCalledTimes(1)
  })

  it("asks for the next page under the chip, and shows it with no Load more once it is the last", async () => {
    const [first, last] = twoPages()
    const result = answer({ data: { pages: [first] }, hasNextPage: true })
    const { user } = renderShelf()
    await user.click(screen.getByRole('button', { name: 'Documents' }))
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(result.fetchNextPage).toHaveBeenCalledTimes(1)
    expect(lastFilters()).toEqual({ ...DELIVERABLE_FEED_FILTERS, artifact_type: 'document' })

    answer({ data: { pages: [first, last] } })
    expect(screen.getByRole('heading', { name: `Deliverable number ${TOTAL - 1}` })).toBeInTheDocument()
    expect(cards()).toHaveLength(TOTAL)
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  })
})

describe('ShelfScreen — Load more by keyboard (P260-FX-22, M20)', () => {
  it('the last Load more hands focus to the first card it brought', async () => {
    const [first, last] = twoPages()
    const result = answer({ data: { pages: [first] }, hasNextPage: true })
    const { user } = renderShelf()
    screen.getByRole('button', { name: 'Load more' }).focus()
    await user.keyboard('{Enter}')
    expect(result.fetchNextPage).toHaveBeenCalledTimes(1)

    answer({ data: { pages: [first] }, hasNextPage: true, isFetchingNextPage: true })
    answer({ data: { pages: [first, last] } })
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
    expect(cardLink(`Deliverable number ${PAGE_SIZE}`)).toHaveFocus()
    expect(cardLink(`Deliverable number ${PAGE_SIZE}`)).toHaveAttribute('href', `/deliverables?deliverable=d-${PAGE_SIZE}`)
    expect(document.activeElement).not.toBe(document.body)
  })
})

describe('ShelfScreen — loading, empty and error', () => {
  it('says it is loading before the first page', () => {
    answer({})
    renderShelf()
    expect(screen.getByRole('status')).toHaveTextContent('Loading your shelf')
    expect(auto()).toHaveTextContent('Fetching your shelf')
  })

  it('shows a friendly empty state with a way to start a chat', async () => {
    answer({ data: { pages: [page([])] } })
    const { user } = renderShelf()
    expect(screen.getByText(/Nothing on your shelf yet/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Start a chat' }))
    expect(host.startedChats()).toBe(1)
  })

  it('shows the error state when the list answers success: false, never the empty state or the backend text', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failed = answer({ isError: true, error: LIST_ERROR })
    const { user } = renderShelf()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(SHELF_FAILED)
    expect(document.body).not.toHaveTextContent('v_workspace_outputs')
    expect(screen.queryByText(/Nothing on your shelf yet/)).toBeNull()
    expect(console.error).toHaveBeenCalledWith(...shelfLogged('v_workspace_outputs'))
    expect(auto()).toHaveAttribute('data-state', 'oops')
    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(failed.refetch).toHaveBeenCalledTimes(1)
  })

  it('keeps the loaded cards when a refetch answers success: false: no error state, the log has why', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const loaded = { pages: [page(ROWS.slice(0, 2))] }
    answer({ data: loaded })
    renderShelf()
    expect(cards()).toHaveLength(2)

    answer({ data: loaded, isError: true, error: LIST_ERROR })
    expect(console.error).toHaveBeenCalledWith(...shelfLogged('v_workspace_outputs'))
    expect(cards()).toHaveLength(2)
    expect(screen.getByText('2 Deliverables')).toBeInTheDocument()
    expect(screen.queryByText(SHELF_FAILED)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows the error state when the request fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    answer({ isError: true })
    renderShelf()
    expect(screen.getByRole('alert')).toHaveTextContent(SHELF_FAILED)
  })

  it('lets Auto go back to the count once Try again loads the shelf, off oops (P260-FX-04)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failed = answer({ isError: true })
    const { user, view } = renderShelf()
    expect(auto()).toHaveAttribute('data-state', 'oops')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(failed.refetch).toHaveBeenCalledTimes(1)
    answer({ data: { pages: [page(ROWS)] } }) // the refetch answered
    view.rerender(<ShelfScreen now={NOW} />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(auto()).toHaveAttribute('data-state', 'idle')
    expect(auto()).toHaveTextContent('4 on the shelf. Nice collection!')
  })

  it('lets Auto sleep while the backend does not answer', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    host.setHealth('down')
    answer({ isError: true })
    renderShelf()
    expect(auto()).toHaveAttribute('data-state', 'sleeping')
  })
})

describe("ShelfScreen — the page's other sections", () => {
  it('links to the tabs and the explorer, Socials only while it is offered', () => {
    answer({ data: { pages: [page(ROWS)] } })
    renderShelf()
    const sections = within(screen.getByRole('navigation', { name: SECTIONS_LABEL }))
    expect(sections.getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Blogs', '/deliverables?tab=blogs'],
      ['Templates', '/deliverables?tab=templates'],
      ['Brand kit', '/deliverables?tab=brand'],
      ['Explorer', '/deliverables/explorer'],
    ])
    cleanup()
    host.setWorkspace({ socialsAvailable: true })
    renderShelf()
    expect(screen.getByRole('link', { name: 'Socials' })).toHaveAttribute('href', '/deliverables?tab=socials')
  })
})

describe('PlayShelf — the ?deliverable= switch (K8)', () => {
  it('shows the Deliverable a valid id names instead of the shelf; an id it refuses gets the shelf and a notice, never an ask', () => {
    const [laptop] = ROWS
    const found: DeliverableQuery = {
      data: { success: true, deliverable: { ...laptop, content: 'The short answer' } },
      isLoading: false, isError: false, error: null, refetch: vi.fn(async () => undefined),
    }
    host.setDetail(found)
    answer({ data: { pages: [page(ROWS)] } })
    host.setSearchParams(`${DELIVERABLE_PARAM}=${laptop.id}`)
    render(<PlayShelf />)
    expect(screen.getByRole('heading', { level: 1, name: 'Laptop shortlist' })).toBeInTheDocument()
    expect(screen.getByText('The short answer')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: SHELF_TITLE })).toBeNull()
    expect(host.detailsAsked()).toContainEqual({ id: laptop.id, includeContent: true })

    cleanup()
    const asked = host.detailsAsked().length
    host.setSearchParams(`${DELIVERABLE_PARAM}=${encodeURIComponent('../../admin?x=1')}`)
    render(<PlayShelf />)
    expect(screen.getByRole('heading', { level: 1, name: SHELF_TITLE })).toBeInTheDocument()
    expect(screen.getByText(BAD_LINK)).toBeInTheDocument()
    expect(host.detailsAsked()).toHaveLength(asked)
  })
})
