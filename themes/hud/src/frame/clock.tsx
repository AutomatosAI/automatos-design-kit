import { useEffect, useState } from 'react'

import styles from './top-bar.module.css'

/**
 * The top bar's clock ("15:42 · TUE 14 OCT 2026", the design's centre), in the browser's own time zone, to the
 * minute. It reads the time once a second and draws only when the minute changes. The date is its own part, which
 * the top bar drops on a narrow window (top-bar.module.css), so the host's utilities at the bar's end keep their room.
 */

const TICK_MS = 1000
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const

function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

/** Hours and minutes: '15:42'. */
export function clockTime(date: Date): string {
  return `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`
}

/** The weekday, the day, the month and the year: 'TUE 14 OCT 2026'. */
export function clockDate(date: Date): string {
  return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

/** The minute as a machine reads it, for <time dateTime>. */
export function clockStamp(date: Date): string {
  const day = `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`
  return `${day}T${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`
}

function useMinute(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = new Date()
      setNow((last) => (clockStamp(last) === clockStamp(next) ? last : next))
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

export function Clock() {
  const now = useMinute()
  return (
    <time className={styles.clock} dateTime={clockStamp(now)}>
      {clockTime(now)}
      <span className={styles.date}>{` · ${clockDate(now)}`}</span>
    </time>
  )
}
