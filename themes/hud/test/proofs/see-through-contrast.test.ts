// @vitest-environment node
// HUD's text on its see-through fills, which `automatos-theme check design` can't measure: design/contrast.json
// names opaque colours only, and the check reads an rgba() value as no colour. So here, on every one of the 24
// grounds and accents, each fill HUD draws text on is laid over the ground as a browser lays it (look-kit's mixHex,
// channel by channel): the panel's fill, the accent fill of a pressed or current item, the Looks drawer's glass and
// the glow at its strongest; and, as the page paints it, a panel's fill over the glow at its strongest, since every
// panel lies over the backdrop's glow. On each, the four text colours the stylesheets set there (the text, the second
// text, the accent as text and the error as text) read at WCAG AA, by look-kit's own ratio. HUD's glow cap
// (src/lib/looks/engine.ts) is where the last of them still does in a panel over the glow.
import { AA_TEXT, contrastRatio, mixHex } from '@automatos/look-kit/contrast'
import * as kitCss from '@automatos/look-kit/css'
import { describe, expect, it } from 'vitest'
import { ACCENTS, ACCENT_KEYS, GROUND_KEYS, type AccentKey, type GroundKey } from '../../src/lib/looks/catalogue.ts'
import { HUD_LOOK_CATALOGUE, safeGlowAlpha } from '../../src/lib/looks/engine.ts'
import { ARC } from '../../src/lib/looks/presets.ts'
import { GLOW_MAX } from '../../src/lib/looks/types.ts'
import { GLOW_VAR, lookToCssVars } from '../../src/lib/looks/vars.ts'

/** The see-through fills HUD draws text on, each over the ground. */
const FILLS = ['--hud-panel-fill', '--hud-accent-fill', '--hud-drawer', GLOW_VAR] as const
const PANEL_OVER_GLOW = '--hud-panel-fill over --hud-glow'
const TEXTS = ['--hud-text', '--hud-text-2', '--hud-accent-text', '--hud-error-text'] as const
const RGBA = /^rgba\((\d{1,3}),(\d{1,3}),(\d{1,3}),(\d*\.?\d+)\)$/

const COMBOS = GROUND_KEYS.flatMap((ground) => ACCENT_KEYS.map((accent): [GroundKey, AccentKey] => [ground, accent]))

/** `rgba` laid over the opaque `bg`, as one #RRGGBB colour. */
function over(bg: string, rgba: string): string {
  const match = RGBA.exec(rgba)
  if (match === null) throw new Error(`${rgba} isn't rgba(r,g,b,a)`)
  const hex = `#${match.slice(1, 4).map((channel) => Number(channel).toString(16).padStart(2, '0')).join('')}`
  return mixHex(bg, hex, Number(match[4]))
}

describe('the see-through fills parse as the stylesheets paint them', () => {
  it("lays an rgba() over the ground by its alpha, and refuses what isn't one", () => {
    expect(over('#000000', 'rgba(255,255,255,0.5)')).toBe('#808080')
    expect(over('#102030', 'rgba(255,0,0,0)')).toBe('#102030')
    expect(() => over('#000000', '#FFFFFF')).toThrow(/isn't rgba/)
  })
})

/** What text is laid on under a look: each see-through fill over the ground, and a panel's fill over the glow. */
function behinds(vars: Readonly<Record<string, string>>): readonly { readonly fill: string; readonly behind: string }[] {
  const bg = vars['--hud-bg']
  const onGround = FILLS.map((fill) => ({ fill, behind: over(bg, vars[fill]) }))
  return [...onGround, { fill: PANEL_OVER_GLOW, behind: over(over(bg, vars[GLOW_VAR]), vars['--hud-panel-fill']) }]
}

describe("HUD's text on its see-through fills reads at WCAG AA on every ground and accent", () => {
  it.each(COMBOS)('%s with %s', (ground, accent) => {
    const vars = lookToCssVars({ ...ARC, ground, accent, glow: GLOW_MAX })
    const under = behinds(vars).flatMap(({ fill, behind }) =>
      TEXTS.map((text) => ({ text, fill, ratio: contrastRatio(vars[text], behind) })),
    ).filter(({ ratio }) => ratio < AA_TEXT)
    expect(under).toEqual([])
  })

  it("caps the glow below look-kit's cap, which measures the glow over the ground alone and leaves a panel under AA", () => {
    const vars = lookToCssVars(ARC)
    const kitAlpha = kitCss.safeGlowAlpha(HUD_LOOK_CATALOGUE, ARC.ground, ARC.accent)
    expect(safeGlowAlpha(ARC.ground, ARC.accent)).toBeLessThan(kitAlpha)
    const panelAtKitCap = over(mixHex(vars['--hud-bg'], ACCENTS[ARC.accent].hex, kitAlpha), vars['--hud-panel-fill'])
    expect(Math.min(...TEXTS.map((text) => contrastRatio(vars[text], panelAtKitCap)))).toBeLessThan(AA_TEXT)
  })
})
