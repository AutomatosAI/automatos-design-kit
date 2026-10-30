import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDeliverables } from '@automatos/theme-sdk'
import type { DeliverablesOptions } from '@automatos/theme-sdk'

import { filtersFor, pillsOf, REFRESH_MS, shelfView } from './shelf'
import type { Pill, ShelfView } from './shelf'

/**
 * The shelf's reads from the host: the list of every kind (for All and the pills' counts) and the list of the
 * selected kind (the grid), both with the search words, a page at a time, newest first, asked again every
 * REFRESH_MS while the tab is visible. With All selected the two are the same list, which the host asks for once.
 * The search box's words reach the host's list once typing pauses (SEARCH_DELAY_MS).
 */

export const SEARCH_DELAY_MS = 250

const OPTIONS: DeliverablesOptions = { refetchInterval: REFRESH_MS }

/** `value`, once it has held still for `ms`. */
export function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}

export interface Shelf {
  /** The grid: the selected kind's Deliverables. */
  readonly view: ShelfView
  readonly pills: readonly Pill[]
  readonly hasMore: boolean
  readonly loadingMore: boolean
  /** A later page failed: the pages loaded before it stay. */
  readonly moreFailed: boolean
  readonly more: () => void
  readonly retry: () => void
}

export function useShelf(kind: string | null, search: string): Shelf {
  const allFilters = useMemo(() => filtersFor(null, search), [search])
  const kindFilters = useMemo(() => filtersFor(kind, search), [kind, search])
  const all = useDeliverables(allFilters, OPTIONS)
  const typed = useDeliverables(kindFilters, OPTIONS)
  const grid = kind === null ? all : typed
  const allView = useMemo(() => shelfView(all), [all])
  const view = useMemo(() => shelfView(grid), [grid])
  const selectedTotal = kind !== null && view.status === 'ready' ? view.total : null
  const pills = useMemo(() => pillsOf({ all: allView, selected: kind, selectedTotal }), [allView, kind, selectedTotal])
  const more = useCallback(() => void grid.fetchNextPage(), [grid])
  const retry = useCallback(() => {
    void all.refetch()
    if (kind !== null) void typed.refetch()
  }, [all, typed, kind])
  return {
    view,
    pills,
    hasMore: grid.hasNextPage === true,
    loadingMore: grid.isFetchingNextPage,
    moreFailed: view.status === 'ready' && grid.isError,
    more,
    retry,
  }
}
