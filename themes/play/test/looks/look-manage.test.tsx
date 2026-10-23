/**
 * PRD-260 T-008a — 'This look' and 'Import a look' on Make it yours, ported from Automatos Play's
 * tests/looks/LookManage.test.tsx: Save, Rename and Delete for the user's saved looks (a preset only duplicates),
 * Export as a .look.json download, Copy JSON, and Import from pasted text or a file through lib/looks/transfer.ts.
 * Imports are untrusted: nothing invalid is kept, and imported text is never read as HTML. Export says the download
 * started, never that it arrived (M71); a success says so when the host isn't keeping looks (M98). By keyboard,
 * focus never falls to <body> when the control just used goes (P260-FX-22, M20). The same outcome twice is
 * announced twice: a new node in the polite region, or the alert put in again (P260-FX-24, M22).
 *
 * Moved from core's components/looks/__tests__/look-manage.test.tsx and rewritten for the kit (PRD-261 B-05e): the
 * looks a test starts on and reads back are the harness's look runtime's (looks-harness.tsx), not the
 * automatos-play.* keys, and a host not keeping looks is the runtime's persisted flag. How the host keeps them moved
 * to core's tests of the host (test/moved-from-core/looks.json).
 */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { exportStarted } from '../../src/components/looks/look-manager.tsx'
import { LOOKS_NOT_KEPT } from '../../src/components/looks/look-notice.tsx'
import { EMBER, PRESETS } from '../../src/lib/looks/presets.ts'
import { LOOK_FILE_TYPE, NOT_JSON, lookJson } from '../../src/lib/looks/transfer.ts'
import type { Look } from '../../src/lib/looks/types.ts'

import {
  type DownloadStub, blobText, exportActive, expectFocusOn, fileInput, group, heldLook, importer, lookHeld,
  looksRow, manage, myLook, paste, press, pressedCard, readyOnMyLook, refuseLookWrites, renderLooks, savedLooks,
  startLooksTest, status, stubDownloads, toolbar,
} from './looks-harness.tsx'

beforeEach(() => {
  startLooksTest()
  // Refused imports and blocked copies are logged.
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('This look: managing looks', () => {
  it('only offers Duplicate (plus Export and Copy JSON) for a preset, edited or not', async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    expect(toolbar()).toEqual(['Duplicate', 'Export', 'Copy JSON'])
    await user.click(group(/^Accent/).getByRole('button', { name: 'Rose' }))
    expect(status()).toHaveTextContent(/^Ember · edited$/)
    expect(toolbar()).toEqual(['Duplicate', 'Export', 'Copy JSON'])
  })

  it('duplicates a preset into a saved look and picks it', async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    await user.click(manage().getByRole('button', { name: 'Duplicate' }))
    const copy: Look = { ...EMBER, id: 'look-1', name: 'Ember copy' }
    expect(pressedCard()).toHaveTextContent(`${copy.name} ${copy.sub}`)
    expect(status()).toHaveTextContent(/^Ember copy$/)
    expect(manage().getByText('Duplicated as Ember copy.')).toBeInTheDocument()
    expect(savedLooks()).toEqual([copy])
    expect(heldLook()).toEqual(copy)
    // The copy is the user's own: it can be renamed and deleted.
    expect(manage().getByRole('button', { name: 'Rename' })).toBeInTheDocument()
  })

  it('keeps unsaved edits in the copy', async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    await user.click(group(/^Accent/).getByRole('button', { name: 'Rose' }))
    expect(status()).toHaveTextContent(/^Ember · edited$/)
    await user.click(manage().getByRole('button', { name: 'Duplicate' }))
    const copy: Look = { ...EMBER, id: 'look-1', name: 'Ember copy', accent: 'rose' }
    expect(savedLooks()).toEqual([copy])
    expect(status()).toHaveTextContent(/^Ember copy$/)
    expect(pressedCard()).toHaveTextContent(`${copy.name} ${copy.sub}`)
    await lookHeld(copy)
  })

  it('Save writes the edits over the saved look they were made to, and only then is offered', async () => {
    const user = userEvent.setup()
    await readyOnMyLook()
    expect(toolbar()).toEqual(['Rename', 'Duplicate', 'Delete', 'Export', 'Copy JSON'])
    await user.click(group(/^Accent/).getByRole('button', { name: 'Gold' }))
    expect(status()).toHaveTextContent(/^My look 1 · edited$/)
    expect(toolbar()).toEqual(['Save', 'Rename', 'Duplicate', 'Delete', 'Export', 'Copy JSON'])
    await user.click(manage().getByRole('button', { name: 'Save' }))
    expect(status()).toHaveTextContent(/^My look 1$/)
    expect(manage().getByText('Saved My look 1.')).toBeInTheDocument()
    expect(savedLooks()).toEqual([myLook({ accent: 'gold' })])
    expect(looksRow().getAllByRole('button')).toHaveLength(PRESETS.length + 1)
    expect(manage().queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    await lookHeld(myLook({ accent: 'gold' }))
  })

  it('closes an open form when another look is picked', async () => {
    const user = userEvent.setup()
    await readyOnMyLook()
    await user.click(manage().getByRole('button', { name: 'Rename' }))
    expect(manage().getByRole('textbox', { name: 'New name' })).toBeInTheDocument()
    await user.click(looksRow().getByRole('button', { name: /^Aurora\b/ }))
    await user.click(looksRow().getByRole('button', { name: /^My look 1\b/ }))
    expect(manage().queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('renames a saved look', async () => {
    const user = userEvent.setup()
    await readyOnMyLook()
    await user.click(manage().getByRole('button', { name: 'Rename' }))
    const field = manage().getByRole('textbox', { name: 'New name' })
    expect(field).toHaveValue('My look 1')
    expect(field).toHaveFocus()
    await user.clear(field)
    await user.type(field, 'Sunset')
    await user.click(manage().getByRole('button', { name: 'Save name' }))
    expect(status()).toHaveTextContent(/^Sunset$/)
    expect(pressedCard()).toHaveTextContent('Sunset')
    expect(manage().getByText('Renamed to Sunset.')).toBeInTheDocument()
    expect(manage().queryByRole('textbox')).not.toBeInTheDocument()
    expect(savedLooks()).toEqual([myLook({ name: 'Sunset' })])
    expect(heldLook()).toEqual(myLook({ name: 'Sunset' }))
  })

  it("says in words why a name wasn't saved, and keeps the old one", async () => {
    const user = userEvent.setup()
    await readyOnMyLook()
    await user.click(manage().getByRole('button', { name: 'Rename' }))
    await user.clear(manage().getByRole('textbox', { name: 'New name' }))
    await user.click(manage().getByRole('button', { name: 'Save name' }))
    const alert = manage().getByRole('alert')
    expect(alert).toHaveTextContent("That name wasn't saved.")
    expect(alert).toHaveTextContent(`"name" can't be empty.`)
    expect(status()).toHaveTextContent(/^My look 1$/)
    expect(savedLooks()).toEqual([myLook()])
  })

  it('deletes a saved look only once confirmed, then goes back to Ember', async () => {
    const user = userEvent.setup()
    await readyOnMyLook()
    await user.click(manage().getByRole('button', { name: 'Delete' }))
    const confirm = () => within(screen.getByRole('group', { name: /^Delete My look 1\?/ }))
    await user.click(confirm().getByRole('button', { name: 'Keep it' }))
    expect(screen.queryByRole('group', { name: /^Delete My look 1\?/ })).not.toBeInTheDocument()
    expect(savedLooks()).toEqual([myLook()])
    await user.click(manage().getByRole('button', { name: 'Delete' }))
    await user.click(confirm().getByRole('button', { name: 'Delete look' }))
    expect(status()).toHaveTextContent(/^Ember$/)
    expect(looksRow().getAllByRole('button')).toHaveLength(PRESETS.length)
    expect(manage().getByText('Deleted My look 1. Play is back to Ember.')).toBeInTheDocument()
    expect(savedLooks()).toEqual([])
    await lookHeld(EMBER)
  })
})

describe('This look by keyboard: focus stays on a button that is there (P260-FX-22, M20)', () => {
  const tool = (name: string) => manage().getByRole('button', { name })

  it('Save hands focus to Rename, since Save is gone once the look is saved', async () => {
    const user = userEvent.setup()
    await readyOnMyLook()
    await user.click(group(/^Accent/).getByRole('button', { name: 'Gold' }))
    await press(user, tool('Save'))
    expect(status()).toHaveTextContent(/^My look 1$/)
    expect(manage().queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expectFocusOn(tool('Rename'))
  })

  it('Save name and Cancel hand focus back to Rename as the form closes', async () => {
    const user = userEvent.setup()
    await readyOnMyLook()
    await press(user, tool('Rename'))
    const field = manage().getByRole('textbox', { name: 'New name' })
    expect(field).toHaveFocus()
    await user.clear(field)
    await user.type(field, 'Sunset')
    await press(user, tool('Save name'))
    expect(status()).toHaveTextContent(/^Sunset$/)
    expect(manage().queryByRole('textbox')).not.toBeInTheDocument()
    expectFocusOn(tool('Rename'))
    await press(user, tool('Rename'))
    await press(user, tool('Cancel'))
    expect(manage().queryByRole('textbox')).not.toBeInTheDocument()
    expectFocusOn(tool('Rename'))
  })

  it('Delete moves focus into its question, on Keep it; Keep it hands it back to Delete', async () => {
    const user = userEvent.setup()
    await readyOnMyLook()
    await press(user, tool('Delete'))
    const question = screen.getByRole('group', { name: /^Delete My look 1\?/ })
    expectFocusOn(within(question).getByRole('button', { name: 'Keep it' }))
    await press(user, within(question).getByRole('button', { name: 'Keep it' }))
    expect(screen.queryByRole('group', { name: /^Delete My look 1\?/ })).not.toBeInTheDocument()
    expect(savedLooks()).toEqual([myLook()])
    expectFocusOn(tool('Delete'))
  })

  it('Delete look hands focus to Duplicate, the one button every look has', async () => {
    const user = userEvent.setup()
    await readyOnMyLook()
    await press(user, tool('Delete'))
    await press(user, tool('Delete look'))
    expect(status()).toHaveTextContent(/^Ember$/)
    expect(manage().queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expectFocusOn(tool('Duplicate'))
  })
})

describe('Export and Copy JSON', () => {
  let stub: DownloadStub

  beforeEach(() => {
    stub = stubDownloads()
  })

  afterEach(() => stub.restore())

  it('downloads <name>.look.json holding the active look, pretty-printed', async () => {
    const user = userEvent.setup()
    await readyOnMyLook()
    expect(await exportActive(user, stub)).toBe('My look 1.look.json')
    expect(await blobText(stub.blobs[0] as Blob)).toBe(lookJson(myLook()))
    expect(manage().getByText(exportStarted('My look 1.look.json'))).toBeInTheDocument()
  })

  it('says the download started, never that it arrived, and offers Copy JSON (M71)', async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    await exportActive(user, stub)
    const notice = manage().getByText(exportStarted('Ember.look.json'))
    expect(notice).toHaveTextContent("Your browser is saving Ember.look.json. If it didn't appear, use Copy JSON.")
    expect(manage().queryByText(/^Downloaded/)).not.toBeInTheDocument()
  })

  it('round-trips: an exported look imports as an equal saved look with a new id', async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    await exportActive(user, stub)
    const text = await blobText(stub.blobs[0] as Blob)
    await paste(user, text)
    const imported: Look = { ...EMBER, id: 'look-1' }
    expect(savedLooks()).toEqual([imported])
    expect(heldLook()).toEqual(imported)
    const cards = looksRow().getAllByRole('button')
    expect(cards).toHaveLength(PRESETS.length + 1)
    expect(cards[cards.length - 1]).toHaveAttribute('aria-pressed', 'true')
    expect(importer().getByText('Added Ember to your Looks.')).toBeInTheDocument()
    expect(importer().getByLabelText("Paste a Look's JSON")).toHaveValue('')
  })

  it("copies the active look's JSON", async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    await user.click(manage().getByRole('button', { name: 'Copy JSON' }))
    expect(await navigator.clipboard.readText()).toBe(lookJson(EMBER))
    expect(await manage().findByText('Copied the JSON.')).toBeInTheDocument()
  })

  it('says so when the browser blocks the clipboard', async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    const denied = new DOMException('Write permission denied.', 'NotAllowedError')
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(denied)
    await user.click(manage().getByRole('button', { name: 'Copy JSON' }))
    expect(await manage().findByRole('alert')).toHaveTextContent("The JSON wasn't copied.")
    expect(console.error).toHaveBeenCalledWith('Failed to copy to clipboard:', denied)
  })
})

describe('Import a look', () => {
  it('adds a valid .json file as a saved look with a fresh id, and picks it', async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    const file = new File([lookJson(myLook({ id: 'ember' }))], 'mine.look.json', { type: LOOK_FILE_TYPE })
    await user.upload(fileInput(), file)
    const added = myLook({ id: 'look-1' })
    await waitFor(() => expect(savedLooks()).toEqual([added]))
    expect(status()).toHaveTextContent(/^My look 1$/)
    expect(pressedCard()).toHaveTextContent('My look 1')
    expect(importer().getByText('Added My look 1 to your Looks.')).toBeInTheDocument()
    await lookHeld(added)
  })

  it("refuses pasted text that isn't JSON and keeps it in the box to fix", async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    await paste(user, '{ name: Ember')
    expect(importer().getByRole('alert')).toHaveTextContent(NOT_JSON)
    expect(importer().getByLabelText("Paste a Look's JSON")).toHaveValue('{ name: Ember')
    expect(savedLooks()).toEqual([])
  })

  it('never renders imported text as HTML', async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    await paste(user, JSON.stringify(myLook({ name: '<b>bold</b>', sub: '<img src=x onerror=alert(1)>' })))
    expect(pressedCard()).toHaveTextContent('<b>bold</b> <img src=x onerror=alert(1)>')
    expect(importer().getByText('Added <b>bold</b> to your Looks.')).toBeInTheDocument()
    const row = screen.getByRole('region', { name: 'Looks' })
    const imports = screen.getByRole('region', { name: 'Import a look' })
    expect([row, imports].map((region) => region.querySelector('b, img'))).toEqual([null, null])
    expect(status()).toHaveTextContent('<b>bold</b>')
  })
})

describe("When the host isn't keeping looks (M98)", () => {
  it('with storage blocked, Duplicate, Rename and Import say the look lasts until the tab closes', async () => {
    const user = userEvent.setup()
    renderLooks({ persisted: false })
    await lookHeld(EMBER)
    await user.click(manage().getByRole('button', { name: 'Duplicate' }))
    expect(manage().getByText(`Duplicated as Ember copy. ${LOOKS_NOT_KEPT}`)).toBeInTheDocument()
    await user.click(manage().getByRole('button', { name: 'Rename' }))
    await user.clear(manage().getByRole('textbox', { name: 'New name' }))
    await user.type(manage().getByRole('textbox', { name: 'New name' }), 'Sunset')
    await user.click(manage().getByRole('button', { name: 'Save name' }))
    expect(manage().getByText(`Renamed to Sunset. ${LOOKS_NOT_KEPT}`)).toBeInTheDocument()
    await paste(user, lookJson(myLook()))
    expect(importer().getByText(`Added My look 1 to your Looks. ${LOOKS_NOT_KEPT}`)).toBeInTheDocument()
    // The host holds them for this tab only.
    expect(savedLooks().map((look) => look.name)).toEqual(['Sunset', 'My look 1'])
  })

  it('with storage full, the refused write after Duplicate is told in its notice', async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    await user.click(manage().getByRole('button', { name: 'Duplicate' }))
    expect(manage().getByText('Duplicated as Ember copy.')).toBeInTheDocument()
    refuseLookWrites()
    expect(await manage().findByText(`Duplicated as Ember copy. ${LOOKS_NOT_KEPT}`)).toBeInTheDocument()
  })

  it('Export still says the download started and offers Copy JSON', async () => {
    const user = userEvent.setup()
    const stub = stubDownloads()
    try {
      renderLooks({ persisted: false })
      await lookHeld(EMBER)
      expect(await exportActive(user, stub)).toBe('Ember.look.json')
      // Exact text: Export changes no look, so it never adds LOOKS_NOT_KEPT.
      expect(manage().getByText(exportStarted('Ember.look.json'))).toHaveTextContent('Copy JSON')
    } finally {
      stub.restore()
    }
  })
})

describe('A repeat is announced again (P260-FX-24, M22)', () => {
  const ADDED = 'Added My look 1 to your Looks.'

  it("pasting the same JSON twice puts a new 'Added …' node in the polite region", async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    await paste(user, lookJson(myLook()))
    const first = importer().getByText(ADDED)
    await paste(user, lookJson(myLook()))
    const second = importer().getByText(ADDED)
    expect(second).not.toBe(first)
    expect(first.isConnected).toBe(false)
    expect(second.closest('[aria-live="polite"]')).not.toBeNull()
    expect(savedLooks()).toEqual([myLook({ id: 'look-1' }), myLook({ id: 'look-2' })])
  })

  it('two identical bad pastes put the alert in again', async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    await paste(user, '{ name: Ember')
    const first = importer().getByRole('alert')
    expect(first).toHaveTextContent(NOT_JSON)
    await user.clear(importer().getByLabelText("Paste a Look's JSON"))
    await paste(user, '{ name: Ember')
    const second = importer().getByRole('alert')
    expect(second).toHaveTextContent(NOT_JSON)
    expect(second).not.toBe(first)
    expect(first.isConnected).toBe(false)
  })

  it('Copy JSON twice says it twice: the second is a new node', async () => {
    const user = userEvent.setup()
    renderLooks()
    await lookHeld(EMBER)
    await user.click(manage().getByRole('button', { name: 'Copy JSON' }))
    const first = await manage().findByText('Copied the JSON.')
    await user.click(manage().getByRole('button', { name: 'Copy JSON' }))
    await waitFor(() => expect(first.isConnected).toBe(false))
    expect(manage().getByText('Copied the JSON.').closest('[aria-live="polite"]')).not.toBeNull()
  })
})
