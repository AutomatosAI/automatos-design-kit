import { useCallback, useState } from 'react'

/**
 * HUD 1.3.0 (PRD-268, SDK 1.4.0): BRIEFING's rows built in time with Auto's voice. The host's Listen (the SDK's
 * BriefVoice) tells its `onSpeakingRow` the row Auto starts reading (its index across the brief's rows in the sections'
 * order, the number Auto says less one: HUD's own numbering) and null between rows, during the greeting and once the
 * reading ends; its root carries the same index as `data-voice-row`. While Auto reads, each row is one of:
 *
 * - `now`: the row being read, with `▸` beside its number;
 * - `read`: a row Auto has read (every row up to the furthest one reached);
 * - `ahead`: one still to come, drawn only once Auto reaches it, unless nothing may move.
 *
 * Where nothing may move (the reduced-motion setting, the look's motion off) every row is drawn at once and only the
 * marker moves: no row is `ahead` or `read`, the row being read is `now`. While Auto reads nothing, no row has a state,
 * and the next reading starts from the top.
 */

export type RowReading = 'now' | 'read' | 'ahead'

export interface Reading {
  /** The row being read; null between rows, during the greeting and with nothing read. */
  readonly now: number | null
  /** The furthest row reached in this reading; -1 before the first. */
  readonly reached: number
}

export const NOT_READ: Reading = Object.freeze({ now: null, reached: -1 })

/** The reading once Listen tells `row`. Pure. */
export function readingAt(was: Reading, row: number | null): Reading {
  return Object.freeze({ now: row, reached: row === null ? was.reached : Math.max(was.reached, row) })
}

/** Row `index`'s state in `reading`: with `building` (motion allowed) every row has one, else only the row being read. Pure. */
export function rowReading(reading: Reading, index: number, building: boolean): RowReading | undefined {
  if (index === reading.now) return 'now'
  if (!building) return undefined
  return index <= reading.reached ? 'read' : 'ahead'
}

export interface BriefReading {
  /** For BriefVoice's onSpeakingRow. */
  readonly onSpeakingRow: (row: number | null) => void
  /** Row `index`'s state while Auto reads; undefined while he reads nothing. */
  readonly stateOf: (index: number) => RowReading | undefined
}

/**
 * The rows' states while `speaking` (the host's Listen reads the brief), rows `building` in as Auto reaches them where
 * motion is allowed. The rows Listen told before its root said it reads are kept; once it stops, they are forgotten.
 */
export function useBriefReading(speaking: boolean, building: boolean): BriefReading {
  const [reading, setReading] = useState<Reading>(NOT_READ)
  const [wasSpeaking, setWasSpeaking] = useState(speaking)
  if (wasSpeaking !== speaking) {
    // Set while rendering, as React keeps state from a prop's change: a reading that ended leaves nothing behind.
    setWasSpeaking(speaking)
    if (!speaking) setReading(NOT_READ)
  }
  const onSpeakingRow = useCallback((row: number | null) => setReading((was) => readingAt(was, row)), [])
  const stateOf = useCallback(
    (index: number) => (speaking ? rowReading(reading, index, building) : undefined),
    [speaking, reading, building],
  )
  return { onSpeakingRow, stateOf }
}
