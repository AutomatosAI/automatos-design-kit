// The shelf's pure parts (src/deliverables/shelf.ts, content.ts, links.ts, results.tsx's line): each kind's gradient,
// words and pill name, where a Deliverable came from, the line under a tile, the counts and the pills, the list
// query's pages as the shelf shows them, how a Deliverable's content shows in its sheet, and its links. The rows are
// made up.
import type { Deliverable, DeliverableListResponse } from '@automatos/theme-sdk'
import { describe, expect, it } from 'vitest'

import { contentView } from '../src/deliverables/content.ts'
import { deliverableHref, explorerHref, isDeliverableId, sectionLinks } from '../src/deliverables/links.ts'
import { noMatchLine } from '../src/deliverables/results.tsx'
import {
  countWords,
  filtersFor,
  kindCounts,
  kindLabel,
  kindOf,
  kindWord,
  narrowLine,
  pillsOf,
  setOfKind,
  shelfView,
  sourceWord,
  tileLabel,
  tileLine,
  titleOf,
  UNTITLED,
} from '../src/deliverables/shelf.ts'

const NOW = Date.parse('2026-10-30T12:00:00')
const TODAY = new Date(NOW).toISOString()

function row(id: string, artifactType: string, fields: Partial<Deliverable> = {}): Deliverable {
  return {
    id, workspace_id: 'ws', source_type: 'mission', source_id: null, agent_id: null, agent_name: 'Iris', artifact_type: artifactType,
    title: `Title ${id}`, summary: null, storage_type: 'workspace', file_path: `outputs/${id}.md`, file_name: null, file_type: 'md',
    file_size_bytes: null, preview_url: null, preview_type: null, extra: {}, status: 'active', created_at: TODAY, updated_at: TODAY, ...fields,
  }
}

function page(items: readonly Deliverable[], total: number, offset = 0): DeliverableListResponse {
  return { success: true, deliverables: items, total, limit: 24, offset }
}

describe('a kind', () => {
  it('reads the kind, a missing one as a document', () => {
    expect(kindOf({ artifact_type: ' Report ' })).toBe('report')
    expect(kindOf({ artifact_type: '' })).toBe('document')
  })

  it('wears its card set: report and slides 1, document and spreadsheet 2, image and blog post 3, anything else 1', () => {
    const kinds = ['report', 'slide', 'slides', 'document', 'spreadsheet', 'image', 'blog_post', 'blog', 'code', 'constructor']
    expect(kinds.map(setOfKind)).toEqual([1, 1, 1, 2, 2, 3, 3, 3, 1, 1])
  })

  it("names itself in a word for the badge, and with the host's name on its pill", () => {
    expect(['report', 'slide', 'blog_post', 'case_study'].map(kindWord)).toEqual(['Report', 'Slides', 'Blog post', 'Case study'])
    expect(['report', 'spreadsheet', 'blog_post', 'whitepaper'].map(kindLabel)).toEqual(['Reports', 'Spreadsheets', 'Blog Posts', 'Whitepaper'])
  })
})

describe("a tile's words", () => {
  it('names where a Deliverable came from, as the host does, and nothing for none', () => {
    expect(['chat', 'upload', 'social_post', 'orchestration_task'].map(sourceWord)).toEqual(['Chat', 'Upload', 'Socials', 'Orchestration task'])
    expect(sourceWord(null)).toBeNull()
    expect(sourceWord('  ')).toBeNull()
  })

  it('says the agent, the source and the day, each only where the host gives it', () => {
    expect(tileLine(row('a', 'report'), NOW)).toBe('Iris · Mission · Today')
    expect(tileLine(row('b', 'report', { agent_name: null, source_type: 'upload' }), NOW)).toBe('Upload · Today')
    expect(tileLine(row('c', 'report', { created_at: 'not a date' }), NOW)).toBe('Iris · Mission')
    expect(narrowLine(row('d', 'blog_post'), NOW)).toBe('Blog post · Today')
  })

  it('names the tile for a screen reader, and an untitled one in words', () => {
    expect(tileLabel(row('a', 'image', { title: 'Poster' }), NOW)).toBe('Poster, Image, Iris, Mission, Today')
    expect(titleOf({ title: '  ' })).toBe(UNTITLED)
  })
})

describe('the counts and the pills', () => {
  it('counts each kind, in the design order and then the others as they first show', () => {
    const items = ['image', 'report', 'video', 'report', 'code', 'document'].map((kind, index) => row(String(index), kind))
    expect(kindCounts(items)).toEqual([
      { kind: 'report', count: 2 },
      { kind: 'document', count: 1 },
      { kind: 'image', count: 1 },
      { kind: 'video', count: 1 },
      { kind: 'code', count: 1 },
    ])
    expect([countWords(4, true), countWords(4, false)]).toEqual(['4', '4+'])
  })

  it('shows All alone while loading, then exact counts once every page is in', () => {
    expect(pillsOf({ all: { status: 'loading' }, selected: null, selectedTotal: null })).toEqual([{ kind: null, label: 'All', count: '' }])
    const all = shelfView({ data: { pages: [page([row('1', 'report'), row('2', 'image')], 2)] }, isError: false, hasNextPage: false })
    expect(pillsOf({ all, selected: null, selectedTotal: null }).map((pill) => `${pill.label} ${pill.count}`)).toEqual(['All 2', 'Reports 1', 'Images 1'])
  })

  it("says \"+\" while pages wait, the selected kind's own total, and keeps a selected kind the list no longer shows", () => {
    const all = shelfView({ data: { pages: [page([row('1', 'report'), row('2', 'image')], 40)] }, isError: false, hasNextPage: true })
    const words = (selected: string | null, total: number | null) => pillsOf({ all, selected, selectedTotal: total }).map((pill) => `${pill.label} ${pill.count}`)
    expect(words(null, null)).toEqual(['All 40', 'Reports 1+', 'Images 1+'])
    expect(words('report', 17)).toEqual(['All 40', 'Reports 17', 'Images 1+'])
    expect(words('spreadsheet', 0)).toEqual(['All 40', 'Reports 1+', 'Images 1+', 'Spreadsheets 0'])
  })

  it("asks the host's feed for one kind and the search words, heartbeats left out", () => {
    expect(filtersFor('report', '  brief ')).toMatchObject({ artifact_type: 'report', search: 'brief', source_type_exclude: ['heartbeat'] })
    expect(filtersFor(null, '').artifact_type).toBeNull()
  })

  it('says why nothing shows: the search words, else the kind', () => {
    expect(noMatchLine(' zebra ', 'Reports')).toBe('Nothing matches “zebra”.')
    expect(noMatchLine('', 'Reports')).toBe('No Reports yet.')
  })
})

describe('the list as the shelf shows it', () => {
  it('is loading, or failed, until a page is in', () => {
    expect(shelfView({ isError: false })).toEqual({ status: 'loading' })
    expect(shelfView({ isError: true })).toEqual({ status: 'failed' })
  })

  it('keeps one of each Deliverable across pages, the latest total, and whether more pages wait', () => {
    const first = page([row('1', 'report'), row('2', 'report')], 3)
    const second = page([row('2', 'report'), row('3', 'image')], 3, 2)
    const view = shelfView({ data: { pages: [first, second] }, isError: true, hasNextPage: false })
    expect(view.status === 'ready' && view.items.map((item) => item.id)).toEqual(['1', '2', '3'])
    expect(view).toMatchObject({ status: 'ready', total: 3, complete: true })
  })
})

describe("a Deliverable's content", () => {
  it('reads a report, and a text or Markdown file, as Markdown', () => {
    expect(contentView(row('a', 'report', { file_type: 'html', content: '# Hi', content_truncated: true }))).toEqual({ kind: 'markdown', markdown: '# Hi', truncated: true })
    expect(contentView(row('b', 'document', { file_type: 'txt', content: 'plain' }))).toMatchObject({ kind: 'markdown', markdown: 'plain' })
  })

  it("hands other text to the host's FilePreview, and a file by its path", () => {
    expect(contentView(row('a', 'spreadsheet', { file_type: 'csv', content: 'a,b' }))).toEqual({ kind: 'preview', content: 'a,b', url: null, previewType: null, truncated: false })
    const picture = row('b', 'image', { file_type: 'png', content: 'bytes', content_url: '/api/files/b.png' })
    expect(contentView(picture)).toEqual({ kind: 'preview', content: null, url: '/api/files/b.png', previewType: 'image', truncated: false })
  })

  it("says so for an empty, unreadable or file-less Deliverable", () => {
    expect(contentView(row('a', 'document', { content: '  ' }))).toEqual({ kind: 'empty' })
    expect(contentView(row('b', 'document', { content: null, content_error: 'too big' }))).toEqual({ kind: 'unreadable' })
    expect(contentView(row('c', 'document', { content: null }))).toEqual({ kind: 'none' })
  })
})

describe('the links', () => {
  it("links one Deliverable on this page, and checks the id first", () => {
    expect(deliverableHref('d-1_a')).toBe('/deliverables?deliverable=d-1_a')
    expect([isDeliverableId('d-1_a'), isDeliverableId('../admin'), isDeliverableId('')]).toEqual([true, false, false])
  })

  it("opens the host's Explorer at the Deliverable's place, and the host's other sections", () => {
    expect(explorerHref('outputs/a b.md')).toBe('/deliverables/explorer?path=outputs%2Fa%20b.md')
    expect(explorerHref('')).toBe('/deliverables/explorer')
    expect(sectionLinks(true).map((link) => link.label)).toEqual(['Blogs', 'Templates', 'Brand kit', 'Socials', 'Explorer'])
    expect(sectionLinks(false).map((link) => link.label)).not.toContain('Socials')
  })
})
