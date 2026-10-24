/**
 * A theme the phone draws in its own built-in layout (automatos/play and automatos/hud: the app's
 * src/styles/themes/follow.ts BUILT_IN_THEME_STYLES): Automatos Go switches to its native Play or HUD layout, painted
 * from the member's looks, and reads none of the theme's `mobile` block. The harness carries neither native layout,
 * so the phone view says so and draws the theme's own web screens at the phone's 390-pixel width instead, through the
 * harness's own host (app/host.tsx), with the look switch as its preset: Chat on /chat, the Command Centre on core's
 * /command-center, First open on the home page. The host draws the theme with its minWidth the phone's width
 * (atPhoneWidth), so neither the host nor the theme's own layout hook falls back to the host's page there.
 */
import { DEFAULT_SETTINGS, type HarnessSettings } from '../../src/host/router.ts'
import type { HarnessTheme } from '../../src/host/register.ts'
import type { PhoneScreen, PhoneSettings } from '../../src/phone/settings.ts'
import { memberLook, type BuiltInStyle } from '../../src/phone/skin.ts'
import { HarnessHost } from '../host.tsx'
import { PHONE } from './frame.tsx'

/** The web path each phone screen is drawn from. */
export const BUILT_IN_PATHS: Readonly<Record<PhoneScreen, string>> = Object.freeze({
  'chat': '/chat',
  'command-centre': '/command-center',
  'first-open': '/',
})

export const BUILT_IN_NAMES: Readonly<Record<BuiltInStyle, string>> = Object.freeze({ play: 'Play', hud: 'HUD' })

/** One copy per theme, so the host keeps the same theme across renders (it loads the entry once per theme). */
const AT_PHONE_WIDTH = new WeakMap<HarnessTheme, HarnessTheme>()

/** The theme as the phone view's host draws it: its minWidth the phone's width. */
export function atPhoneWidth(theme: HarnessTheme): HarnessTheme {
  const known = AT_PHONE_WIDTH.get(theme)
  if (known !== undefined) return known
  const phone: HarnessTheme = { ...theme, manifest: { ...theme.manifest, minWidth: PHONE.width } }
  AT_PHONE_WIDTH.set(theme, phone)
  return phone
}

/** The harness host's settings for the phone's: the screen's path, the look as the preset, the phone's width. */
export function hostSettingsOf(theme: HarnessTheme, phone: PhoneSettings): HarnessSettings {
  return {
    ...DEFAULT_SETTINGS,
    path: BUILT_IN_PATHS[phone.screen],
    preset: memberLook(theme.presets, phone.look)?.id ?? null,
    width: PHONE.width,
    tone: phone.scheme,
    reducedMotion: phone.reducedMotion,
    toolbar: false,
  }
}

export interface BuiltInPhoneProps {
  readonly theme: HarnessTheme
  /** The host's settings now (hostSettingsOf), which the phone page keeps the fake host on. */
  readonly settings: HarnessSettings
}

/** The theme's own screen at the phone's width, scrolling inside the phone. */
export function BuiltInPhone({ theme, settings }: BuiltInPhoneProps) {
  return (
    <div data-go-built-in={theme.manifest.id} style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#ffffff' }}>
      <HarnessHost theme={atPhoneWidth(theme)} initial={settings} settings={settings} />
    </div>
  )
}
