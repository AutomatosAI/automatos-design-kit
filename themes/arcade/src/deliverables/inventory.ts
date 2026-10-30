import {
  DELIVERABLE_FEED_FILTERS,
  type Deliverable,
  type DeliverableFilters,
  type DeliverableListResponse,
} from '@automatos/theme-sdk'

import type { ItemKind } from '../art/agents-icons'

/**
 * The Inventory (the design's bag) as data: its tabs as the host's list filters, each item's icon and type word, its
 * date, the count line and the info line, and what the list query's pages amount to on screen. The feed is the
 * host's own (DELIVERABLE_FEED_FILTERS: every Deliverable but a heartbeat's), newest first. POSTS is the Deliverables
 * a social post made (source_type social_post), shown only where the workspace is offered Socials. "Now" is always
 * passed in. Pure.
 */

export interface InventoryTab {
  readonly id: 'all' | 'reports' | 'documents' | 'images' | 'posts'
  readonly label: string
  readonly artifactType: string | null
  readonly sourceType: string | null
}

export const SOCIAL_POST = 'social_post'

export const TABS: readonly InventoryTab[] = [
  { id: 'all', label: 'All', artifactType: null, sourceType: null },
  { id: 'reports', label: 'Reports', artifactType: 'report', sourceType: null },
  { id: 'documents', label: 'Documents', artifactType: 'document', sourceType: null },
  { id: 'images', label: 'Images', artifactType: 'image', sourceType: null },
  { id: 'posts', label: 'Posts', artifactType: null, sourceType: SOCIAL_POST },
]

export function visibleTabs(socials: boolean): readonly InventoryTab[] {
  return TABS.filter((tab) => tab.id !== 'posts' || socials)
}

/** How often the open bag asks for its pages again while the tab is visible (as Play's shelf). */
export const REFRESH_MS = 30_000

export function filtersOf(tab: InventoryTab): DeliverableFilters {
  return { ...DELIVERABLE_FEED_FILTERS, artifact_type: tab.artifactType, source_type: tab.sourceType }
}

const REPORT_TYPES: ReadonlySet<string> = new Set(['report', 'blog_post'])
const PICTURE_TYPES: ReadonlySet<string> = new Set(['image', 'video'])

export function itemKind(deliverable: Pick<Deliverable, 'artifact_type' | 'source_type'>): ItemKind {
  if (deliverable.source_type?.trim().toLowerCase() === SOCIAL_POST) return 'post'
  const type = deliverable.artifact_type?.trim().toLowerCase() ?? ''
  if (REPORT_TYPES.has(type)) return 'report'
  return PICTURE_TYPES.has(type) ? 'image' : 'document'
}

/** "Report", "Blog post", "Spreadsheet": the item's own type, in words. */
export function typeWord(deliverable: Pick<Deliverable, 'artifact_type' | 'source_type'>): string {
  if (deliverable.source_type?.trim().toLowerCase() === SOCIAL_POST) return 'Post'
  const type = (deliverable.artifact_type?.trim() || 'document').replace(/_/g, ' ')
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export const UNTITLED = 'Your Deliverable'

export function titleOf(deliverable: Pick<Deliverable, 'title'>): string {
  return deliverable.title?.trim() || UNTITLED
}

const DAY_MS = 86_400_000
const SHORT_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

function dayStart(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** "Today", "Yesterday", "26 Oct"; "" when the date is missing or unreadable. */
export function itemDate(createdAt: string | null | undefined, now: Date): string {
  if (!createdAt) return ''
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return ''
  const days = Math.round((dayStart(now) - dayStart(date)) / DAY_MS)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return SHORT_DATE.format(date)
}

/** Who made it: the agent, else Auto (or the host's word for an upload or a post). */
export function madeBy(deliverable: Pick<Deliverable, 'agent_name' | 'source_type'>): string {
  const agent = deliverable.agent_name?.trim()
  if (agent) return agent
  const source = deliverable.source_type?.trim().toLowerCase()
  if (source === 'upload') return 'you (an upload)'
  return source === SOCIAL_POST ? 'Socials' : 'Auto'
}

/** "1 item", "9 items". */
export function countLine(total: number): string {
  return `${total} ${total === 1 ? 'item' : 'items'} · newest first`
}

export function infoLine(deliverable: Deliverable, now: Date): string {
  const date = itemDate(deliverable.created_at, now)
  const when = date ? ` · ${date}` : ''
  return `${titleOf(deliverable)} · ${typeWord(deliverable)} · made by ${madeBy(deliverable)}${when}. Select to open it.`
}

export type BagView =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'ready'; readonly items: readonly Deliverable[]; readonly total: number }

/** One per id, the first kept: a new Deliverable shifts the offsets between pages. */
function uniqueById(pages: readonly DeliverableListResponse[]): readonly Deliverable[] {
  const items = pages.flatMap((page) => page.deliverables ?? [])
  return items.filter((item, index) => items.findIndex((other) => other.id === item.id) === index)
}

/** The bag from the list query: loading, failed with nothing loaded, or the items with the latest total. */
export function bagView(query: { readonly data?: { readonly pages: readonly DeliverableListResponse[] }; readonly isError: boolean }): BagView {
  const pages = query.data?.pages ?? []
  if (pages.length === 0) return query.isError ? { status: 'failed' } : { status: 'loading' }
  return { status: 'ready', items: uniqueById(pages), total: pages[pages.length - 1].total }
}
