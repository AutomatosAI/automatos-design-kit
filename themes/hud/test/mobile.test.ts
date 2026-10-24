// @vitest-environment node
// HUD's `mobile` block: explicit tokens, no mascot. The phone's own HUD layout reads none of it, but a phone that
// draws a theme from data alone gets HUD's ARC colours, and core's review (mobile_contrast.py, ported in the kit's
// check) measures them: each scheme's ten pairs, eight text pairs at 4.5:1 and --primary and --ring at 3:1 on the
// background. Both schemes are ARC's (HUD is never light), and they are the colours Studio's tokens paint on the
// web for ARC: theme.json is held to src/lib/looks/mobile.ts, and that to look-kit's triplets.
import { contrastRatio } from '@automatos/look-kit/contrast'
import { tripletToHex } from '@automatos/look-kit/hsl'
import {
  MOBILE_AA_TEXT,
  MOBILE_AA_UI,
  MOBILE_CONTRAST_PAIRS,
  MOBILE_TOKEN_NAMES,
  isMobileColour,
  type MobileContrastKind,
} from '@automatos/theme-cli/mobile'
import { describe, expect, it } from 'vitest'
import { lookToStudioTokens } from '../src/lib/looks/engine.ts'
import { hudMobileTokens } from '../src/lib/looks/mobile.ts'
import { ARC, DEFAULT_LOOK } from '../src/lib/looks/presets.ts'
import { readThemeJson } from './support/files.ts'

type Scheme = Readonly<Record<string, string>>

interface HudManifest {
  readonly mobile: {
    readonly tokens: { readonly light: Scheme; readonly dark: Scheme }
    readonly fromLooks?: boolean
    readonly mascot: string
    readonly fonts?: unknown
  }
}

const MINIMUM: Readonly<Record<MobileContrastKind, number>> = { text: MOBILE_AA_TEXT, ui: MOBILE_AA_UI }
const manifest = readThemeJson<HudManifest>('theme.json')
const SCHEMES = Object.entries(manifest.mobile.tokens)

describe("HUD's mobile block", () => {
  it('gives explicit tokens for both schemes, no fonts and no mascot', () => {
    expect(Object.keys(manifest.mobile).sort()).toEqual(['mascot', 'tokens'])
    expect(manifest.mobile.mascot).toBe('none')
    expect(Object.keys(manifest.mobile.tokens)).toEqual(['light', 'dark'])
  })

  it('paints from ARC, the default look', () => {
    expect(DEFAULT_LOOK).toBe(ARC)
  })

  it.each(SCHEMES)('%s holds every Studio token a phone draws, ARC\'s, as #RRGGBB', (_scheme, tokens) => {
    expect(Object.keys(tokens)).toEqual([...MOBILE_TOKEN_NAMES])
    expect(Object.values(tokens).filter((value) => !isMobileColour(value))).toEqual([])
    expect(tokens).toEqual(hudMobileTokens())
  })

  it("is the colours Studio's tokens paint on the web for ARC", () => {
    const web = lookToStudioTokens(ARC)
    const fromWeb = Object.fromEntries(MOBILE_TOKEN_NAMES.map((name) => [name, tripletToHex(web[name])]))
    expect(hudMobileTokens()).toEqual(fromWeb)
  })

  it.each(SCHEMES)('%s meets WCAG AA on all ten pairs core\'s review measures', (_scheme, tokens) => {
    expect(MOBILE_CONTRAST_PAIRS).toHaveLength(10)
    const under = MOBILE_CONTRAST_PAIRS.filter(([foreground, background, kind]) => (
      contrastRatio(tokens[foreground], tokens[background]) < MINIMUM[kind]
    ))
    expect(under).toEqual([])
  })
})
