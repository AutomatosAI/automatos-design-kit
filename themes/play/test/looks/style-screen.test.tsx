/**
 * PRD-260 §4, K9 — the live style sheet (styleSheet@1), ported from Automatos Play's
 * tests/looks/StyleScreen.test.tsx. Every value comes from the active look and redraws when it changes (a test
 * button changes it through useLook, as Make it yours does); Auto's 12 states are the real AutoMascot, each
 * state's still until Play Auto's states plays their clips (never under reduced motion), and none of them lights
 * the page glow. Until the looks are read (on the server, and in the first moments in the browser) the sheet is
 * only its heading, aria-busy, and the Motion section never says 'reduced motion' before the browser has answered
 * (M72). Its heading is where the host hands focus after Switch to Play (P260-FX-22, M21). The 12 specimens are
 * decorative: no image named with a live status caption ('Something went wrong'); each slot's visible name says
 * the state (P260-FX-24, M74). Copy tokens twice, or refused twice, is announced twice: a new node each time (M22).
 *
 * Moved from core's components/looks/__tests__/style-screen.test.tsx and rewritten for the kit (PRD-261 B-05e): the
 * sheet runs on the harness's look runtime (looks-harness.tsx), Auto's files are the package's (assets/mascot/,
 * through assetUrl) where core served them from /auto/, and reduced motion is the host's media preference. What
 * the host draws around the sheet moved to core's tests of the host (test/moved-from-core/looks.json): the frame
 * and full bleed, the note under Classic or Studio with Switch to Play (K9), the note below the theme's width and
 * the sheet once the window is wide enough (D7), and the look painted on <html>. Roles, attributes, inline custom
 * properties and text only: CSS modules are proxies.
 */
import { host } from '@automatos/theme-harness/host'
import { renderToString } from 'react-dom/server'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SAMPLE_TITLE } from '../../src/components/looks/style/style-components.tsx'
import { REDUCED_MOTION_NOTE, StyleMotion } from '../../src/components/looks/style/style-motion.tsx'
import {
  COPY_FAILED,
  COPY_TOKENS,
  STYLE_HEADING,
  STYLE_SHEET_NOTE,
} from '../../src/components/looks/style/style-screen.tsx'
import { BADGE_DONE } from '../../src/components/play/chat/receipts.tsx'
import { ACCENTS, GROUNDS, LIGHTS } from '../../src/lib/looks/catalogue.ts'
import { lookToCssVars } from '../../src/lib/looks/engine.ts'
import { AURORA, DAYLIGHT, EMBER } from '../../src/lib/looks/presets.ts'
import { RADII, SPACING_STEPS, radiusToken, rootBlock } from '../../src/lib/looks/style.ts'
import { ringTone } from '@automatos/mascot/ring'
import { MASCOT_STATES } from '@automatos/mascot/types'
import { MASCOT_FILES } from '../mascot/helpers.ts'

import {
  chipColour, clipsIn, mascotRegion, mountLooks, pick, playStates, ratioFor, renderSheet, restoreClipboard,
  sheetTree, specimenValues, startLooksTest, stillsIn, stubClipboard, lookHeld as ready, swatchItem, swatchValue,
  verdictFor,
} from './looks-harness.tsx'

const ACCURACY = 0.05
const heading = () => screen.getByRole('heading', { level: 1, name: STYLE_HEADING })
/** Auto's still and clip for a state, from the package's assets/mascot/ (core: /auto/<state>.png). */
const stillOf = (state: string) => `${MASCOT_FILES}${state}.png`
const clipOf = (state: string) => `${MASCOT_FILES}${state}.webm`

beforeEach(() => {
  startLooksTest()
})

afterEach(() => {
  restoreClipboard()
  vi.restoreAllMocks()
})

describe('the style sheet under Play, on Ember', () => {
  it('renders with the live contrast ratios and an AA verdict in words', async () => {
    renderSheet()
    await ready()
    expect(heading()).toBeInTheDocument()
    expect(screen.queryByText(STYLE_SHEET_NOTE)).toBeNull()
    expect(Math.abs(ratioFor('text / bg') - 16.36)).toBeLessThanOrEqual(ACCURACY)
    expect(Math.abs(ratioFor('text-2 / bg') - 8.54)).toBeLessThanOrEqual(ACCURACY)
    expect(Math.abs(ratioFor('ink / molten') - 6.74)).toBeLessThanOrEqual(ACCURACY)
    expect(ratioFor('text / surface')).toBeGreaterThan(4.5)
    expect(verdictFor('text / bg')).toBe('✓ AA pass')
    expect(verdictFor('accent text / bg')).toBe('✓ AA pass')
  })

  it('shows a swatch for every colour with its name, value and role', async () => {
    renderSheet()
    await ready()
    const colour = within(screen.getByRole('region', { name: 'Colour' }))
    expect(colour.getAllByRole('listitem')).toHaveLength(22)
    expect(swatchValue('--pl-ground-bg')).toBe(GROUNDS.graphite.bg)
    expect(chipColour('--pl-ground-bg')).toBe(GROUNDS.graphite.bg)
    expect(chipColour('--pl-accent')).toBe(ACCENTS.molten.hex)
    expect(within(swatchItem('--pl-ground-bg')).getByText('page')).toBeInTheDocument()
    expect(swatchValue('--pl-accent')).toBe(ACCENTS.molten.hex)
    expect(swatchValue('--pl-accent-text')).toBe(ACCENTS.molten.hex)
    expect(within(swatchItem('--pl-accent-text')).queryByText(/for reading on/)).toBeNull()
  })

  it('shows the type, spacing, radii and a components gallery that is only a picture', async () => {
    renderSheet()
    await ready()
    const type = within(screen.getByRole('region', { name: 'Type' }))
    for (const text of ['Hero 72px', 'The fun way.', 'Searching.', 'Laptop shortlist', 'Mono 13']) {
      expect(type.getByText(text)).toBeInTheDocument()
    }
    expect(type.getByText(/Editorial · Instrument Serif italic 400/)).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Spacing · 4px base' })).getAllByRole('listitem')).toHaveLength(7)
    expect(within(screen.getByRole('region', { name: 'Radii' })).getByText('pill chip')).toBeInTheDocument()
    const steps = SPACING_STEPS.map((step) => `var(${step.token})`)
    const radii = RADII.map((radius) => `var(${radiusToken(radius.kind)})`)
    expect(specimenValues('Spacing · 4px base', '--pl-specimen-step')).toEqual(steps)
    expect(specimenValues('Radii', '--pl-specimen-radius')).toEqual(radii)
    const components = within(screen.getByRole('region', { name: 'Components' }))
    for (const text of ['Send', 'Stop', 'All', 'Reading 4 pages', "Web search didn't answer", 'What Auto did', 'Open']) {
      expect(components.getByText(text)).toBeInTheDocument()
    }
    // "What Auto did": Play's Done tag beside the write, none beside the read (P260-FX-14).
    expect(components.getByText(`Made a report: ${SAMPLE_TITLE}`).nextElementSibling).toHaveTextContent(BADGE_DONE)
    expect(components.getByText('Searched the web · 5 results').nextElementSibling).toBeNull()
    expect(components.queryAllByRole('button')).toEqual([])
    expect(components.queryAllByRole('link')).toEqual([])
  })

  it("shows Auto's 12 states as AutoMascot, each ring in the look, none lighting the page glow", async () => {
    renderSheet()
    await ready()
    const mascot = within(mascotRegion())
    expect(mascot.getAllByRole('listitem')).toHaveLength(MASCOT_STATES.length)
    const stages = mascot.getAllByTestId('auto-stage')
    expect(stages.map((stage) => stage.getAttribute('data-ring'))).toEqual(MASCOT_STATES.map((state) => ringTone(state)))
    expect(stages.filter((stage) => stage.hasAttribute('data-glow'))).toEqual([])
    expect(stillsIn(mascotRegion()).map((still) => still.getAttribute('src'))).toEqual(MASCOT_STATES.map(stillOf))
    expect(mascot.getAllByText(`ring light · ${LIGHTS.mint.hex}`)).toHaveLength(4)
    expect(mascot.getAllByText(`ring accent · ${ACCENTS.molten.hex}`)).toHaveLength(4)
  })

  it('names no specimen with a live status caption: the 12 slots name the states, Auto is decorative (P260-FX-24, M74)', async () => {
    renderSheet()
    await ready()
    const region = mascotRegion()
    expect(screen.queryByRole('img', { name: 'Something went wrong' })).toBeNull()
    expect(screen.queryByRole('img', { name: "Automatos isn't running" })).toBeNull()
    expect(within(region).queryAllByRole('img')).toEqual([])
    for (const state of MASCOT_STATES) expect(within(region).getByText(state)).toBeInTheDocument()
    const stages = within(region).getAllByTestId('auto-stage')
    expect(stages).toHaveLength(MASCOT_STATES.length)
    expect(stages.filter((stage) => stage.hasAttribute('role') || stage.hasAttribute('aria-label'))).toEqual([])
    expect(stages.filter((stage) => stage.closest('[aria-hidden="true"]') === null)).toEqual([])
  })

  it("shows the 12 states as lazy stills, and Play Auto's states plays their 12 clips (P260-FX-15)", async () => {
    renderSheet()
    await ready()
    const region = mascotRegion()
    expect(within(region).getAllByTestId('auto-stage')).toHaveLength(MASCOT_STATES.length)
    expect(clipsIn(region)).toEqual([])
    expect(stillsIn(region).map((still) => still.getAttribute('src'))).toEqual(MASCOT_STATES.map(stillOf))
    expect(stillsIn(region).map((still) => still.getAttribute('loading'))).toEqual(MASCOT_STATES.map(() => 'lazy'))
    expect(playStates()).toHaveAttribute('aria-pressed', 'false')
    expect(playStates()).toBeEnabled()

    fireEvent.click(playStates())
    expect(playStates()).toHaveAttribute('aria-pressed', 'true')
    expect(clipsIn(region).map((clip) => clip.getAttribute('src'))).toEqual(MASCOT_STATES.map(clipOf))
    expect(clipsIn(region).map((clip) => clip.getAttribute('poster'))).toEqual(MASCOT_STATES.map(stillOf))
    expect(stillsIn(region)).toEqual([])

    fireEvent.click(playStates())
    expect(playStates()).toHaveAttribute('aria-pressed', 'false')
    expect(clipsIn(region)).toEqual([])
  })

  it("shows every state's PNG under reduced motion, no clip, and Play Auto's states is off", async () => {
    host.setReducedMotion(true)
    renderSheet()
    await ready()
    expect(stillsIn(mascotRegion()).map((still) => still.getAttribute('src'))).toEqual(MASCOT_STATES.map(stillOf))
    expect(clipsIn(mascotRegion())).toHaveLength(0)
    expect(playStates()).toBeDisabled()
    expect(playStates()).toHaveAttribute('aria-pressed', 'false')
  })

  it('links back to the Look page, by its name', async () => {
    renderSheet()
    await ready()
    expect(screen.getByRole('link', { name: 'Back to Look' })).toHaveAttribute('href', '/looks')
  })
})

describe('the style sheet follows the active look', () => {
  it('redraws the bg swatch and shows a darkened accent text on Daylight', async () => {
    renderSheet()
    await ready()
    pick(DAYLIGHT)
    await ready(DAYLIGHT)
    expect(swatchValue('--pl-ground-bg')).toBe(GROUNDS.paper.bg)
    expect(chipColour('--pl-ground-bg')).toBe(GROUNDS.paper.bg)
    expect(swatchValue('--pl-accent-text')).not.toBe(ACCENTS.molten.hex)
    expect(swatchValue('--pl-accent-text')).toBe(lookToCssVars(DAYLIGHT)['--pl-accent-text'])
    expect(within(swatchItem('--pl-accent-text')).getByText('darkened for reading on Paper')).toBeInTheDocument()
    expect(within(swatchItem('--pl-error-text')).getByText('darkened for reading on Paper')).toBeInTheDocument()
    expect(ratioFor('accent text / bg')).toBeGreaterThanOrEqual(4.5)
  })

  it('redraws the type and the rings for another look', async () => {
    renderSheet()
    await ready()
    pick(AURORA)
    await ready(AURORA)
    expect(screen.getByText('Hero 58px')).toBeInTheDocument()
    expect(screen.getByText(/Characterful · Bricolage Grotesque/)).toBeInTheDocument()
    expect(screen.getAllByText(`ring light · ${LIGHTS.ice.hex}`)).toHaveLength(4)
    expect(screen.getAllByText(`ring accent · ${ACCENTS.mint.hex}`)).toHaveLength(4)
    expect(screen.getByRole('rowheader', { name: 'ink / mint' })).toBeInTheDocument()
    expect(swatchValue('--pl-accent')).toBe(ACCENTS.mint.hex)
  })
})

describe('Copy tokens', () => {
  const COPIED = "Copied Ember's tokens as a :root block."
  const refuseClipboard = (error: Error) =>
    stubClipboard(async () => {
      throw error
    })

  it("copies the active look's variables as a :root block, and the notice goes with the look", async () => {
    const writeText = vi.fn(async (_text: string) => undefined)
    stubClipboard(writeText)
    renderSheet()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Copy tokens' }))
    expect(await screen.findByText(COPIED)).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith(rootBlock(EMBER))
    pick(DAYLIGHT)
    await ready(DAYLIGHT)
    expect(screen.queryByText(COPIED)).toBeNull()
  })

  it('says it again when the same copy is made twice: a new node in the polite region (P260-FX-24, M22)', async () => {
    const writeText = vi.fn(async (_text: string) => undefined)
    stubClipboard(writeText)
    renderSheet()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: COPY_TOKENS }))
    const first = await screen.findByText(COPIED)

    fireEvent.click(screen.getByRole('button', { name: COPY_TOKENS }))
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(first.isConnected).toBe(false))
    expect(screen.getByText(COPIED).closest('[aria-live="polite"]')).not.toBeNull()
  })

  it('puts the alert in again when the browser refuses the clipboard twice (P260-FX-24, M22)', async () => {
    refuseClipboard(new DOMException('Write permission denied.', 'NotAllowedError'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderSheet()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: COPY_TOKENS }))
    const first = await screen.findByRole('alert')

    fireEvent.click(screen.getByRole('button', { name: COPY_TOKENS }))
    await waitFor(() => expect(first.isConnected).toBe(false))
    expect(screen.getByRole('alert')).toHaveTextContent(COPY_FAILED)
  })

  it('says so when the browser blocks the clipboard', async () => {
    const denied = new DOMException('Write permission denied.', 'NotAllowedError')
    refuseClipboard(denied)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderSheet()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Copy tokens' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(COPY_FAILED)
    expect(console.error).toHaveBeenCalledWith('[looks] copying the tokens failed', denied)
  })
})

describe('Motion', () => {
  it('plays the notes with a toggle', async () => {
    renderSheet()
    await ready()
    const motion = within(screen.getByRole('region', { name: 'Motion' }))
    expect(motion.getByText(/rise 12px/)).toBeInTheDocument()
    const toggle = motion.getByRole('button', { name: 'Play the motion' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('is off under reduced motion, and says why', async () => {
    host.setReducedMotion(true)
    renderSheet()
    await ready()
    const motion = within(screen.getByRole('region', { name: 'Motion' }))
    expect(motion.getByRole('button', { name: 'Play the motion' })).toBeDisabled()
    expect(motion.getByText(/reduced motion, so nothing plays/)).toBeInTheDocument()
  })
})

describe("the sheet's heading, where the host hands focus after Switch to Play (P260-FX-22, M21)", () => {
  it("takes focus by script (tabindex -1) and carries the host's mark alone, busy or not (K-19c, K-21)", async () => {
    renderSheet({ loaded: false })
    expect(heading()).toHaveAttribute('tabindex', '-1')
    expect(document.querySelector('[data-theme-heading]')).toBe(heading())
    expect(heading().getAttributeNames().filter((name) => name.startsWith('data-'))).toEqual(['data-theme-heading'])
    expect(document.querySelector('[data-play-only-heading]')).toBeNull()

    act(() => mountLooks())
    expect(await screen.findByRole('region', { name: 'Colour' })).toBeInTheDocument()
    heading().focus()
    expect(heading()).toHaveFocus()
    expect(document.activeElement).not.toBe(document.body)
  })
})

describe('the style sheet before the looks are read (M72)', () => {
  it('renders on the server as a busy frame with the heading: no sheet, no look named, no reduced-motion note', () => {
    // Until the host has read the user's looks, its runtime answers the default look, not loaded.
    mountLooks({ loaded: false })
    const html = renderToString(sheetTree())
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain(STYLE_HEADING)
    expect(html).not.toContain(COPY_TOKENS)
    expect(html).not.toContain('Every value here comes from')
    expect(html).not.toContain(REDUCED_MOTION_NOTE)
  })

  it("the Motion section waits for the browser's own answer before it says reduced motion", () => {
    // The server reads every browser as asking for reduced motion (the host's useMediaPreferences).
    host.setReducedMotion(true)
    mountLooks()
    const html = renderToString(<StyleMotion />)
    expect(html).toContain('Play the motion')
    expect(html).not.toContain(REDUCED_MOTION_NOTE)
  })

  it('in the browser, drops aria-busy once the stored look is read', async () => {
    renderSheet({ loaded: false })
    expect(heading().closest('[aria-busy]')).not.toBeNull()
    act(() => mountLooks({ look: DAYLIGHT }))
    await ready(DAYLIGHT)
    expect(heading().closest('[aria-busy]')).toBeNull()
    expect(screen.getByText(/Every value here comes from Daylight/)).toBeInTheDocument()
  })
})
