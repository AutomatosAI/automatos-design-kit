// PRD-261 B-02e: the theme folder's files as the harness page checks and paints them. A folder core would refuse
// (a theme.json its validator rejects, a preset that is no look, a prepaint table of the wrong shape) is listed, not
// drawn, with the host's failed status and an empty report for the shots; files core would accept come back with the
// default look first. Then the port of core's paint (looks/paint.ts) on a made-up table with a pair table and a
// numeric rule capped by a cap table, as Play's glow is: each value, and the default look for one that doesn't fit.
import { THEME_TONES } from '@automatos/theme-cli/manifest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { markRefused, MANIFEST_REASON, Refused } from '../app/refused.tsx'
import { HTML_ATTRS, paintLook, paintNames, type PrepaintTable } from '../src/host/prepaint.ts'
import { readServedTheme, type ServedFiles } from '../src/host/register.ts'
import { EMPTY_SERVED, HARNESS_GLOBAL } from '../src/host/router.ts'

const PLAY_MANIFEST = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../themes/play/theme.json', import.meta.url)), 'utf8'),
) as Readonly<Record<string, unknown>>
const DUSK = Object.freeze({ schema: 'sample-look/v1', id: 'dusk', name: 'Dusk', sub: 'Dark' })
const ZED = Object.freeze({ ...DUSK, id: 'zed', name: 'Zed' })
const EMPTY_TABLE = Object.freeze({ knobs: {}, pairs: [], numeric: [], defaults: {} })
const ACCEPTED: ServedFiles = Object.freeze({ manifest: { ...PLAY_MANIFEST, look: 'zed' }, presets: [DUSK, ZED], prepaint: EMPTY_TABLE })
const noEntry = (): Promise<unknown> => Promise.resolve({})

afterEach(() => {
  const root = document.documentElement
  Array.from(root.attributes).forEach((attribute) => root.removeAttribute(attribute.name))
  Reflect.deleteProperty(window, HARNESS_GLOBAL)
})

describe("the theme folder's files", () => {
  it('come back checked when core would accept them, the default look first', () => {
    const served = readServedTheme(ACCEPTED, noEntry)
    if (!served.ok) throw new Error(served.errors.join('\n'))
    expect(served.theme.presets.map((look) => look.id)).toEqual(['zed', 'dusk'])
    expect(served.theme.prepaint).toEqual(EMPTY_TABLE)
  })

  it.each([
    ['a theme.json core refuses', { manifest: { ...PLAY_MANIFEST, tone: 'loud' } }, `theme.json tone: "tone" must be one of ${THEME_TONES.join(', ')}.`],
    ['a preset that is no look', { presets: [{ id: 'dusk' }] }, 'looks/presets: every preset needs a schema, id, name and sub as text.'],
    ['a prepaint.json that is no first-paint table', { prepaint: { knobs: [] } }, 'boot/prepaint.json is not a first-paint table.'],
  ])('are refused for %s, with the line saying why', (_name, changes: Partial<ServedFiles>, line) => {
    expect(readServedTheme({ ...ACCEPTED, ...changes }, noEntry)).toEqual({ ok: false, errors: [line] })
  })

  it("are listed instead of drawn when refused, with the host's failed status and nothing for the shots to shoot", () => {
    const errors = ['theme.json tone: "tone" is wrong.', 'boot/prepaint.json is not a first-paint table.']
    render(<Refused errors={errors} />)
    markRefused(window)
    expect(screen.getByRole('heading', { name: "The harness can't load this theme" })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(errors)
    const html = document.documentElement
    expect([html.getAttribute(HTML_ATTRS.status), html.getAttribute(HTML_ATTRS.reason)]).toEqual(['failed', MANIFEST_REASON])
    expect(Reflect.get(window, HARNESS_GLOBAL)).toEqual({ status: 'failed', views: [], missing: EMPTY_SERVED, presets: [], minWidth: 0 })
  })
})

// ---- the paint: made-up data ----

const GLOW = '--sample-glow'
const ON_ACCENT = '--sample-on-accent'
const GLOW_TABLE: PrepaintTable = {
  knobs: {
    ground: { night: { '--sample-ground': '#101010' }, day: { '--sample-ground': '#fafafa' } },
    accent: { ember: { '--sample-accent': '#ff7828' }, mint: { '--sample-accent': '#50dca0' } },
  },
  pairs: [{
    a: 'ground',
    b: 'accent',
    table: {
      night: { ember: { [ON_ACCENT]: '#ffe0c0' }, mint: { [ON_ACCENT]: '#e0fff0' } },
      day: { ember: { [ON_ACCENT]: '#401000' }, mint: { [ON_ACCENT]: '#003020' } },
    },
  }],
  numeric: [{
    var: GLOW, knob: 'glow', min: 0, max: 40, integer: true, scale: 100,
    capTable: ['ground', 'accent'], caps: { night: { ember: 0.2, mint: 0.3 }, day: { ember: 0.1, mint: 0.1 } },
    color: { knob: 'accent', rgb: { ember: '255,120,40', mint: '80,220,160' } }, template: 'rgba-alpha',
  }],
  defaults: { ground: 'night', accent: 'mint', glow: 10 },
}
const DEFAULT_PAINT = {
  '--sample-ground': '#101010', '--sample-accent': '#50dca0', [ON_ACCENT]: '#e0fff0', [GLOW]: 'rgba(80,220,160,0.1)',
}

describe("the port of core's paint", () => {
  it('paints each knob, then the pair table, then the numeric rule, capped by its cap table', () => {
    expect(paintLook(GLOW_TABLE, { ground: 'night', accent: 'ember', glow: 24 })).toEqual({
      '--sample-ground': '#101010', '--sample-accent': '#ff7828', [ON_ACCENT]: '#ffe0c0', [GLOW]: 'rgba(255,120,40,0.2)',
    })
    expect(paintLook(GLOW_TABLE, { ground: 'day', accent: 'mint', glow: 5 })).toEqual({
      '--sample-ground': '#fafafa', '--sample-accent': '#50dca0', [ON_ACCENT]: '#003020', [GLOW]: 'rgba(80,220,160,0.05)',
    })
  })

  it.each([
    ['past its max', { ground: 'night', accent: 'ember', glow: 41 }],
    ['that is not whole', { ground: 'night', accent: 'ember', glow: 24.5 }],
    ['that is not a number', { ground: 'night', accent: 'ember', glow: 'bright' }],
    ['on a ground the table has no option for', { ground: 'dusk', accent: 'ember', glow: 24 }],
  ])("paints the table's default look for a look with a glow %s", (_name, look) => {
    expect(paintLook(GLOW_TABLE, look)).toEqual(DEFAULT_PAINT)
  })

  it('names every variable the table can paint, the pair and numeric ones too', () => {
    expect([...paintNames(GLOW_TABLE)].sort()).toEqual(['--sample-accent', '--sample-ground', GLOW, ON_ACCENT].sort())
  })
})
