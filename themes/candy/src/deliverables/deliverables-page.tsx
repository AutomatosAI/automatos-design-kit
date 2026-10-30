import { useCallback, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { DELIVERABLE_PARAM, DELIVERABLES_HREF, useHostRouter, useHostSearchParams, useWorkspace } from '@automatos/theme-sdk'
import type { Deliverable } from '@automatos/theme-sdk'

import { THEME_HEADING } from '../theme'
import { useNow } from '../ui/use-now'
import { KindPills, SearchField, Sections } from './controls'
import { isDeliverableId } from './links'
import { noMatchLine, Results } from './results'
import { kindLabel } from './shelf'
import { DeliverableSheet } from './sheet'
import { TILE_ATTRIBUTE } from './tile'
import { SEARCH_DELAY_MS, useSettled, useShelf } from './use-shelf'
import type { Shelf } from './use-shelf'
import styles from './deliverables.module.css'
import ui from '../ui/ui.module.css'

/**
 * Candy's /deliverables (theme.json "pages", the design's W3): the title and the search pill, the kind pills, and the
 * grid of gradient tiles, newest first. A tile opens its Deliverable's sheet over the grid; the host's own link to
 * one Deliverable (/deliverables?deliverable=<id>, which a chat's Deliverables use) opens it the same way, and a
 * link that names none shows the shelf with a quiet line. ?tab=outputs (the host's Explorer comes back there) is
 * this page too; the host's other ?tab= sections, ?post= and ?artifact_type= stay the host's own pages.
 */

export const TITLE = 'Deliverables'
export const BAD_LINK = "That link doesn't name a Deliverable, so here are all of them."

/** The sheet that is open: the one the link names to begin with, then the one a tile opens. */
function useSheet(askedId: string | null, root: RefObject<HTMLElement | null>, heading: RefObject<HTMLElement | null>) {
  const router = useHostRouter()
  const [seen, setSeen] = useState(askedId)
  const [openId, setOpenId] = useState(askedId)
  if (seen !== askedId) {
    setSeen(askedId)
    setOpenId(askedId)
  }
  const close = useCallback(() => {
    const tile = openId === null ? null : root.current?.querySelector<HTMLElement>(`[${TILE_ATTRIBUTE}="${openId}"]`)
    ;(tile ?? heading.current)?.focus()
    setOpenId(null)
    if (askedId !== null) router.replace(DELIVERABLES_HREF)
  }, [openId, askedId, root, heading, router])
  return { openId, open: setOpenId, close }
}

/** The kind picked and the search words: the box's words at once, the host's list once typing pauses. */
function useFilters() {
  const [kind, setKind] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const search = useSettled(typed, SEARCH_DELAY_MS)
  const showAll = useCallback(() => {
    setKind(null)
    setTyped('')
  }, [])
  return { kind, setKind, typed, setTyped, search, showAll }
}

function rowOf(shelf: Shelf, id: string): Deliverable | null {
  return shelf.view.status === 'ready' ? (shelf.view.items.find((item) => item.id === id) ?? null) : null
}

export function DeliverablesPage() {
  const asked = useHostSearchParams().get(DELIVERABLE_PARAM) || null
  const askedId = asked !== null && isDeliverableId(asked) ? asked : null
  const socials = useWorkspace().workspace?.socialsAvailable === true
  const root = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const filters = useFilters()
  const shelf = useShelf(filters.kind, filters.search)
  const sheet = useSheet(askedId, root, heading)
  const now = useNow()
  const narrowed = filters.search.trim() !== '' || filters.kind !== null
  const noMatch = narrowed ? noMatchLine(filters.search, filters.kind === null ? null : kindLabel(filters.kind)) : null
  return (
    <div ref={root} className={styles.shelf}>
      <div className={`${ui.pageHead} ${styles.head}`}>
        <h1 ref={heading} className={ui.pageTitle} tabIndex={-1} {...THEME_HEADING}>
          {TITLE}
        </h1>
        <SearchField value={filters.typed} onChange={filters.setTyped} />
      </div>
      {asked !== null && askedId === null && <p className={ui.note} role="status">{BAD_LINK}</p>}
      <KindPills pills={shelf.pills} selected={filters.kind} onSelect={filters.setKind} />
      <Results shelf={shelf} now={now} noMatch={noMatch} onShowAll={filters.showAll} onOpen={sheet.open} />
      <Sections socials={socials} />
      {sheet.openId !== null && <DeliverableSheet key={sheet.openId} id={sheet.openId} row={rowOf(shelf, sheet.openId)} now={now} onClose={sheet.close} />}
    </div>
  )
}
