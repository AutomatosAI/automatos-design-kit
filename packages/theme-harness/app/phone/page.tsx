/**
 * The phone view, on the harness's PHONE_PATH: what Automatos Go draws for the theme the harness serves, beside its
 * contrast as `automatos-theme check` measures it. Its controls pick the screen, the user's Light / Dark, the member's
 * look and reduced motion (src/phone/settings.ts, in the address).
 *
 * - A theme with a phone painting (src/phone/skin.ts): the Studio layout at 390 × 844, painted from the server's
 *   answer as the app paints it (studio/), with where each token lands.
 * - A theme with no painting: the same layout in Studio's own colours, saying why the phone offers it no painting.
 * - automatos/play and automatos/hud: the phone's built-in layout, which the harness has not got: the theme's own web
 *   screens at the phone's width instead (built-in.tsx), saying so.
 */
import { paintScheme, STUDIO_COLOURS, type StudioColours } from '@automatos/theme-cli/phone'
import type { HostLook } from '@automatos/theme-sdk'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { host } from '../../src/host.ts'
import type { HarnessTheme } from '../../src/host/register.ts'
import type { HarnessSettings } from '../../src/host/router.ts'
import { measurePhone, shownSubject } from '../../src/phone/contrast.ts'
import type { PhoneScheme, PhoneSettings } from '../../src/phone/settings.ts'
import {
  builtInStyleOf, memberLook, paintsFromLooks, phoneMode, phoneSourceOf, type PhoneMode, type PhoneSource,
} from '../../src/phone/skin.ts'
import { mountLooks, prepareHost, presetOf, themeTone } from '../host.tsx'
import { BUILT_IN_NAMES, BuiltInPhone, hostSettingsOf } from './built-in.tsx'
import { ContrastPanel } from './contrast-panel.tsx'
import { PhoneControls } from './controls.tsx'
import { PHONE, PhoneFrame } from './frame.tsx'
import { StudioPhone } from './studio/studio-phone.tsx'
import { TokenPanel } from './token-panel.tsx'

export const STUDIO_REASONS = Object.freeze({
  'no-block': 'theme.json has no mobile block, so Automatos Go offers no phone painting for this theme and draws Studio.',
  'no-answer': "The block paints from the looks, but the prepaint table paints no ground or text: the server sends no painting, so the phone draws Studio.",
  'no-paint': 'No scheme of the block gives both --background and --foreground, so the phone offers no painting and draws Studio.',
})

const PAGE_STYLE: CSSProperties = Object.freeze({ minHeight: '100vh', margin: 0, background: '#e4e4e7', color: '#18181b', fontFamily: 'system-ui, sans-serif' })
const BODY_STYLE: CSSProperties = Object.freeze({ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '24px', padding: '16px' })
const SIDE_STYLE: CSSProperties = Object.freeze({ display: 'flex', flexDirection: 'column', gap: '16px', flex: '1 1 320px', minWidth: 0 })
const NOTICE_STYLE: CSSProperties = Object.freeze({ margin: 0, padding: '12px 16px', background: '#ffffff', border: '1px solid #a1a1aa', borderRadius: '8px', maxWidth: '520px' })

/** The fake host before the first render: a built-in theme is drawn through the harness's host at the phone's settings. */
export function preparePhone(theme: HarnessTheme, settings: PhoneSettings): void {
  if (builtInStyleOf(theme.manifest.id) !== null) prepareHost(theme, hostSettingsOf(theme, settings), PHONE.width)
}

/** The tone the painting or the theme sets over the user's Light / Dark; null while theirs holds. */
function forcedSchemeOf(theme: HarnessTheme, mode: PhoneMode, settings: PhoneSettings): PhoneScheme | null {
  if (mode.kind === 'skin') return mode.paint.tone
  if (mode.kind === 'built-in') return themeTone(theme, presetOf(theme, memberLook(theme.presets, settings.look)?.id ?? null))
  return null
}

/** The looks the switch offers: a built-in theme's presets, and a painting from looks'. */
function lookChoices(source: PhoneSource, mode: PhoneMode): readonly HostLook[] {
  return mode.kind === 'built-in' || paintsFromLooks(source) ? source.presets : []
}

function noticeOf(theme: HarnessTheme, mode: PhoneMode): string {
  if (mode.kind === 'studio') return STUDIO_REASONS[mode.reason]
  if (mode.kind === 'skin') return `Automatos Go paints this theme's mobile block (${mode.answer.source}) over its Studio layout.`
  return `On a phone, ${theme.manifest.id} switches Automatos Go to its built-in ${BUILT_IN_NAMES[mode.style]} layout, `
    + "painted from the member's looks: the phone reads none of the theme's mobile block. The harness has no native "
    + 'layout, so the phone here shows the theme’s own web screens at 390 pixels wide.'
}

interface ScreenProps {
  readonly theme: HarnessTheme
  readonly mode: PhoneMode
  readonly settings: PhoneSettings
  readonly scheme: PhoneScheme
  /** The harness host's settings for a built-in theme (hostSettingsOf). */
  readonly hostSettings: HarnessSettings
}

function shownColoursOf(mode: PhoneMode, scheme: PhoneScheme): StudioColours {
  return mode.kind === 'skin' ? mode.paint.colours[paintScheme(mode.paint, scheme)] : STUDIO_COLOURS[scheme]
}

function PhoneScreenOf({ theme, mode, settings, scheme, hostSettings }: ScreenProps) {
  const label = `Automatos Go, ${PHONE.width} × ${PHONE.height}`
  if (mode.kind === 'built-in') {
    return (
      <PhoneFrame tone={scheme} label={label} bars={false}>
        <BuiltInPhone theme={theme} settings={hostSettings} />
      </PhoneFrame>
    )
  }
  const paint = mode.kind === 'skin' ? mode.paint : null
  return (
    <PhoneFrame tone={scheme} label={label}>
      <StudioPhone
        colours={shownColoursOf(mode, scheme)} scheme={scheme} fonts={paint?.fonts ?? {}} mascot={paint?.mascot ?? null}
        reducedMotion={settings.reducedMotion} screen={settings.screen}
      />
    </PhoneFrame>
  )
}

/** A built-in theme's host follows a change: its look runtime on a new look, its path on a new screen. */
function followHost(theme: HarnessTheme, before: PhoneSettings, next: PhoneSettings): void {
  const [was, now] = [hostSettingsOf(theme, before), hostSettingsOf(theme, next)]
  if (was.preset !== now.preset) mountLooks(theme, now)
  if (was.path !== now.path) host.setPathname(now.path)
}

export interface PhonePageProps {
  readonly theme: HarnessTheme
  /** The theme folder's files under assets/ (the build's served module). */
  readonly assets: readonly string[]
  /** The settings the page opened with; preparePhone has already set the fake host to them. */
  readonly initial: PhoneSettings
  /** Every change, for the address bar. */
  readonly onSettings?: (settings: PhoneSettings) => void
}

export function PhonePage({ theme, assets, initial, onSettings }: PhonePageProps) {
  const source = useMemo(() => phoneSourceOf(theme, assets), [theme, assets])
  const [settings, setSettings] = useState(initial)
  const mode = useMemo(() => phoneMode(source, settings.look), [source, settings.look])
  const measure = useMemo(() => measurePhone(source), [source])
  const forced = forcedSchemeOf(theme, mode, settings)
  const scheme = forced ?? settings.scheme
  const hostSettings = useMemo(() => hostSettingsOf(theme, settings), [theme, settings])
  useEffect(() => {
    onSettings?.(settings)
  }, [settings, onSettings])
  const change = (next: PhoneSettings): void => {
    if (mode.kind === 'built-in') followHost(theme, settings, next)
    setSettings(next)
  }
  const themed = mode.kind === 'skin' ? mode.paint.themed[paintScheme(mode.paint, scheme)] : null
  return (
    <main data-phone-mode={mode.kind} style={PAGE_STYLE}>
      <PhoneControls settings={settings} forcedScheme={forced} looks={lookChoices(source, mode)}
        offerDefaults={mode.kind !== 'built-in' && paintsFromLooks(source)} onChange={change} />
      <div style={BODY_STYLE}>
        <PhoneScreenOf theme={theme} mode={mode} settings={settings} scheme={scheme} hostSettings={hostSettings} />
        <div style={SIDE_STYLE}>
          <p role="status" data-phone-notice={mode.kind} style={NOTICE_STYLE}>{noticeOf(theme, mode)}</p>
          <ContrastPanel measure={measure} shown={shownSubject(source, measure, { scheme, look: settings.look })} />
          {mode.kind === 'built-in' ? null : <TokenPanel colours={shownColoursOf(mode, scheme)} themed={themed} />}
        </div>
      </div>
    </main>
  )
}
