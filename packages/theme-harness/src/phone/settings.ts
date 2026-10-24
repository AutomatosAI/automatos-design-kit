/**
 * The phone view's settings (app/phone/page.tsx, on the harness's PHONE_PATH), as the query string a reload opens it
 * with, with no DOM and no React: which of Automatos Go's screens, the user's Light / Dark, the member's look (for a
 * theme whose phone painting comes from its looks, or one the phone draws in its own Play or HUD layout) and reduced
 * motion. A missing or malformed value is the default's.
 */
export const PHONE_SCREENS = ['chat', 'command-centre', 'first-open'] as const
export type PhoneScreen = (typeof PHONE_SCREENS)[number]
export type PhoneScheme = 'light' | 'dark'

/** The member's look: one of the theme's presets by id, or no stored look (the server paints the table's defaults). */
export const NO_STORED_LOOK = '~defaults'

export interface PhoneSettings {
  readonly screen: PhoneScreen
  /** The user's Light / Dark; a painting from looks fixes its own. */
  readonly scheme: PhoneScheme
  /** A preset's id, NO_STORED_LOOK, or null: the theme's default look (its first preset). */
  readonly look: string | null
  readonly reducedMotion: boolean
}

export const DEFAULT_PHONE_SETTINGS: PhoneSettings = Object.freeze({
  screen: 'chat',
  scheme: 'light',
  look: null,
  reducedMotion: false,
})

const PARAM = Object.freeze({ screen: 'screen', scheme: 'scheme', look: 'look', motion: 'motion' })
const REDUCE = 'reduce'
/** core's LOOK_ID_PATTERN (router.ts PRESET_ID). */
const LOOK_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

const isScreen = (value: string | null): value is PhoneScreen => PHONE_SCREENS.some((screen) => screen === value)

function lookOf(value: string | null): string | null {
  if (value === NO_STORED_LOOK) return NO_STORED_LOOK
  return value !== null && LOOK_ID.test(value) ? value : null
}

/** The settings a query string names. */
export function readPhoneSettings(search: string): PhoneSettings {
  const params = new URLSearchParams(search)
  const screen = params.get(PARAM.screen)
  return Object.freeze({
    screen: isScreen(screen) ? screen : DEFAULT_PHONE_SETTINGS.screen,
    scheme: params.get(PARAM.scheme) === 'dark' ? 'dark' : 'light',
    look: lookOf(params.get(PARAM.look)),
    reducedMotion: params.get(PARAM.motion) === REDUCE,
  })
}

/** The query string (with its '?', or '' for the defaults) that readPhoneSettings reads back as `settings`. */
export function phoneQuery(settings: PhoneSettings): string {
  const params = new URLSearchParams()
  if (settings.screen !== DEFAULT_PHONE_SETTINGS.screen) params.set(PARAM.screen, settings.screen)
  if (settings.scheme !== DEFAULT_PHONE_SETTINGS.scheme) params.set(PARAM.scheme, settings.scheme)
  if (settings.look !== null) params.set(PARAM.look, settings.look)
  if (settings.reducedMotion) params.set(PARAM.motion, REDUCE)
  const query = params.toString()
  return query === '' ? '' : `?${query}`
}
