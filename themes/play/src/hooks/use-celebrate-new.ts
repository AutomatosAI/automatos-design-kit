'use client'

import { useEffect, useRef, useState } from 'react'

import type { Deliverable } from '@automatos/theme-sdk'

import { freshDeliverables, markSeen, readSeen, type SeenRecord, subscribeSeen, writeSeen } from '../lib/play/seen'

/**
 * PRD-260 §4 — Auto celebrates once when Play's shelf shows a Deliverable this
 * account hasn't seen in this workspace (lib/play/seen.ts decides what counts as
 * new), ported from Automatos Play's hooks/useCelebrateNew.ts. Returns the
 * newest one that set it off, for the caption ("Your report is ready").
 *
 * PRD-261 E3g: the record is kept by the host, in the SDK's storage area
 * (lib/play/seen.ts), for the signed-in user in this workspace: nothing is read
 * or remembered until the host knows both, and another account or workspace
 * starts its own. The hook keeps the record it last read or wrote, so when the
 * host refuses a write the shelf still knows what it showed while it is open; a
 * change the host reports (the user or workspace changed, another tab wrote, or
 * this hook's own write) makes it read the host's record again.
 */
export function useCelebrateNew(items: readonly Deliverable[] | null, celebrate: () => void): Deliverable | null {
  // The record as last read or written; undefined until it is read, and again after the host reports a change.
  const seen = useRef<SeenRecord | null | undefined>(undefined)
  const [changes, setChanges] = useState(0)
  const [latest, setLatest] = useState<Deliverable | null>(null)

  useEffect(
    () =>
      subscribeSeen(() => {
        seen.current = undefined
        setChanges((count) => count + 1)
      }),
    [],
  )

  useEffect(() => {
    if (!items || items.length === 0) return
    const kept = seen.current
    const stored = kept === undefined ? readSeen() : { ready: true, record: kept }
    if (!stored.ready) return
    const before = stored.record
    const fresh = freshDeliverables(before, items)
    const after = markSeen(before, items)
    seen.current = after
    if (after !== before) writeSeen(after)
    const [newest] = fresh
    if (newest) {
      setLatest(newest)
      celebrate()
    }
  }, [items, celebrate, changes])

  return latest
}
