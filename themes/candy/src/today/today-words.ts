/**
 * Today's words: the greeting for the time of day ("Good afternoon"), the day as the hero says it ("Thursday 30
 * October"), the line under the greeting from the Needs-you total ("Three things are waiting for you."), and a count
 * as a stat card shows it ("—" while it is unknown). The SDK gives no person's name, so the greeting has none. `now`
 * and the hour are passed in, so every function is pure and every test fixed.
 */

export const UNKNOWN_FIGURE = '—'
export const ON_IT = 'Your agents are on it.'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
] as const
/** The counts the line spells out, as the design writes "Three things". */
const SPELLED = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'] as const

const AFTERNOON_FROM = 12
const EVENING_FROM = 18

/** "Good morning" before noon, "Good afternoon" until six, then "Good evening". */
export function greetingFor(hour: number): string {
  if (hour < AFTERNOON_FROM) return 'Good morning'
  if (hour < EVENING_FROM) return 'Good afternoon'
  return 'Good evening'
}

/** The day in full, in the person's own time: "Thursday 30 October". */
export function longDate(now: number): string {
  const day = new Date(now)
  return `${DAYS[day.getDay()]} ${day.getDate()} ${MONTHS[day.getMonth()]}`
}

function countWord(count: number): string {
  return count < SPELLED.length ? SPELLED[count] : String(count)
}

/** The line under the greeting: what waits for the person, or the first sentence alone until the total is known. */
export function waitingLine(total: number | null): string {
  if (total === null || !Number.isFinite(total) || total < 0) return ON_IT
  if (total === 0) return `${ON_IT} Nothing is waiting for you.`
  if (total === 1) return `${ON_IT} One thing is waiting for you.`
  return `${ON_IT} ${countWord(total)} things are waiting for you.`
}

/** A count as a card shows it: the number, or "—" while it is unknown. */
export function figureOf(count: number | null | undefined): string {
  return typeof count === 'number' && Number.isFinite(count) ? String(count) : UNKNOWN_FIGURE
}
