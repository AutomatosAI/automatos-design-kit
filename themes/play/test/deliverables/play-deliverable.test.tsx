// PRD-260 T-007b, K8: Play's page for one Deliverable at the host's /deliverables?deliverable=<id>. Moved from core's
// components/play/deliverables/__tests__/play-deliverable.test.tsx and rewritten for the kit's harness: the SDK's
// useDeliverable answers what a test sets on the fake host (host.setDetail), as react-query would, or from the
// scripted backend's rows (host.setDeliverables: the content only when asked for, a 404 for any other id); the query
// string, the pictures and the downloads are the fake host's too. Every assertion of what Play renders is kept: the
// title, type, date and Made by, the side panel's facts and Sources, Ask Auto about this, the picture, the video and
// the file card, Download's file and words, opening, not on your shelf (one status line, P260-FX-24, M22), couldn't
// open with Try again, and the shelf switch. The host's MarkdownView is a stand-in that shows its text as it is, so
// the sheet's cases assert the text and the props Play hands it (host.markdownViews()) and Play's own element rules
// on their own. What the host does under them (the request on the wire, the download's routes and token, the
// renderer, DeliverableDeepLink in the host's layout) is core's to prove; test/moved-from-core/deliverables.json names
// those tests. Roles, attributes and text only (CSS modules are proxies). "Now" is pinned to a local date.
import type { Deliverable, DeliverableDetailResponse, DeliverableQuery, MarkdownViewProps } from '@automatos/theme-sdk'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PLAY_MARKDOWN_COMPONENTS } from '../../src/components/play/chat/play-markdown.tsx'
import { DOWNLOAD_FILE, PICTURE_FAILED, TRUNCATED, UNREADABLE } from '../../src/components/play/deliverables/deliverable-content.tsx'
import { ABOUT, ASK_AUTO, DOWNLOAD, SOURCES } from '../../src/components/play/deliverables/detail-panel.tsx'
import { NOT_ON_SHELF, OPENING, OPEN_FAILED, PlayDeliverable, TRY_AGAIN } from '../../src/components/play/deliverables/play-deliverable.tsx'
import { BAD_LINK, PlayShelf } from '../../src/components/play/deliverables/play-shelf.tsx'
import { askAboutText } from '../../src/lib/play/detail.ts'
import { DRAFT_PARAM } from '../../src/lib/play/draft.ts'
import { DOWNLOAD_FAILED } from '../../src/lib/play/shelf.ts'
import { host } from '@automatos/theme-harness/host'
import { row } from '../support/deliverables.ts'

// Auto as his state only, as core's test has him.
vi.mock('../../src/components/mascot/auto-mascot.tsx', async () => {
  const { createElement } = await import('react')
  return { AutoMascot: ({ state }: { readonly state: string }) => createElement('div', { 'data-testid': 'auto', 'data-state': state }) }
})

const NOW = new Date(2026, 9, 14, 16, 0) // Wed 14 Oct 2026, 16:00
const MADE = new Date(2026, 9, 14, 15, 42).toISOString()
const FILES = '/api/workspaces/workspace-1/files'
const RAW_PNG = `${FILES}/raw?path=outputs%2Fposter.png`
const RAW_MP4 = `${FILES}/raw?path=outputs%2Fteaser.mp4`
const RAW_XLSX = `${FILES}/raw?path=outputs%2Fbudget.xlsx`
/** The report's own bytes: its content_url (the content route) answers JSON for the code viewer. */
const RAW_MD = `${FILES}/raw?path=outputs%2Flaptop-shortlist.md`
const CONTENT_MD = `${FILES}/content?path=outputs%2Flaptop-shortlist.md`
const TABLE = [
  '# The short answer',
  '',
  'The **Vivobook S 14** is the pick. <script>alert(1)</script> ![a chart](https://evil.example/c.png)',
  '',
  '| Laptop | Price |',
  '|---|---|',
  '| Vivobook S 14 | £679 |',
].join('\n')
const NOT_FOUND = 404
const SERVER_ERROR = 500

function deliverable(fields: Partial<Deliverable> = {}): Deliverable {
  return row('d-laptop', {
    agent_id: 7,
    agent_name: 'Researcher',
    artifact_type: 'report',
    title: 'Laptop shortlist',
    file_path: 'outputs/laptop-shortlist.md',
    file_name: 'laptop-shortlist.md',
    file_type: 'md',
    file_size_bytes: 2048,
    preview_url: CONTENT_MD,
    created_at: MADE,
    updated_at: MADE,
    content: TABLE,
    content_url: CONTENT_MD,
    ...fields,
  })
}

interface Answer {
  readonly data?: DeliverableDetailResponse
  readonly isError?: boolean
  readonly error?: unknown
}

/** react-query's answer for the page from now on, set inside act so a page on screen renders it. */
function answer({ data, isError = false, error = null }: Answer) {
  const result = { data, isLoading: data === undefined && !isError, isError, error, refetch: vi.fn(async () => ({})) }
  act(() => host.setDetail(result satisfies DeliverableQuery))
  return result
}

const found = (fields: Partial<Deliverable> = {}) => answer({ data: { success: true, deliverable: deliverable(fields) } })
const failed = (status: number, message: string) => answer({ isError: true, error: Object.assign(new Error(message), { status }) })

function renderDetail() {
  const user = userEvent.setup()
  const view = render(<PlayDeliverable id="d-laptop" now={NOW} />)
  return { user, ...view }
}

const article = () => screen.getByRole('article', { name: 'Laptop shortlist' })
const panel = () => within(screen.getByRole('complementary', { name: ABOUT }))

function fact(term: string): string | null {
  return panel().getByText(term, { selector: 'dt' }).nextElementSibling?.textContent ?? null
}

/** The props the host's MarkdownView last drew the sheet with. */
function sheet(): MarkdownViewProps | undefined {
  return host.markdownViews().at(-1)
}

beforeEach(() => {
  host.reset()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PlayDeliverable — the page', () => {
  it('shows the title, type, date and Made by, with the back link to the shelf and no mascot', () => {
    found()
    renderDetail()
    expect(screen.getByRole('heading', { level: 1, name: 'Laptop shortlist' })).toBeInTheDocument()
    expect(article()).toHaveTextContent('Report')
    expect(article()).toHaveTextContent('Today, 15:42')
    expect(article()).toHaveTextContent('Made by Auto with Researcher')
    expect(screen.getByRole('link', { name: /Shelf/ })).toHaveAttribute('href', '/deliverables')
    expect(screen.queryByTestId('auto')).toBeNull()
    expect(host.detailsAsked()).toContainEqual({ id: 'd-laptop', includeContent: true })
  })

  it("hands a markdown Deliverable to the host's renderer on the sheet, with raw HTML skipped and Play's element rules", () => {
    found()
    renderDetail()
    expect(within(article()).getByText(/The short answer/)).toHaveAttribute('data-protected-surface', 'markdown-view')
    expect(sheet()).toMatchObject({ children: TABLE, skipHtml: true })
    expect(sheet()?.components).toBe(PLAY_MARKDOWN_COMPONENTS)
    const { img: ImageAsText } = PLAY_MARKDOWN_COMPONENTS
    const { container } = render(<ImageAsText alt="a chart" src="https://evil.example/c.png" />)
    expect(container).toHaveTextContent('a chart')
    expect(container.querySelector('img')).toBeNull()
  })

  it('shows a text file verbatim in a code block, and says when the file was cut', () => {
    found({ artifact_type: 'code', file_type: 'py', file_name: 'fit.py', content: 'print("<b>hi</b>")', content_truncated: true })
    const { container } = renderDetail()
    expect(sheet()).toMatchObject({ children: '```py\nprint("<b>hi</b>")\n```', skipHtml: true })
    expect(container.querySelector('b')).toBeNull()
    expect(screen.getByText(TRUNCATED)).toBeInTheDocument()
  })

  it("prints a code Deliverable in Play's own <pre> on the sheet, not the host's CodeBlock card (P260-FX-13, M36)", () => {
    found({ artifact_type: 'code', file_type: 'py', file_name: 'fit.py', content: 'print("hi")' })
    renderDetail()
    expect(sheet()?.children).toBe('```py\nprint("hi")\n```')
    const { pre: PrintedPre } = PLAY_MARKDOWN_COMPONENTS
    expect(sheet()?.components?.pre).toBe(PrintedPre)
    const { container } = render(<PrintedPre><code>print("hi")</code></PrintedPre>)
    const pre = container.querySelector('pre')
    expect(pre?.querySelector('code')).toHaveTextContent('print("hi")')
    // CodeBlock's <pre> carries Tailwind classes and sits under a Copy header: Play's carries neither.
    expect(pre).not.toHaveAttribute('class')
    expect(within(container).queryByRole('button', { name: /copy/i })).toBeNull()
  })

  it('drops raw HTML from the sheet instead of printing its tags: skipHtml on the text as it came (P260-FX-13, M39)', () => {
    found({ content: `a<br>b\n\n${TABLE}` })
    renderDetail()
    expect(sheet()).toMatchObject({ children: `a<br>b\n\n${TABLE}`, skipHtml: true })
    expect(article().querySelector('br, script')).toBeNull()
  })

  it("shows an image Deliverable through the host's authenticated path", () => {
    const blobUrl = vi.fn((url: string | undefined) => ({ src: url ? 'blob:core/poster' : null, error: null }))
    host.setBlobUrls(blobUrl)
    found({ artifact_type: 'image', title: 'Bake sale poster', file_type: 'png', content: null, content_url: RAW_PNG, preview_url: RAW_PNG })
    renderDetail()
    expect(blobUrl.mock.calls.map(([url]) => url)).toContain(RAW_PNG)
    expect(screen.getByRole('img', { name: 'Bake sale poster' })).toHaveAttribute('src', 'blob:core/poster')
  })

  it("says when the picture doesn't load", () => {
    host.setBlobUrls(() => ({ src: null, error: 'Fetch failed: 403' }))
    found({ artifact_type: 'image', file_type: 'png', content: null, content_url: RAW_PNG })
    renderDetail()
    expect(screen.getByRole('alert')).toHaveTextContent(PICTURE_FAILED)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it("plays a video Deliverable through the host's authenticated path", () => {
    const blobUrl = vi.fn((url: string | undefined) => ({ src: url ? 'blob:core/teaser' : null, error: null }))
    host.setBlobUrls(blobUrl)
    found({ artifact_type: 'video', title: 'Teaser', file_type: 'mp4', content: null, content_url: RAW_MP4 })
    const { container } = renderDetail()
    expect(blobUrl.mock.calls.map(([url]) => url)).toContain(RAW_MP4)
    const video = container.querySelector('video')
    expect(video).toHaveAttribute('src', 'blob:core/teaser')
    expect(video).toHaveAttribute('aria-label', 'Teaser')
  })

  it("shows any other type as the file card, with the host's download", async () => {
    found({ artifact_type: 'spreadsheet', file_type: 'xlsx', file_name: 'budget.xlsx', content: 'PK\u0003\u0004', content_url: RAW_XLSX })
    const { user } = renderDetail()
    expect(screen.getByText("Play can't preview this spreadsheet here.")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: DOWNLOAD_FILE }))
    expect(host.downloadsAsked()).toEqual([{ url: RAW_XLSX, filename: 'budget.xlsx', failedMessage: DOWNLOAD_FAILED }])
  })

  it("says when Automatos couldn't read the file", () => {
    found({ content: null, content_error: 'File not found' })
    renderDetail()
    expect(screen.getByText(UNREADABLE)).toBeInTheDocument()
  })

  it("the file card downloads a text file's bytes, not its JSON content route, and a failure says try again in a moment", async () => {
    found({ content: null, content_error: 'File not found' })
    const { user } = renderDetail()
    await user.click(screen.getByRole('button', { name: DOWNLOAD_FILE }))
    await user.click(panel().getByRole('button', { name: DOWNLOAD }))
    // The file card and the side panel's Download both say it: "Try again from Deliverables" sent users where they were.
    const file = { url: RAW_MD, filename: 'laptop-shortlist.md', failedMessage: DOWNLOAD_FAILED }
    expect(host.downloadsAsked()).toEqual([file, file])
  })
})

describe('PlayDeliverable — the side panel', () => {
  it('shows the type, when it was made, the agent and where it came from', () => {
    found({ source_type: 'mission' })
    renderDetail()
    expect([fact('Type'), fact('Made'), fact('Made by'), fact('From')]).toEqual(['Report', 'Today, 15:42', 'Researcher', 'A Mission'])
  })

  it('says Made by Auto without an agent, and leaves an unknown source out', () => {
    found({ agent_name: null, source_type: '' })
    renderDetail()
    expect(fact('Made by')).toBe('Auto')
    expect(panel().queryByText('From')).toBeNull()
  })

  it.each([
    ['upload', 'Uploaded', 'An upload', 'Uploaded'],
    ['document', 'Templates', 'A template', 'Made in Templates'],
    ['social_post', 'Socials', 'A social post', 'Made in Socials'],
  ])("never credits Auto with a %s: the host's word instead (P260-FX-13, M104)", (sourceType, maker, from, line) => {
    found({ agent_name: null, source_type: sourceType })
    renderDetail()
    expect(fact('Made by')).toBe(maker)
    expect(fact('From')).toBe(from)
    expect(article()).toHaveTextContent(line)
    expect(article()).not.toHaveTextContent('Made by Auto')
  })

  it("lists Sources · N from extra.sources, as Play's panel does: a web address as its host (P260-FX-13, M81)", () => {
    found({ extra: { sources: ['https://www.reviews.example.com/laptops', { url: 'https://ratings.example.org/x' }, { title: 'Asus spec sheet' }] } })
    renderDetail()
    expect(panel().getByRole('heading', { level: 2, name: `${SOURCES} · 3` })).toBeInTheDocument()
    expect(panel().getAllByRole('listitem').map((item) => item.textContent)).toEqual(['reviews.example.com', 'ratings.example.org', 'Asus spec sheet'])
  })

  it('has no Sources section when it carries none', () => {
    found({ extra: {} })
    renderDetail()
    expect(panel().queryByRole('heading', { name: new RegExp(SOURCES) })).toBeNull()
    expect(panel().queryAllByRole('listitem')).toHaveLength(0)
  })

  it('Ask Auto about this opens /chat with a new draft naming the Deliverable', () => {
    found()
    renderDetail()
    const url = new URL(panel().getByRole('link', { name: ASK_AUTO }).getAttribute('href') ?? '', 'http://play.invalid')
    expect(url.pathname).toBe('/chat')
    // One plain line (P260-FX-10): the words, their ends trimmed.
    expect(url.searchParams.get(DRAFT_PARAM)).toBe(askAboutText('Laptop shortlist').trimEnd())
    expect(url.searchParams.get(DRAFT_PARAM)).toBe('About my Deliverable "Laptop shortlist":')
  })

  it("Download hands over the file through the host's download: the file's bytes, not the content route's JSON", async () => {
    found()
    const { user } = renderDetail()
    await user.click(panel().getByRole('button', { name: DOWNLOAD }))
    expect(host.downloadsAsked()).toEqual([{ url: RAW_MD, filename: 'laptop-shortlist.md', failedMessage: DOWNLOAD_FAILED }])
  })

  it('Download keeps a raw file route as it is', async () => {
    found({ artifact_type: 'spreadsheet', file_type: 'xlsx', file_name: 'budget.xlsx', content: null, content_url: RAW_XLSX })
    const { user } = renderDetail()
    await user.click(panel().getByRole('button', { name: DOWNLOAD }))
    expect(host.downloadsAsked()).toEqual([{ url: RAW_XLSX, filename: 'budget.xlsx', failedMessage: DOWNLOAD_FAILED }])
  })

  it('has no Download when there is no file', () => {
    found({ content_url: null, preview_url: null })
    renderDetail()
    expect(panel().queryByRole('button', { name: DOWNLOAD })).toBeNull()
  })
})

describe('PlayDeliverable — loading and failures', () => {
  it('says it is opening while it loads', () => {
    answer({})
    renderDetail()
    expect(screen.getByRole('status')).toHaveTextContent('Opening this Deliverable…')
  })

  it("says a Deliverable the backend doesn't have isn't on the shelf", () => {
    failed(NOT_FOUND, 'Deliverable not found')
    renderDetail()
    expect(screen.getByText(NOT_ON_SHELF)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: TRY_AGAIN })).toBeNull()
  })

  it("says a 404 in the page's status line (P260-FX-24, M22)", () => {
    failed(NOT_FOUND, 'Deliverable not found')
    renderDetail()
    expect(screen.getByRole('status')).toHaveTextContent(NOT_ON_SHELF)
  })

  it("turns the status line that said it was opening into 'not on your shelf': the same paragraph, so it is announced", async () => {
    // The scripted backend holds no Deliverable: it answers this id with its 404 on the next tick.
    renderDetail()
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(OPENING)
    await waitFor(() => expect(status).toHaveTextContent(NOT_ON_SHELF))
    expect(screen.getByRole('status')).toBe(status)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows an error with Try again (refetch) when it can not be opened, the backend words in the log only', async () => {
    const result = failed(SERVER_ERROR, 'get failed: boom')
    const { user } = renderDetail()
    expect(screen.getByRole('alert')).toHaveTextContent(OPEN_FAILED)
    expect(screen.queryByText(/boom/)).toBeNull()
    expect(console.error).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: TRY_AGAIN }))
    expect(result.refetch).toHaveBeenCalled()
  })

  it('keeps the open Deliverable on screen when a background refetch fails (react-query keeps the data)', () => {
    const error = Object.assign(new Error('get failed: boom'), { status: SERVER_ERROR })
    answer({ data: { success: true, deliverable: deliverable() }, isError: true, error })
    renderDetail()
    expect(screen.getByRole('heading', { level: 1, name: 'Laptop shortlist' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(OPEN_FAILED)).toBeNull()
    expect(screen.queryByText(NOT_ON_SHELF)).toBeNull()
    expect(console.error).toHaveBeenCalled()
  })

  it('reads an answer of success: false as a failure', () => {
    // The backend's success: false answer carries no Deliverable, which the SDK's response type leaves unsaid.
    answer({ data: { success: false, error: 'get failed: relation does not exist' } as unknown as DeliverableDetailResponse })
    renderDetail()
    expect(screen.getByRole('alert')).toHaveTextContent(OPEN_FAILED)
  })

  it('asks the host for the Deliverable with its content, and shows what the backend answers', async () => {
    host.setDeliverables([deliverable()])
    renderDetail()
    expect(await screen.findByRole('heading', { level: 1, name: 'Laptop shortlist' })).toBeInTheDocument()
    expect(host.detailsAsked()).toContainEqual({ id: 'd-laptop', includeContent: true })
    expect(host.detailsAsked().every((ask) => ask.id === 'd-laptop' && ask.includeContent)).toBe(true)
    expect(sheet()?.children).toBe(TABLE)
  })
})

describe('the shelf switch (PlayShelf)', () => {
  it('shows the Deliverable a ?deliverable= link names instead of the shelf', () => {
    host.setSearchParams('deliverable=d-laptop')
    found()
    render(<PlayShelf />)
    expect(screen.getByRole('heading', { level: 1, name: 'Laptop shortlist' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Your shelf' })).toBeNull()
  })

  it('falls back to the shelf with a quiet notice for an id that is not one, and never asks for it', () => {
    host.setSearchParams(`deliverable=${encodeURIComponent('../../admin?x=1')}`)
    render(<PlayShelf />)
    expect(screen.getByRole('heading', { level: 1, name: 'Your shelf' })).toBeInTheDocument()
    expect(screen.getByText(BAD_LINK)).toBeInTheDocument()
    expect(host.detailsAsked()).toEqual([])
  })

  it('shows the shelf without a notice when no Deliverable is named', () => {
    render(<PlayShelf />)
    expect(screen.getByRole('heading', { level: 1, name: 'Your shelf' })).toBeInTheDocument()
    expect(screen.queryByText(BAD_LINK)).toBeNull()
  })
})
