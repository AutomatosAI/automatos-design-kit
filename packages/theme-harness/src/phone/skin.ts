/**
 * What Automatos Go draws for the theme the harness serves, decided as the app decides it (its
 * src/styles/themes/follow.ts `followStudio` :43-:49, at the Automatos Go commit packages/theme-cli's README names):
 *
 * - built in: automatos/play and automatos/hud are the phone's own Play and HUD layouts (BUILT_IN_THEME_STYLES
 *   :26-:29), painted from the member's looks; the phone reads none of their `mobile` block;
 * - a skin: any other theme whose answer (core's GET /api/themes/mobile, theme-cli's mobileAnswer) paints, over the
 *   Studio layout (theme-cli's phonePaint);
 * - Studio: no block, no answer (a fromLooks table that paints nothing) or no painting (no ground and text), so the
 *   phone does not offer the theme and draws Studio's own colours.
 *
 * The answer's file URLs are the harness's (its files root, where the build serves the folder's assets/), each only
 * for a file the folder holds. No DOM.
 */
import { mobileAnswer, type MobileAnswer } from '@automatos/theme-cli/mobile-answer'
import { phonePaint, type PhonePaint } from '@automatos/theme-cli/phone'
import type { HostLook } from '@automatos/theme-sdk'
import type { HarnessTheme } from '../host/register.ts'
import { FILES_ROOT } from '../host/router.ts'
import { NO_STORED_LOOK } from './settings.ts'

export type BuiltInStyle = 'play' | 'hud'

/** follow.ts BUILT_IN_THEME_STYLES: the web themes that are a built-in phone style. */
export const BUILT_IN_THEME_STYLES: Readonly<Record<string, BuiltInStyle>> = Object.freeze({
  'automatos/play': 'play',
  'automatos/hud': 'hud',
})

/** The theme folder's files the phone view reads. */
export interface PhoneSource {
  /** theme.json, checked. */
  readonly manifest: Readonly<Record<string, unknown>>
  /** The default look first (register.ts orderedPresets). */
  readonly presets: readonly HostLook[]
  readonly prepaint: unknown
  /** Every file under assets/, as 'assets/<path>'. */
  readonly assets: readonly string[]
}

/** The phone view's source for a served theme and the folder's asset paths. */
export function phoneSourceOf(theme: Pick<HarnessTheme, 'manifest' | 'presets' | 'prepaint'>, assets: readonly string[]): PhoneSource {
  const manifest = theme.manifest as unknown as Readonly<Record<string, unknown>>
  return { manifest, presets: theme.presets, prepaint: theme.prepaint, assets }
}

export type StudioReason = 'no-block' | 'no-answer' | 'no-paint'

export type PhoneMode =
  | { readonly kind: 'built-in'; readonly style: BuiltInStyle }
  | { readonly kind: 'skin'; readonly answer: MobileAnswer; readonly paint: PhonePaint }
  | { readonly kind: 'studio'; readonly reason: StudioReason; readonly answer: MobileAnswer | null }

export function builtInStyleOf(themeId: unknown): BuiltInStyle | null {
  if (typeof themeId !== 'string') return null
  return Object.prototype.hasOwnProperty.call(BUILT_IN_THEME_STYLES, themeId) ? BUILT_IN_THEME_STYLES[themeId] : null
}

/** The member's look a setting names: that preset, the default look (the first) for null, none for NO_STORED_LOOK. */
export function memberLook(presets: readonly HostLook[], look: string | null): HostLook | null {
  if (look === NO_STORED_LOOK) return null
  return presets.find((preset) => preset.id === look) ?? presets[0] ?? null
}

/** The server's answer for the member's look, its URLs on the harness's files root. */
export function answerFor(source: PhoneSource, look: string | null): MobileAnswer | null {
  const held = new Set(source.assets)
  const files = { prepaint: source.prepaint, has: (path: string) => held.has(path), url: (path: string) => `${FILES_ROOT}${path}` }
  return mobileAnswer(source.manifest, files, memberLook(source.presets, look))
}

/** What the phone draws for the theme and the member's look (module comment). */
export function phoneMode(source: PhoneSource, look: string | null): PhoneMode {
  const style = builtInStyleOf(source.manifest.id)
  if (style !== null) return { kind: 'built-in', style }
  const answer = answerFor(source, look)
  const paint = phonePaint(answer)
  if (answer !== null && paint !== null) return { kind: 'skin', answer, paint }
  const hasBlock = typeof source.manifest.mobile === 'object' && source.manifest.mobile !== null
  return { kind: 'studio', reason: !hasBlock ? 'no-block' : answer === null ? 'no-answer' : 'no-paint', answer }
}

/** True when the theme's phone painting comes from its looks (its block's fromLooks), so the look switch applies. */
export function paintsFromLooks(source: PhoneSource): boolean {
  const block = source.manifest.mobile
  return typeof block === 'object' && block !== null && (block as Readonly<Record<string, unknown>>).fromLooks === true
}
