// @vitest-environment node
// Play 1.2.0 — how Play styles the host's voice button (composer.module.css): only through the button's own data
// attributes (data-voice-button="root" and "press", the root's data-voice-state, -mode, -press, -size and -mic) and
// the --voice-button-* custom properties, all under Play's own .voice slot; never core's caption, stop control,
// notices or screen reader line, which no Play stylesheet names; and no rule there hides, clips or covers anything.
// A static check of the stylesheets' text (css: false).
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { cssRules } from '../support/css-cascade.ts'
import { declarations, definedProperties, playCssFiles, readProperties, relative } from '../support/play-css.ts'
import { readSource, THEME_ROOT } from '../source-files.ts'

const COMPOSER_CSS = 'components/play/chat/composer.module.css'
/** The SDK's voice area, which names the custom properties a theme styles the button with. */
const SDK_VOICE_AREA = path.join(THEME_ROOT, '..', '..', 'packages', 'theme-sdk', 'areas', 'voice.d.ts')
const VOICE_BUTTON_VAR = /--voice-button-[a-z-]+/g
/** A selector part naming the voice button. */
const NAMES_VOICE = /data-voice|voice-button/
/** The voice button's own data attributes a theme styles it by (areas/voice.d.ts). */
const STYLED_BY = /\[data-voice-(?:button="(?:root|press)"|(?:state|mode|press|size|mic)="[a-z]+")\]/g
/** Core's parts of the button no theme may style: the caption, the stop control's slot, the notices, the status line. */
const CORE_PARTS = /data-voice-control-slot|data-voice-notice|data-voice-status|ai-voice-label|data-protected-surface/
/** What would hide, clip or cover a part of the button. */
const HIDES: Readonly<Record<string, RegExp>> = {
  display: /^none$/,
  visibility: /^(?:hidden|collapse)$/,
  opacity: /^0(?:\.0+)?$/,
  overflow: /^(?:hidden|clip)$/,
  'clip-path': /./,
  clip: /./,
  height: /^0/,
  'max-height': /^0/,
  position: /^(?:absolute|fixed)$/,
  'z-index': /./,
}

const voiceRules = () => cssRules(readSource(COMPOSER_CSS)).filter((rule) => rule.selectors.some((selector) => NAMES_VOICE.test(selector)))

describe("Play's styling of the voice button", () => {
  it("sets every custom property the SDK names for the button, and reads none of them (css-guards.test.ts lets it)", () => {
    const named = new Set(Array.from(fs.readFileSync(SDK_VOICE_AREA, 'utf8').matchAll(VOICE_BUTTON_VAR), (match) => match[0]))
    expect(named.size).toBe(7)
    const css = readSource(COMPOSER_CSS)
    expect(definedProperties(css).filter((name) => name.startsWith('--voice-button-')).sort()).toEqual([...named].sort())
    const reading = playCssFiles().flatMap((file) => readProperties(fs.readFileSync(file, 'utf8')).filter((name) => name.startsWith('--voice-')))
    expect(reading).toEqual([])
  })

  it('names the button only by its own data attributes, under .voice', () => {
    const rules = voiceRules()
    expect(rules.length).toBeGreaterThan(0)
    const stray = rules.flatMap((rule) => rule.selectors).filter((selector) => {
      const rest = selector.replace(STYLED_BY, '').replace(/:hover|:not\(:disabled\)/g, '')
      return !selector.startsWith('.voice ') || NAMES_VOICE.test(rest)
    })
    expect(stray).toEqual([])
  })

  it("names none of core's own parts in any of Play's stylesheets", () => {
    const naming = playCssFiles().filter((file) => CORE_PARTS.test(fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')))
    expect(naming.map(relative)).toEqual([])
  })

  it('hides, clips and covers nothing of the button, its slot included', () => {
    const slot = cssRules(readSource(COMPOSER_CSS)).filter((rule) => rule.selectors.includes('.voice'))
    const hiding = [...voiceRules(), ...slot].flatMap((rule) => {
      const declared = declarations(rule.body)
      return Object.entries(HIDES)
        .filter(([property, pattern]) => pattern.test(declared.get(property) ?? ''))
        .map(([property]) => `${rule.selectors.join(', ')}: ${property}`)
    })
    expect(hiding).toEqual([])
  })

  it('gives the press a tap-sized square and the look\'s colours: the text at rest, the accent and its ink while it hears', () => {
    const slot = declarations(cssRules(readSource(COMPOSER_CSS)).filter((rule) => rule.selectors.includes('.voice')).map((rule) => rule.body).join(';'))
    expect(slot.get('--voice-button-size')).toBe('var(--pl-tap-min)')
    expect(slot.get('--voice-button-fg')).toBe('var(--pl-color-text)')
    expect(slot.get('--voice-button-active-bg')).toBe('var(--pl-color-accent)')
    expect(slot.get('--voice-button-active-fg')).toBe('var(--pl-color-accent-ink)')
    expect(slot.get('--voice-button-ring')).toBe('var(--pl-color-accent-text)')
  })
})
