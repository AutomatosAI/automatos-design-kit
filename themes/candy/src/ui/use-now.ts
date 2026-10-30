import { useEffect, useState } from 'react'

/**
 * The time now, for the words that say how long ago something was: read once, then again every minute while the
 * component is mounted, so "12 min ago" moves on without a render per second.
 */

export const NOW_EVERY_MS = 60_000

export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), NOW_EVERY_MS)
    return () => clearInterval(timer)
  }, [])
  return now
}
