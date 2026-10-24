import { useEffect, useState } from 'react'

import styles from './top-bar.module.css'

/**
 * The top bar's clock ("15:42 · TUE 14 OCT 2026", the design's centre), in the browser's own time zone, to the
 * minute. It reads the time once a second and draws only when the minute changes.
 */

const TICK_MS = 1000
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const

function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

/** The clock's words for a moment: hours and minutes, the weekday, the day, the month and the year. */
export function clockText(date: Date): string {
  const time = `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`
  return `${time} · ${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
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
      {clockText(now)}
    </time>
  )
}
