// Partly after themes/arcade/src/deliverables/inventory.ts (Arcade 1.0.0): the feed's filters, the title, and what
// the list query's pages amount to on screen, as they are there; the kinds, their words, gradients and counts are
// Candy's own.
import { DELIVERABLE_FEED_FILTERS, deliverableLabel } from '@automatos/theme-sdk'
import type { Deliverable, DeliverableFilters, DeliverableListResponse } from '@automatos/theme-sdk'

import { KIND_SETS } from '../looks/catalogue'
import { kindSetOf } from '../ui/sets'
import type { CardSet } from '../ui/sets'
import { dayWords } from '../ui/when'

/**
 * The shelf (the design's W3) as data: each Deliverable's kind, its words and its gradient, the filter pills and
 * their counts, the line under a tile, and what the list query's pages amount to on screen. The feed is the host's
 * own (DELIVERABLE_FEED_FILTERS: every Deliverable but a heartbeat's), newest first, a kind and the search asked of
 * the host's list. The host gives no count per kind, so a pill counts the Deliverables loaded so far: exact once
 * every page is in, "12+" before that, and the selected kind's own total once its list answers. Pure; "now" is
 * passed in.
 */

/** The kinds the pills name first, in the design's order; any other kind follows in the order it first shows. */
export const KIND_ORDER: readonly string[] = ['report', 'document', 'image', 'spreadsheet', 'slide', 'blog_post']

/** A Deliverable with no kind is a document, as the host reads it. */
const DEFAULT_KIND = 'document'

/** How often the open shelf asks for its pages again while the tab is visible (as Arcade's bag). */
export const REFRESH_MS = 30_000

export const ALL_LABEL = 'All'
export const UNTITLED = 'Untitled Deliverable'

/** The host's kind names that catalogue.ts's KIND_SETS spells otherwise ("slide", "blog_post"). */
const SET_ALIASES: ReadonlyMap<string, string> = new Map([
  ['slide', 'slides'],
  ['blog_post', 'blog'],
])

/** A kind in one word, for the badge: the design's words, else the kind as it is, in words. */
const KIND_WORDS: ReadonlyMap<string, string> = new Map([
  ['report', 'Report'],
  ['document', 'Document'],
  ['image', 'Image'],
  ['spreadsheet', 'Spreadsheet'],
  ['slide', 'Slides'],
  ['slides', 'Slides'],
  ['blog_post', 'Blog post'],
  ['blog', 'Blog post'],
  ['code', 'Code'],
  ['video', 'Video'],
])

/** Where a Deliverable came from, as the host's MadeBy names it (made-by.ts), but "Upload" for an upload. */
const SOURCE_WORDS: ReadonlyMap<string, string> = new Map([
  ['chat', 'Chat'],
  ['mission', 'Mission'],
  ['playbook', 'Playbook'],
  ['task', 'Task'],
  ['upload', 'Upload'],
  ['social_post', 'Socials'],
  ['heartbeat', 'Heartbeat'],
  ['agent_output', 'Generated'],
  ['document', 'Templates'],
  ['trigger', 'Trigger'],
])

/** "case_study" → "Case study". */
export function inWords(word: string): string {
  const spaced = word.replace(/[_-]+/g, ' ').trim()
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : ''
}

export function kindOf(item: Pick<Deliverable, 'artifact_type'>): string {
  return item.artifact_type?.trim().toLowerCase() || DEFAULT_KIND
}

/** The kind's card gradient: report and slides 1, document and spreadsheet 2, image and blog post 3, else 1. */
export function setOfKind(kind: string): CardSet {
  const named = SET_ALIASES.get(kind) ?? kind
  return Object.hasOwn(KIND_SETS, named) ? kindSetOf(named) : 1
}

/** "Report", "Blog post": the badge's word. */
export function kindWord(kind: string): string {
  return KIND_WORDS.get(kind) ?? inWords(kind)
}

/** The pill's name: the host's ("Reports", "Spreadsheets"), else the kind in words. */
export function kindLabel(kind: string): string {
  const label = deliverableLabel(kind)
  return label === kind ? inWords(kind) : label
}

export function sourceWord(source: string | null | undefined): string | null {
  const key = source?.trim().toLowerCase()
  if (!key) return null
  return SOURCE_WORDS.get(key) ?? inWords(key)
}

export function titleOf(item: Pick<Deliverable, 'title'>): string {
  return item.title?.trim() || UNTITLED
}

type TileFields = Pick<Deliverable, 'agent_name' | 'source_type' | 'created_at'>

/** "Iris · Mission · Today": the agent, the source and the day, each only where the host gives it. */
export function tileLine(item: TileFields, now: number): string {
  return [item.agent_name?.trim(), sourceWord(item.source_type), dayWords(item.created_at, now)].filter(Boolean).join(' · ')
}

/** "Report · Today": the narrow window's line, where the badge gives way. */
export function narrowLine(item: TileFields & Pick<Deliverable, 'artifact_type'>, now: number): string {
  return [kindWord(kindOf(item)), dayWords(item.created_at, now)].filter(Boolean).join(' · ')
}

/** What a screen reader hears for a tile: "Q3 brand report, Report, Iris, Mission, Today". */
export function tileLabel(item: Deliverable, now: number): string {
  const parts = [titleOf(item), kindWord(kindOf(item)), item.agent_name?.trim(), sourceWord(item.source_type), dayWords(item.created_at, now)]
  return parts.filter(Boolean).join(', ')
}

/** The host's list filters for one kind (null: every kind) and the search words. */
export function filtersFor(kind: string | null, search: string): DeliverableFilters {
  return { ...DELIVERABLE_FEED_FILTERS, artifact_type: kind, search: search.trim() }
}

export interface KindCount {
  readonly kind: string
  readonly count: number
}

/** Each kind among `items` with how many, in the pills' order. */
export function kindCounts(items: readonly Pick<Deliverable, 'artifact_type'>[]): readonly KindCount[] {
  const tally = new Map<string, number>()
  for (const item of items) tally.set(kindOf(item), (tally.get(kindOf(item)) ?? 0) + 1)
  const others = [...tally.keys()].filter((kind) => !KIND_ORDER.includes(kind))
  return [...KIND_ORDER.filter((kind) => tally.has(kind)), ...others].map((kind) => ({ kind, count: tally.get(kind) ?? 0 }))
}

/** A count as a pill shows it: "4", or "4+" while more pages wait. */
export function countWords(count: number, exact: boolean): string {
  return exact ? String(count) : `${count}+`
}

export interface Pill {
  /** null for All. */
  readonly kind: string | null
  readonly label: string
  readonly count: string
}

export interface PillsInput {
  /** The loaded Deliverables of every kind, and whether that is all of them. */
  readonly all: ShelfView
  readonly selected: string | null
  /** The selected kind's own total, once its list answers. */
  readonly selectedTotal: number | null
}

/** "All 8", then one pill per kind present (and the selected one), each with its count. */
export function pillsOf({ all, selected, selectedTotal }: PillsInput): readonly Pill[] {
  const ready = all.status === 'ready'
  const counts = ready ? kindCounts(all.items) : []
  const shown = selected === null || counts.some((entry) => entry.kind === selected) ? counts : [...counts, { kind: selected, count: 0 }]
  const exact = ready && all.complete
  const kinds = shown.map(({ kind, count }) => ({
    kind,
    label: kindLabel(kind),
    count: kind === selected && selectedTotal !== null ? String(selectedTotal) : countWords(count, exact),
  }))
  return [{ kind: null, label: ALL_LABEL, count: ready ? String(all.total) : '' }, ...kinds]
}

export type ShelfView =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'ready'; readonly items: readonly Deliverable[]; readonly total: number; readonly complete: boolean }

/** One per id, the first kept: a new Deliverable shifts the offsets between pages. */
function uniqueById(pages: readonly DeliverableListResponse[]): readonly Deliverable[] {
  const seen = new Set<string>()
  return pages
    .flatMap((page) => page.deliverables ?? [])
    .filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
}

export interface ListAnswer {
  readonly data?: { readonly pages: readonly DeliverableListResponse[] }
  readonly isError: boolean
  readonly hasNextPage?: boolean
}

/** The shelf from the list query: loading, failed with nothing loaded, or the Deliverables with the latest total. */
export function shelfView(query: ListAnswer): ShelfView {
  const pages = query.data?.pages ?? []
  const last = pages[pages.length - 1]
  if (last === undefined) return query.isError ? { status: 'failed' } : { status: 'loading' }
  return { status: 'ready', items: uniqueById(pages), total: last.total, complete: query.hasNextPage !== true }
}
