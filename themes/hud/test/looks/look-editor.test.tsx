// The LOOK page (lookEditor@1) on the harness's look runtime: the drawer of "Automatos Command HUD.dc.html" beside
// its preview. Every control goes through the SDK's looks area, so the look the runtime holds changes at once (the
// host paints it on <html>, HUD's variables and Studio's tokens, and every page follows): each knob changes what
// is painted, a preset applies, Save as new look keeps the look and a reload reads it back, Reset goes back to the
// look's preset or saved values, and Delete drops a saved one. Until the looks are read the page is its heading
// alone, busy; outside a look runtime it says nothing is kept and shows the host's words. Roles, attributes and
// text only: CSS modules are proxies here (test/looks/motion-css.test.ts reads the stylesheets).
import { renderToString } from 'react-dom/server'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hexToTriplet } from '@automatos/look-kit/hsl'
import { host } from '@automatos/theme-harness/host'
import { ACCENTS, ACCENT_KEYS, FONTS, FONT_KEYS, GROUNDS, GROUND_KEYS } from '../../src/lib/looks/catalogue.ts'
import { rgba } from '../../src/lib/looks/engine.ts'
import { ARC, FORGE, GHOST, NOVA, PRESETS } from '../../src/lib/looks/presets.ts'
import { GLOW_MAX, GLOW_MIN, GLOW_SCALE, GRID_SCALE, type HudLook, type KnobName } from '../../src/lib/looks/types.ts'
import { GLOW_VAR, GRID_VAR } from '../../src/lib/looks/vars.ts'
import { glowCap } from '../../src/looks/editing.ts'
import { DELETE_LABEL, DRAWER_LABEL, REFUSED_TITLE, RESET_LABEL, SAVE_AS_LABEL } from '../../src/looks/look-drawer.tsx'
import { cappedGlowText, glowCapNote } from '../../src/looks/look-knobs.tsx'
import { LOOK_TITLE, NO_RUNTIME, NOT_KEPT, STYLE_SHEET_LINK } from '../../src/looks/look-screen.tsx'
import {
  card, drawer, editorTree, group, heldLook, heldVar, lookHeld, looksRow, mountLooks, myLook, press, renderEditor,
  savedLooks, setSlider, slider, startLooksTest, statusLine, switchButton, type User,
} from './looks-harness.tsx'

const NOT_AVAILABLE = "Looks aren't available here."
const heading = () => screen.getByRole('heading', { level: 1, name: LOOK_TITLE })
const actionButton = (name: string) => drawer().getByRole('button', { name })

beforeEach(() => {
  startLooksTest()
  // A refused save is logged as a warning.
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

describe('the LOOK page', () => {
  it('shows its heading, the status, the preview, the looks row and the eight knobs', async () => {
    renderEditor()
    await lookHeld(ARC)
    expect(heading()).toHaveAttribute('data-theme-heading', 'true')
    expect(statusLine()).toHaveTextContent(/^ARC$/)
    expect(screen.getByRole('link', { name: STYLE_SHEET_LINK })).toHaveAttribute('href', '/looks/style')
    expect(screen.getByRole('region', { name: 'Preview' })).toBeInTheDocument()
    expect(looksRow().getAllByRole('button').map((button) => button.textContent)).toEqual(PRESETS.map((look) => look.name))
    expect(card('ARC')).toHaveAttribute('aria-pressed', 'true')
    expect(card('FORGE')).toHaveAttribute('aria-pressed', 'false')
    for (const name of ['Accent · Arc', 'Background', 'Type']) expect(screen.getByRole('group', { name })).toBeInTheDocument()
    expect(slider('Grid')).toHaveValue(String(ARC.grid))
    expect(slider('Grid')).toHaveAttribute('max', '30')
    expect(slider('Glow')).toHaveValue(String(ARC.glow))
    for (const name of ['Scan', 'Auto', 'Motion'] as const) expect(switchButton(name)).toHaveAttribute('aria-pressed', 'true')
    expect(actionButton(SAVE_AS_LABEL)).toBeEnabled()
    expect(actionButton(RESET_LABEL)).toBeEnabled()
    expect(drawer().queryByRole('button', { name: DELETE_LABEL })).toBeNull()
  })

  it.each(PRESETS)('applies $name through the SDK: the runtime holds it, the page paints it, its card and knobs pressed', async (preset) => {
    const user = userEvent.setup()
    renderEditor()
    await lookHeld(ARC)
    await user.click(card(preset.name))
    await lookHeld(preset)
    expect(heldVar('--hud-accent')).toBe(ACCENTS[preset.accent].hex)
    expect(heldVar('--hud-bg')).toBe(GROUNDS[preset.ground].bg)
    expect(looksRow().getAllByRole('button', { pressed: true }).map((button) => button.textContent)).toEqual([preset.name])
    expect(statusLine()).toHaveTextContent(new RegExp(`^${preset.name}$`))
    expect(group(/^Accent/).getByRole('button', { name: ACCENTS[preset.accent].name })).toHaveAttribute('aria-pressed', 'true')
    expect(group('Type').getByRole('button', { name: FONTS[preset.font].name })).toHaveAttribute('aria-pressed', 'true')
    expect(slider('Grid')).toHaveValue(String(preset.grid))
    expect(switchButton('Auto')).toHaveAttribute('aria-pressed', String(preset.auto === 'on'))
  })
})

interface KnobCase {
  readonly knob: KnobName
  readonly change: (user: User) => Promise<void> | void
  readonly look: HudLook
  readonly variable: string
  readonly value: string
}

const KNOB_CASES: readonly KnobCase[] = [
  {
    knob: 'accent', change: (user) => user.click(group(/^Accent/).getByRole('button', { name: 'Forge' })),
    look: { ...ARC, accent: 'forge' }, variable: '--hud-accent', value: ACCENTS.forge.hex,
  },
  {
    knob: 'ground', change: (user) => user.click(group('Background').getByRole('button', { name: 'Navy' })),
    look: { ...ARC, ground: 'navy' }, variable: '--hud-bg', value: GROUNDS.navy.bg,
  },
  {
    knob: 'font', change: (user) => user.click(group('Type').getByRole('button', { name: FONTS.chakra.name })),
    look: { ...ARC, font: 'chakra' }, variable: '--hud-display-family', value: FONTS.chakra.family,
  },
  {
    knob: 'grid', change: () => setSlider('Grid', 20),
    look: { ...ARC, grid: 20 }, variable: GRID_VAR, value: rgba(ACCENTS.arc.hex, 20 / GRID_SCALE),
  },
  {
    knob: 'glow', change: () => setSlider('Glow', 10),
    look: { ...ARC, glow: 10 }, variable: GLOW_VAR, value: rgba(ACCENTS.arc.hex, 10 / GLOW_SCALE),
  },
  { knob: 'scan', change: (user) => user.click(switchButton('Scan')), look: { ...ARC, scan: 'off' }, variable: '--hud-scan', value: '0' },
  {
    knob: 'auto', change: (user) => user.click(switchButton('Auto')),
    look: { ...ARC, auto: 'off' }, variable: '--hud-auto-display', value: 'none',
  },
  {
    knob: 'motion', change: (user) => user.click(switchButton('Motion')),
    look: { ...ARC, motion: 'off' }, variable: '--hud-motion', value: 'paused',
  },
]

describe('each knob', () => {
  it.each(KNOB_CASES)('$knob paints $variable at once, and the look reads as edited', async ({ change, look, variable, value }) => {
    const user = userEvent.setup()
    renderEditor()
    await lookHeld(ARC)
    expect(heldVar(variable)).not.toBe(value)
    await change(user)
    await lookHeld(look)
    expect(heldVar(variable)).toBe(value)
    expect(statusLine()).toHaveTextContent(/^ARC · edited$/)
  })

  it("repaints Studio's tokens with the look, so the host's own pages follow", async () => {
    const user = userEvent.setup()
    renderEditor()
    await lookHeld(ARC)
    await user.click(group('Background').getByRole('button', { name: 'Ember' }))
    await lookHeld({ ...ARC, ground: 'ember' })
    expect(heldVar('--background')).toBe(hexToTriplet(GROUNDS.ember.bg))
    expect(screen.getByRole('group', { name: 'Accent · Arc' })).toBeInTheDocument()
    await user.click(group(/^Accent/).getByRole('button', { name: 'Signal' }))
    expect(screen.getByRole('group', { name: 'Accent · Signal' })).toBeInTheDocument()
    expect(heldVar('--hud-accent')).toBe(ACCENTS.signal.hex)
  })

  it('keeps the glow in its 0 to 40, and says what is painted past the cap its background and accent set', async () => {
    renderEditor({ look: NOVA })
    await lookHeld(NOVA)
    const cap = glowCap(NOVA)
    expect(cap).toBeLessThan(NOVA.glow)
    expect(slider('Glow')).toHaveAttribute('min', String(GLOW_MIN))
    expect(slider('Glow')).toHaveAttribute('max', String(GLOW_MAX))
    expect(slider('Glow')).toHaveValue(String(NOVA.glow))
    expect(slider('Glow')).toHaveAttribute('aria-valuetext', cappedGlowText(NOVA.glow, cap))
    expect(slider('Glow')).toHaveAccessibleDescription(glowCapNote(cap))
    expect(heldVar(GLOW_VAR)).toBe(rgba(ACCENTS.nova.hex, cap / GLOW_SCALE))

    setSlider('Glow', GLOW_MAX)
    await lookHeld({ ...NOVA, glow: GLOW_MAX })
    expect(heldVar(GLOW_VAR)).toBe(rgba(ACCENTS.nova.hex, cap / GLOW_SCALE))

    setSlider('Glow', cap - 4)
    await lookHeld({ ...NOVA, glow: cap - 4 })
    expect(heldVar(GLOW_VAR)).toBe(rgba(ACCENTS.nova.hex, (cap - 4) / GLOW_SCALE))
    expect(slider('Glow')).not.toHaveAttribute('aria-valuetext')
    expect(drawer().queryByText(glowCapNote(cap))).toBeNull()
  })
})

describe('Save as new look, Reset and Delete', () => {
  it('Save as new look keeps the look as MINE 1 through the SDK and makes it the active one; MINE 2 follows', async () => {
    const user = userEvent.setup()
    renderEditor()
    await lookHeld(ARC)
    await user.click(group(/^Accent/).getByRole('button', { name: 'Gold' }))
    await user.click(actionButton(SAVE_AS_LABEL))
    const mine: HudLook = { ...ARC, accent: 'gold', id: 'mine-1', name: 'MINE 1', sub: '' }
    expect(savedLooks()).toEqual([mine])
    await lookHeld(mine)
    expect(card('MINE 1')).toHaveAttribute('aria-pressed', 'true')
    expect(card('ARC')).toHaveAttribute('aria-pressed', 'false')
    expect(statusLine()).toHaveTextContent(/^MINE 1$/)
    expect(heldVar('--hud-accent')).toBe(ACCENTS.gold.hex)
    expect(actionButton(DELETE_LABEL)).toBeInTheDocument()

    await user.click(actionButton(SAVE_AS_LABEL))
    expect(card('MINE 2')).toHaveAttribute('aria-pressed', 'true')
    expect(looksRow().getAllByRole('button')).toHaveLength(PRESETS.length + 2)
  })

  it('a saved look round-trips: read back after a reload, it is the active look with its own knobs', async () => {
    const user = userEvent.setup()
    const first = renderEditor()
    await lookHeld(ARC)
    await user.click(group('Background').getByRole('button', { name: 'Navy' }))
    await user.click(switchButton('Scan'))
    await user.click(actionButton(SAVE_AS_LABEL))
    const kept = savedLooks() as readonly HudLook[]
    expect(kept).toHaveLength(1)
    first.unmount()

    renderEditor({ look: kept[0], saved: kept })
    await lookHeld({ ...ARC, ground: 'navy', scan: 'off', id: 'mine-1', name: 'MINE 1', sub: '' })
    expect(card('MINE 1')).toHaveAttribute('aria-pressed', 'true')
    expect(statusLine()).toHaveTextContent(/^MINE 1$/)
    expect(group('Background').getByRole('button', { name: 'Navy' })).toHaveAttribute('aria-pressed', 'true')
    expect(switchButton('Scan')).toHaveAttribute('aria-pressed', 'false')
    expect(heldVar('--hud-bg')).toBe(GROUNDS.navy.bg)
    expect(heldVar('--hud-scan')).toBe('0')
  })

  it("Reset goes back to the picked preset's values", async () => {
    const user = userEvent.setup()
    renderEditor()
    await lookHeld(ARC)
    await user.click(card('FORGE'))
    await user.click(group(/^Accent/).getByRole('button', { name: 'Arc' }))
    setSlider('Glow', 5)
    expect(statusLine()).toHaveTextContent(/^FORGE · edited$/)
    await user.click(actionButton(RESET_LABEL))
    await lookHeld(FORGE)
    expect(statusLine()).toHaveTextContent(/^FORGE$/)
    expect(slider('Glow')).toHaveValue(String(FORGE.glow))
  })

  it('Reset on a saved look goes back to what was saved, not to a preset', async () => {
    const user = userEvent.setup()
    renderEditor({ look: myLook({ accent: 'nova' }), saved: [myLook()] })
    await waitFor(() => expect(statusLine()).toHaveTextContent(/^MINE 1 · edited$/))
    await user.click(actionButton(RESET_LABEL))
    await lookHeld(myLook())
    expect(statusLine()).toHaveTextContent(/^MINE 1$/)
  })

  it('Reset on a look with nothing to go back to goes back to ARC, the default preset', async () => {
    const user = userEvent.setup()
    renderEditor({ look: myLook({ id: 'gone' }) })
    await lookHeld(myLook({ id: 'gone' }))
    await user.click(actionButton(RESET_LABEL))
    await lookHeld(ARC)
  })

  it("Delete drops one of the user's looks, and the host goes back to ARC", async () => {
    const user = userEvent.setup()
    renderEditor({ look: myLook(), saved: [myLook(), myLook({ id: 'mine-2', name: 'MINE 2' })] })
    await lookHeld(myLook())
    await user.click(actionButton(DELETE_LABEL))
    expect(savedLooks().map((look) => look.id)).toEqual(['mine-2'])
    await lookHeld(ARC)
    expect(looksRow().queryByRole('button', { name: 'MINE 1' })).toBeNull()
    expect(drawer().queryByRole('button', { name: DELETE_LABEL })).toBeNull()
  })
})

describe('before the looks are read, and without a look runtime', () => {
  it('renders on the server as a busy page with its heading alone', () => {
    mountLooks({ loaded: false })
    const html = renderToString(editorTree())
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain(LOOK_TITLE)
    expect(html).not.toContain('aria-pressed')
    expect(html).not.toContain(DRAWER_LABEL)
  })

  it('shows the stored look once it is read, and is no longer busy', async () => {
    renderEditor({ loaded: false })
    expect(heading().closest('[aria-busy]')).not.toBeNull()
    act(() => mountLooks({ look: NOVA }))
    await lookHeld(NOVA)
    expect(card('NOVA')).toHaveAttribute('aria-pressed', 'true')
    expect(heading().closest('[aria-busy]')).toBeNull()
  })

  it("says nothing is kept outside a look runtime, and shows the host's words for a refused change", async () => {
    const user = userEvent.setup()
    render(editorTree())
    expect(screen.getByText(NO_RUNTIME)).toBeInTheDocument()
    await user.click(group(/^Accent/).getByRole('button', { name: 'Forge' }))
    const alert = drawer().getByRole('alert')
    expect(alert).toHaveTextContent(REFUSED_TITLE)
    expect(alert).toHaveTextContent(NOT_AVAILABLE)
    expect(heldLook()).toBeNull()
    await user.click(actionButton(SAVE_AS_LABEL))
    expect(console.warn).toHaveBeenCalledWith('[looks] Save as new look was refused:', [NOT_AVAILABLE])
  })

  it("says so when the host can't keep the looks", async () => {
    renderEditor({ persisted: false })
    await lookHeld(ARC)
    expect(screen.getByText(NOT_KEPT)).toBeInTheDocument()
    expect(screen.queryByText(NO_RUNTIME)).toBeNull()
  })

  it("hands the host its heading: tabindex -1 and the host's mark alone, busy or not", async () => {
    renderEditor({ loaded: false })
    expect(heading()).toHaveAttribute('tabindex', '-1')
    expect(heading().getAttributeNames().filter((name) => name.startsWith('data-'))).toEqual(['data-theme-heading'])
    act(() => mountLooks())
    await lookHeld(ARC)
    expect(document.querySelector('[data-theme-heading]')).toBe(heading())
    heading().focus()
    expect(heading()).toHaveFocus()
  })
})

describe('motion and Auto in the preview', () => {
  const core = () => screen.getByTestId('hud-preview-core')

  it("turns the preview's rings while the look's motion is on, each a loop the motion rule can stop", async () => {
    renderEditor()
    await lookHeld(ARC)
    expect(core()).toHaveAttribute('data-motion', 'on')
    expect(core().querySelectorAll('[data-hud-loop]')).toHaveLength(4)
  })

  it('stands the preview still under reduced motion, says why beside Motion, and leaves the look as it is', async () => {
    host.setReducedMotion(true)
    renderEditor()
    await lookHeld(ARC)
    expect(core()).toHaveAttribute('data-motion', 'still')
    expect(switchButton('Motion')).toHaveAttribute('aria-pressed', 'true')
    expect(switchButton('Motion')).toHaveAccessibleDescription(/reduced motion/)
    expect(heldLook()).toEqual(ARC)
  })

  it("stands the preview still once the look's motion is off, and turns again when the device stops asking", async () => {
    const user = userEvent.setup()
    host.setReducedMotion(true)
    renderEditor()
    await lookHeld(ARC)
    act(() => host.setReducedMotion(false))
    await waitFor(() => expect(core()).toHaveAttribute('data-motion', 'on'))
    expect(switchButton('Motion')).not.toHaveAccessibleDescription(/reduced motion/)
    await user.click(switchButton('Motion'))
    await lookHeld({ ...ARC, motion: 'off' })
    expect(core()).toHaveAttribute('data-motion', 'still')
  })

  it("shows Auto's still in the core while the look's Auto is on, and nothing once it is off", async () => {
    const user = userEvent.setup()
    renderEditor()
    await lookHeld(ARC)
    expect(core().querySelector('img')).toHaveAttribute('src', expect.stringMatching(/assets\/mascot\/searching\.png$/))
    expect(core().querySelector('video')).toBeNull()
    await user.click(switchButton('Auto'))
    await lookHeld({ ...ARC, auto: 'off' })
    expect(core().querySelector('img')).toBeNull()
  })

  it("has no Auto in the core for a look that turns him off (GHOST)", async () => {
    renderEditor({ look: GHOST })
    await lookHeld(GHOST)
    expect(core().querySelector('img')).toBeNull()
  })
})

/** Tab from the top until the focus comes round again. */
async function tabStops(user: User): Promise<readonly Element[]> {
  const stops: Element[] = []
  for (let count = 0; count < 80; count += 1) {
    await user.tab()
    const focused = document.activeElement
    if (!focused || focused === document.body || stops.includes(focused)) break
    stops.push(focused)
  }
  return stops
}

describe('by keyboard', () => {
  it('reaches every look, option, slider and action with Tab', async () => {
    const user = userEvent.setup()
    renderEditor()
    await lookHeld(ARC)
    const controls = [...screen.getAllByRole('button'), ...screen.getAllByRole('slider'), screen.getByRole('textbox'), screen.getByRole('link')]
    const stops = await tabStops(user)
    expect(controls.filter((control) => !stops.includes(control)).map((control) => control.outerHTML)).toEqual([])
  })

  it('changes the look from the keyboard: Enter on a swatch, Space on a switch, Enter on a card', async () => {
    const user = userEvent.setup()
    renderEditor()
    await lookHeld(ARC)
    await press(user, group(/^Accent/).getByRole('button', { name: 'Nova' }))
    await lookHeld({ ...ARC, accent: 'nova' })
    await press(user, switchButton('Scan'), '[Space]')
    await lookHeld({ ...ARC, accent: 'nova', scan: 'off' })
    await press(user, card('FORGE'))
    await lookHeld(FORGE)
    expect(card('FORGE')).toHaveFocus()
  })

  it('names every swatch by its accent, and every option by its choice', async () => {
    renderEditor()
    await lookHeld(ARC)
    const names = (name: string | RegExp) => group(name).getAllByRole('button').map((button) => button.getAttribute('aria-label') ?? button.textContent)
    expect(names(/^Accent/)).toEqual(ACCENT_KEYS.map((key) => ACCENTS[key].name))
    expect(names('Background')).toEqual(GROUND_KEYS.map((key) => GROUNDS[key].name))
    expect(names('Type')).toEqual(FONT_KEYS.map((key) => FONTS[key].name))
    expect(['Scan', 'Auto', 'Motion'].map((name) => drawer().getByRole('button', { name }).textContent)).toEqual(['Scan on', 'Auto on', 'Motion on'])
  })
})
