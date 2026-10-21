'use client'

import { useEffect, useRef, useState } from 'react'

import type { Deliverable } from '@automatos/theme-sdk'

import { freshDeliverables, markSeen, readSeen, type SeenRecord, subscribeSeen, writeSeen } from '../lib/play/seen'

/** Writes the record with `writing` set, so the hook's subscriber skips the host's report of this write. */
function writeOwn(writing: { current: boolean }, record: SeenRecord): void {
  writing.current = true
  try {
    writeSeen(record)
  } finally {
    writing.current = false
  }
}

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
 * change the host reports (the user or workspace changed, another tab wrote)
 * makes it read the host's record again. The host also reports this hook's own
 * write, at once, inside writeSeen: that one is skipped, since the hook already
 * holds what it wrote, so a write never wakes the hook that made it.
 */
export function useCelebrateNew(items: readonly Deliverable[] | null, celebrate: () => void): Deliverable | null {
  // The record as last read or written; undefined until it is read, and again after the host reports a change.
  const seen = useRef<SeenRecord | null | undefined>(undefined)
  // True while this hook's own writeSeen runs, when the host's report of it arrives.
  const writing = useRef(false)
  const [changes, setChanges] = useState(0)
  const [latest, setLatest] = useState<Deliverable | null>(null)

  useEffect(
    () =>
      subscribeSeen(() => {
        if (writing.current) return
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
    if (after !== before) writeOwn(writing, after)
    const [newest] = fresh
    if (newest) {
      setLatest(newest)
      celebrate()
    }
  }, [items, celebrate, changes])

  return latest
}
