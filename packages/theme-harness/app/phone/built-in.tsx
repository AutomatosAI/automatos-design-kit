/**
 * A theme the phone draws in its own built-in layout (automatos/play and automatos/hud: the app's
 * src/styles/themes/follow.ts BUILT_IN_THEME_STYLES): Automatos Go switches to its native Play or HUD layout, painted
 * from the member's looks, and reads none of the theme's `mobile` block. The harness carries neither native layout,
 * so the phone view says so and draws the theme's own web screens at the phone's 390-pixel width instead, through the
 * harness's own host (app/host.tsx, its `phone` mode: whatever the theme's minWidth), with the look switch as its
 * preset: Chat on /chat, the Command Centre on core's /command-center, First open on the home page.
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
      <HarnessHost theme={theme} initial={settings} settings={settings} phone />
    </div>
  )
}
