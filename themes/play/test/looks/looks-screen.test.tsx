/**
 * PRD-260 T-008a — Make it yours (lookEditor@1), ported from Automatos Play's tests/looks/LooksScreen.test.tsx.
 * Every control goes through useLook(), so the look the host's runtime holds changes at once (the host paints it on
 * <html>, Play's variables and Studio's tokens, and every page follows, the preview included). Export writes the
 * current look's JSON; Import goes through lib/looks/transfer.ts and shows its messages (look-manage.test.tsx has
 * the rest of 'This look' and 'Import a look'). Until the looks are read (on the server, and in the first moments
 * in the browser) the screen is only its heading, aria-busy, never Ember standing in for the user's look (M72).
 * Its heading is where the host hands focus after Switch to Play (P260-FX-22, M21): tabindex -1, and both marks,
 * data-play-only-heading and data-theme-heading (PRD-261 K-19c).
 *
 * Moved from core's components/looks/__tests__/looks-screen.test.tsx and rewritten for the kit (PRD-261 B-05e): the
 * screen runs on the harness's look runtime (looks-harness.tsx), and what the host draws around it moved to core's
 * tests of the host (test/moved-from-core/looks.json): the frame and full bleed, the note under Classic or Studio
 * with Switch to Play (K9), the note below the theme's width (D7), and the look painted on <html> and kept in
 * storage. Roles, attributes and text only (CSS modules are proxies).
 */
import { renderToString } from 'react-dom/server'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { exportStarted } from '../../src/components/looks/look-manager.tsx'
import { GLOW_SCALE, rgba } from '@automatos/look-kit/css'
import { ACCENTS, GROUNDS, LIGHTS, SHELLS, TYPE_STYLES } from '../../src/lib/looks/catalogue.ts'
import { SAVED_SUB } from '../../src/lib/looks/editor.ts'
import { safeGlow } from '../../src/lib/looks/engine.ts'
import { AURORA, DAYLIGHT, EMBER, OBSIDIAN, PRESETS, WORKSHOP } from '../../src/lib/looks/presets.ts'
import { LOOK_FILE_MAX_BYTES, LOOK_FILE_TYPE, TOO_BIG, lookJson } from '../../src/lib/looks/transfer.ts'
import type { Look } from '../../src/lib/looks/types.ts'

import {
  BLOB_URL, type DownloadStub, type User, blobText, card, fileInput, group, heldLook, heldVar, importer, lookHeld,
  looksRow, looksTree, manage, mountLooks, myLook, renderLooks, savedLooks, startLooksTest, status, stubDownloads,
} from './looks-harness.tsx'

const HEADING = 'Make it yours.'
const heading = () => screen.getByRole('heading', { level: 1, name: HEADING })

beforeEach(() => {
  startLooksTest()
  // Refused saves and imports are logged as warnings.
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Make it yours under Play', () => {
  it("shows the heading with the active look's name, the preview with Auto, the Looks row and the editor", async () => {
    renderLooks()
    await lookHeld(EMBER)
    expect(heading()).toBeInTheDocument()
    expect(status()).toHaveTextContent(/^Ember$/)
    expect(screen.getByRole('link', { name: 'See the style sheet' })).toHaveAttribute('href', '/looks/style')

    const preview = within(screen.getByRole('region', { name: 'Preview' }))
    expect(preview.getByText('Ta-da.')).toBeInTheDocument()
    expect(preview.getByText('Can you make me a shortlist under £700?')).toBeInTheDocument()
    expect(preview.getByText('✓ Searched the web · 5 results')).toBeInTheDocument()
    expect(preview.getByText('ASUS Vivobook S 14')).toBeInTheDocument()
    expect(preview.getByText('Laptop shortlist')).toBeInTheDocument()
    expect(preview.getByText('Open')).toBeInTheDocument()
    expect(preview.getByText('Message Auto')).toBeInTheDocument()
    expect(preview.getByTestId('auto-stage')).toHaveAttribute('aria-label', 'Ta-da.')

    expect(looksRow().getAllByRole('button').map((button) => button.textContent)).toEqual(
      PRESETS.map((look) => `Aa${look.name} ${look.sub}`),
    )
    expect(card('Ember')).toHaveAttribute('aria-pressed', 'true')
    expect(card('Aurora')).toHaveAttribute('aria-pressed', 'false')

    const editor = within(screen.getByRole('complementary', { name: 'Edit the look' }))
    for (const name of ['Accent · Molten', 'Background', 'Type', "Auto's shell", "Auto's light · ring"]) {
      expect(editor.getByRole('group', { name })).toBeInTheDocument()
    }
    expect(editor.getByRole('slider', { name: 'Glow' })).toHaveValue('24')
    expect(editor.getByRole('button', { name: 'Save as new look' })).toBeInTheDocument()
    expect(editor.getByRole('button', { name: 'Reset' })).toBeEnabled()
  })

  it('choosing a preset applies it through useLook: the runtime holds it and it is picked', async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    await user.click(card('Aurora'))
    await lookHeld(AURORA)
    expect(heldVar('--pl-accent')).toBe(ACCENTS.mint.hex)
    expect(card('Aurora')).toHaveAttribute('aria-pressed', 'true')
    expect(card('Ember')).toHaveAttribute('aria-pressed', 'false')
    expect(status()).toHaveTextContent(/^Aurora$/)
  })

  it("changing the accent updates the preview: the accent it draws with, its label, and '· edited'", async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    await user.click(group(/^Accent/).getByRole('button', { name: 'Rose' }))
    expect(status()).toHaveTextContent(/^Ember · edited$/)
    expect(screen.getByRole('group', { name: 'Accent · Rose' })).toBeInTheDocument()
    expect(group(/^Accent/).getByRole('button', { name: 'Rose' })).toHaveAttribute('aria-pressed', 'true')
    expect(group(/^Accent/).getByRole('button', { name: 'Molten' })).toHaveAttribute('aria-pressed', 'false')
    // The preview (and every page) reads the look's variables the host paints on <html>: Play's and Studio's.
    await lookHeld({ ...EMBER, accent: 'rose' })
    expect(heldVar('--pl-accent')).toBe(ACCENTS.rose.hex)
  })

  it('re-themes the whole app from every control at once', async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)

    await user.click(group('Background').getByRole('button', { name: 'Paper' }))
    await waitFor(() => expect(heldVar('--pl-ground-bg')).toBe(GROUNDS.paper.bg))
    await user.click(group('Type').getByRole('button', { name: 'Playful' }))
    await waitFor(() => expect(heldVar('--pl-display-family')).toBe(TYPE_STYLES.round.family))
    await user.click(group("Auto's shell").getByRole('button', { name: 'Cobalt' }))
    await waitFor(() => expect(heldVar('--pl-auto-shell-filter')).toBe(SHELLS.cobalt.filter))
    await user.click(group(/^Auto's light/).getByRole('button', { name: 'Ice' }))
    await waitFor(() => expect(heldVar('--pl-auto-light')).toBe(LIGHTS.ice.hex))

    // Paper × Molten keeps its text at AA only up to its safe glow (M50): the slider stops there.
    const safe = safeGlow('paper', 'molten')
    const slider = screen.getByRole('slider', { name: 'Glow' })
    expect(slider).toHaveAttribute('max', String(safe))
    fireEvent.change(slider, { target: { value: '0' } })
    await waitFor(() => expect(heldVar('--pl-glow')).toBe(rgba(ACCENTS.molten.hex, 0)))
    expect(slider).toHaveAttribute('aria-valuetext', 'Off')
    expect(screen.getByText('Off')).toBeInTheDocument()

    fireEvent.change(slider, { target: { value: '31' } })
    await waitFor(() => expect(heldVar('--pl-glow')).toBe(rgba(ACCENTS.molten.hex, safe / GLOW_SCALE)))
    expect(slider).toHaveAttribute('aria-valuetext', `${safe}%`)

    fireEvent.change(slider, { target: { value: String(safe - 2) } })
    await waitFor(() => expect(heldVar('--pl-glow')).toBe(rgba(ACCENTS.molten.hex, (safe - 2) / GLOW_SCALE)))
    expect(slider).toHaveAttribute('aria-valuetext', `${safe - 2}%`)

    await lookHeld({ ...EMBER, ground: 'paper', font: 'round', shell: 'cobalt', light: 'ice', glow: safe - 2 })
  })

  it('reaches the looks of the reference screenshots: Ember, Night, and Obsidian with a cobalt Auto', async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    await user.click(group('Background').getByRole('button', { name: 'Night' }))
    await lookHeld({ ...EMBER, ground: 'indigo' })
    await user.click(card('Obsidian'))
    await user.click(group("Auto's shell").getByRole('button', { name: 'Cobalt' }))
    expect(status()).toHaveTextContent(/^Obsidian · edited$/)
    await lookHeld({ ...OBSIDIAN, shell: 'cobalt' })
    expect(heldVar('--pl-auto-shell-filter')).toBe(SHELLS.cobalt.filter)
    expect(within(screen.getByRole('region', { name: 'Preview' })).getByTestId('auto-stage')).toBeInTheDocument()
  })

  it("Save as new look adds 'My look 1' to the row and selects it", async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    await user.click(group(/^Accent/).getByRole('button', { name: 'Gold' }))
    await user.click(screen.getByRole('button', { name: 'Save as new look' }))

    const saved = card('My look 1')
    expect(saved).toHaveAttribute('aria-pressed', 'true')
    expect(saved).toHaveTextContent(SAVED_SUB)
    expect(card('Ember')).toHaveAttribute('aria-pressed', 'false')
    expect(status()).toHaveTextContent(/^My look 1$/)

    const mine: Look = { ...EMBER, id: 'look-1', name: 'My look 1', sub: SAVED_SUB, accent: 'gold' }
    expect(savedLooks()).toEqual([mine])
    await lookHeld(mine)
    expect(heldVar('--pl-accent')).toBe(ACCENTS.gold.hex)

    await user.click(screen.getByRole('button', { name: 'Save as new look' }))
    expect(card('My look 2')).toHaveAttribute('aria-pressed', 'true')
    expect(looksRow().getAllByRole('button')).toHaveLength(PRESETS.length + 2)
  })

  it("Reset returns to the picked look's saved values", async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    await user.click(card('Workshop'))
    await user.click(group(/^Accent/).getByRole('button', { name: 'Mint' }))
    fireEvent.change(screen.getByRole('slider', { name: 'Glow' }), { target: { value: '40' } })
    expect(status()).toHaveTextContent(/^Workshop · edited$/)
    await waitFor(() => expect(heldVar('--pl-accent')).toBe(ACCENTS.mint.hex))

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(status()).toHaveTextContent(/^Workshop$/)
    await lookHeld(WORKSHOP)
    expect(screen.getByRole('slider', { name: 'Glow' })).toHaveValue(String(WORKSHOP.glow))
  })

  it('Reset on a saved look goes back to what was saved, not to a preset', async () => {
    const user = userEvent.setup()
    renderLooks({ look: myLook({ accent: 'cream' }), saved: [myLook()] })
    await waitFor(() => expect(status()).toHaveTextContent(/^My look 1 · edited$/))
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(status()).toHaveTextContent(/^My look 1$/)
    await lookHeld(myLook())
  })

  it("can't Reset a look that has nothing to go back to", async () => {
    renderLooks({ look: myLook({ id: 'gone' }) })
    await lookHeld(myLook({ id: 'gone' }))
    expect(status()).toHaveTextContent(/^My look 1$/)
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled()
  })
})

describe('Make it yours before the looks are read (M72)', () => {
  it('renders on the server as a busy frame with the heading, and no Ember card or option pressed', () => {
    // Until the host has read the user's looks, its runtime answers the default look, not loaded.
    mountLooks({ loaded: false })
    const html = renderToString(looksTree())
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain(HEADING)
    expect(html).not.toContain('aria-pressed="true"')
    expect(html).not.toContain(EMBER.sub)
    expect(html).not.toContain('Edit the look')
  })

  it('in the browser, shows the stored look once it is read, and is no longer busy', async () => {
    renderLooks({ loaded: false })
    expect(heading().closest('[aria-busy]')).not.toBeNull()
    act(() => mountLooks({ look: DAYLIGHT }))
    await lookHeld(DAYLIGHT)
    expect(card('Daylight')).toHaveAttribute('aria-pressed', 'true')
    expect(card('Ember')).toHaveAttribute('aria-pressed', 'false')
    expect(heading().closest('[aria-busy]')).toBeNull()
  })
})

describe('Export and Import through lib/looks/transfer.ts', () => {
  let stub: DownloadStub

  beforeEach(() => {
    stub = stubDownloads()
  })

  afterEach(() => stub.restore())

  it('Export produces the JSON of the current look, edits included, as <name>.look.json', async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    await user.click(group('Background').getByRole('button', { name: 'Paper' }))
    await user.click(manage().getByRole('button', { name: 'Export' }))

    expect(stub.downloads).toEqual([{ href: BLOB_URL, download: 'Ember.look.json' }])
    expect(stub.blobs[0]?.type).toBe(LOOK_FILE_TYPE)
    const text = await blobText(stub.blobs[0] as Blob)
    expect(text).toBe(lookJson({ ...EMBER, ground: 'paper' }))
    expect(JSON.parse(text)).toEqual({ ...EMBER, ground: 'paper' })
    // The Blob URL is let go DOWNLOAD_REVOKE_AFTER_MS later: wait for it while the stub is in place,
    // or the timer fires after afterEach has removed jsdom's missing revokeObjectURL.
    await waitFor(() => expect(stub.revoke).toHaveBeenCalledWith(BLOB_URL), { timeout: 2000 })
    expect(manage().getByText(exportStarted('Ember.look.json'))).toBeInTheDocument()
  })

  it("importing a bad file shows transfer's messages and adds nothing", async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    const bad = JSON.stringify({ ...EMBER, schema: 'nope', accent: 'not-an-accent', script: 'alert(1)' })
    await user.upload(fileInput(), new File([bad], 'bad.look.json', { type: LOOK_FILE_TYPE }))

    const alert = await importer().findByRole('alert')
    expect(alert).toHaveTextContent("That look wasn't added.")
    expect(alert).toHaveTextContent(`"script" isn't part of a Look. Remove it.`)
    expect(alert).toHaveTextContent(`This isn't a v1 Look: "schema" must be "automatos-interface-look/v1".`)
    expect(alert).toHaveTextContent(`"accent" must be one of the catalogue's accents`)
    expect(looksRow().getAllByRole('button')).toHaveLength(PRESETS.length)
    expect(status()).toHaveTextContent(/^Ember$/)
    expect(savedLooks()).toEqual([])
    await lookHeld(EMBER)
  })

  it("importing a 1 MB file shows transfer's TOO_BIG before a byte is read", async () => {
    const user = userEvent.setup()
    const read = vi.spyOn(FileReader.prototype, 'readAsText')
    renderLooks()
    await lookHeld(EMBER)
    const big = new File([new Uint8Array(LOOK_FILE_MAX_BYTES)], 'big.look.json', { type: LOOK_FILE_TYPE })
    await user.upload(fileInput(), big)

    expect(await importer().findByRole('alert')).toHaveTextContent(TOO_BIG)
    expect(read).not.toHaveBeenCalled()
    expect(savedLooks()).toEqual([])
  })
})

describe('Make it yours without a look runtime', () => {
  it("says in words why Save as new look didn't save, and logs it", async () => {
    const user = userEvent.setup()
    render(looksTree())
    await user.click(screen.getByRole('button', { name: 'Save as new look' }))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("That look wasn't saved.")
    expect(alert).toHaveTextContent("Looks aren't available here.")
    expect(console.warn).toHaveBeenCalledWith('[looks] Save as new look was refused:', ["Looks aren't available here."])
    expect(heldLook()).toBeNull()

    await user.click(looksRow().getByRole('button', { name: /^Daylight\b/ }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe("Make it yours' heading, where the host hands focus after Switch to Play (P260-FX-22, M21)", () => {
  it('takes focus by script (tabindex -1) and carries both marks the host looks for, busy or not (K-19c)', async () => {
    renderLooks({ loaded: false })
    expect(heading()).toHaveAttribute('tabindex', '-1')
    expect(document.querySelector('[data-theme-heading]')).toBe(heading())
    expect(document.querySelector('[data-play-only-heading]')).toBe(heading())

    act(() => mountLooks())
    await lookHeld(EMBER)
    heading().focus()
    expect(heading()).toHaveFocus()
    expect(document.activeElement).not.toBe(document.body)
    expect(document.querySelector('[data-theme-heading]')).toBe(heading())
  })
})

/** Tab from the top until focus comes round again. */
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

describe('Make it yours by keyboard', () => {
  it('reaches every look, option, the slider and the actions with Tab', async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    const controls = [...screen.getAllByRole('button'), screen.getByRole('slider', { name: 'Glow' })]
    const stops = await tabStops(user)
    expect(controls.filter((control) => !stops.includes(control)).map((control) => control.textContent)).toEqual([])
  })

  it('names every swatch and reads the slider value', async () => {
    renderLooks()
    await lookHeld(EMBER)
    const accents = group(/^Accent/).getAllByRole('button')
    expect(accents.map((swatch) => swatch.getAttribute('aria-label'))).toEqual(
      Object.values(ACCENTS).map((accent) => accent.name),
    )
    expect(group('Background').getAllByRole('button').map((button) => button.textContent)).toEqual(
      Object.values(GROUNDS).map((ground) => ground.name),
    )
    expect(group('Type').getByRole('button', { name: 'Editorial' })).toHaveAttribute('aria-pressed', 'true')
    const slider = screen.getByRole('slider', { name: 'Glow' })
    expect(slider).toHaveAttribute('aria-valuetext', '24%')
    expect(slider).toHaveAttribute('min', '0')
    expect(slider).toHaveAttribute('max', String(safeGlow('graphite', 'molten')))
  })
})
