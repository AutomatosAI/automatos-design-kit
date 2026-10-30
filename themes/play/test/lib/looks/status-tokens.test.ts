/**
 * Play 1.3.0 (PRD-268 §6.12.2, US-K01) — a row's status reads under every look Play's catalogue allows. The host's
 * proactive cards draw a state through the Studio token its role names (DISPLAY_STATE_LABELS: needs you in warn-ink
 * on a light ground and warning on a dark one, working in running, ready and done in success, failed in destructive;
 * a readiness item's needs setup in info and not checked in muted-foreground). Play's look paints those tokens: its
 * status tokens by the ground's tone (src/lib/looks/status-tokens.ts) beside Studio's tokens (destructive and
 * muted-foreground), and its first-paint table carries them (tests/compile-looks.test.ts paints them from it).
 *
 * Measured on all 4 grounds × 6 accents, Paper included, on the background and the card, as the browser draws the
 * triplets: every role as a word at 4.5:1 and as a mark at 3:1. No status takes the accent: no role names --accent or
 * --primary, and no status token is painted in the look's accent. And Play's proactive placements name no colour.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DISPLAY_STATE_LABELS } from '@automatos/theme-sdk'
import { AA_NON_TEXT, AA_TEXT, contrastRatio } from '@automatos/look-kit/contrast'
import { tripletToHex } from '@automatos/look-kit/hsl'
import { describe, expect, it } from 'vitest'

import { ACCENT_KEYS, GROUND_KEYS, type AccentKey, type GroundKey } from '../../../src/lib/looks/catalogue.ts'
import {
  isDarkGround,
  lookToStatusTokens,
  lookToStudioTokens,
  studioStatusTokens,
} from '../../../src/lib/looks/engine.ts'
import { EMBER } from '../../../src/lib/looks/presets.ts'
import {
  STATUS_TOKEN_NAMES,
  STUDIO_STATUS_DARK,
  STUDIO_STATUS_LIGHT,
} from '../../../src/lib/looks/status-tokens.ts'
import { SOURCE_ROOT } from '../../source-files.ts'

type Tokens = Readonly<Record<string, string>>

const PAIRS = GROUND_KEYS.flatMap((ground) => ACCENT_KEYS.map((accent) => ({ ground, accent })))
const PAIR_COUNT = 24
const FILLS = ['--background', '--card'] as const
/** The readiness roles (§6.12.2), which DISPLAY_STATE_LABELS' row states don't name: needs setup and not checked. */
const READINESS_TOKENS: readonly string[] = ['--info', '--muted-foreground']
/** What a status never goes through: the look's accent, as Studio's --accent and --primary carry it. */
const ACCENT_TOKENS: readonly string[] = ['--accent', '--primary']
const PROACTIVE_CSS = join(SOURCE_ROOT, 'components', 'play', 'proactive', 'proactive.module.css')
const ACCENT_VARIABLE = /--pl-(?:color-)?accent\b|var\(\s*--(?:accent|primary)\b/
const COLOUR_VALUE = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|color)\(/i

/** The tokens the look paints for one pair: Studio's, then the status tokens of its ground. */
function paintedFor(ground: GroundKey, accent: AccentKey): Tokens {
  const look = { ...EMBER, ground, accent }
  return { ...lookToStudioTokens(look), ...lookToStatusTokens(look) }
}

/** Every status role's token on this ground's tone. */
function roleTokens(dark: boolean): readonly string[] {
  const rows = Object.values(DISPLAY_STATE_LABELS).map((label) => (dark ? label.token.dark : label.token.light))
  return Array.from(new Set([...rows, ...READINESS_TOKENS]))
}

/** A painted triplet as the browser draws it. */
function drawn(tokens: Tokens, name: string): string {
  const value = tokens[name]
  if (value === undefined) throw new Error(`${name} is not painted`)
  return tripletToHex(value)
}

/** Each role token under `minimum` on the background or the card, as 'token on fill: ratio'. */
function shortfalls(tokens: Tokens, dark: boolean, minimum: number): string[] {
  return roleTokens(dark).flatMap((name) => FILLS.flatMap((fill) => {
    const ratio = contrastRatio(drawn(tokens, name), drawn(tokens, fill))
    return ratio >= minimum ? [] : [`${name} on ${fill}: ${ratio.toFixed(2)}`]
  }))
}

describe('the status tokens Play paints (PRD-268 §6.12.2)', () => {
  it("are Studio's five status tokens, Light's on a light ground and Dark's on a dark one", () => {
    expect([...STATUS_TOKEN_NAMES].sort()).toEqual(Object.keys(STUDIO_STATUS_LIGHT).sort())
    expect([...STATUS_TOKEN_NAMES].sort()).toEqual(Object.keys(STUDIO_STATUS_DARK).sort())
    GROUND_KEYS.forEach((ground) => {
      const expected = isDarkGround(ground) ? STUDIO_STATUS_DARK : STUDIO_STATUS_LIGHT
      expect({ ground, tokens: studioStatusTokens(ground) }).toEqual({ ground, tokens: expected })
    })
    expect(GROUND_KEYS.some((ground) => !isDarkGround(ground))).toBe(true)
    expect(GROUND_KEYS.some((ground) => isDarkGround(ground))).toBe(true)
  })

  it('cover every ground and accent the catalogue allows, Paper included', () => {
    expect(PAIRS).toHaveLength(PAIR_COUNT)
    expect(GROUND_KEYS).toContain('paper')
  })

  it.each(PAIRS)('$ground with $accent: every status role reads as a word and as a mark on the background and the card', ({ ground, accent }) => {
    const tokens = paintedFor(ground, accent)
    const dark = isDarkGround(ground)
    expect({ ground, accent, words: shortfalls(tokens, dark, AA_TEXT) }).toEqual({ ground, accent, words: [] })
    expect({ ground, accent, marks: shortfalls(tokens, dark, AA_NON_TEXT) }).toEqual({ ground, accent, marks: [] })
  })

  it.each(PAIRS)('$ground with $accent: no status goes through the accent', ({ ground, accent }) => {
    const tokens = paintedFor(ground, accent)
    const roles = roleTokens(isDarkGround(ground))
    expect(roles.filter((name) => ACCENT_TOKENS.includes(name))).toEqual([])
    const accents = new Set(ACCENT_TOKENS.map((name) => drawn(tokens, name)))
    expect(STATUS_TOKEN_NAMES.filter((name) => accents.has(drawn(tokens, name)))).toEqual([])
  })

  it("leave Play's proactive placements naming no colour and no accent: the host's cards draw every status", () => {
    const css = readFileSync(PROACTIVE_CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ')
    expect(css).not.toMatch(ACCENT_VARIABLE)
    expect(css).not.toMatch(COLOUR_VALUE)
  })
})
