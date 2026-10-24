// Share, on the LOOK page: Export saves the active look, edits included, as the host's .look.json (the SDK's
// exportLook), and Import takes that text back (the SDK's importLook, under a fresh id), keeps it and makes it the
// active look, so a look round-trips through a file. A refused import shows the host's reasons and adds nothing; a
// download the browser won't start, or a look outside a look runtime, is said in words, never thrown.
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ARC, PRESETS } from '../../src/lib/looks/presets.ts'
import type { HudLook } from '../../src/lib/looks/types.ts'
import {
  DOWNLOAD_FAILED, EXPORT_LABEL, IMPORT_FIELD_LABEL, IMPORT_LABEL, NOT_DONE, exportStarted, importedLine, notExportable,
} from '../../src/looks/look-share.tsx'
import {
  BLOB_URL, blobText, editorTree, group, heldLook, lookHeld, looksRow, renderEditor, savedLooks, share, startLooksTest,
  stubDownloads, type DownloadStub, type User,
} from './looks-harness.tsx'

beforeEach(() => {
  startLooksTest()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

async function paste(user: User, text: string): Promise<void> {
  await user.click(share().getByLabelText(IMPORT_FIELD_LABEL))
  await user.paste(text)
  await user.click(share().getByRole('button', { name: IMPORT_LABEL }))
}

describe('Export and Import', () => {
  let stub: DownloadStub

  beforeEach(() => {
    stub = stubDownloads()
  })

  // The Blob URL is let go a moment after the click: wait for it while the stub is still in place.
  afterEach(async () => {
    if (stub.downloads.length > 0) await waitFor(() => expect(stub.revoke).toHaveBeenCalledWith(BLOB_URL), { timeout: 2000 })
    stub.restore()
  })

  it("Export saves the active look, edits included, as the host's <id>.look.json", async () => {
    const user = userEvent.setup()
    renderEditor()
    await lookHeld(ARC)
    await user.click(group('Background').getByRole('button', { name: 'Navy' }))
    await user.click(share().getByRole('button', { name: EXPORT_LABEL }))
    expect(stub.downloads).toEqual([{ href: BLOB_URL, download: 'arc.look.json' }])
    expect(stub.blobs[0]?.type).toBe('application/json')
    expect(JSON.parse(await blobText(stub.blobs[0] as Blob))).toEqual({ ...ARC, ground: 'navy' })
    expect(share().getByRole('status')).toHaveTextContent(exportStarted('arc.look.json'))
  })

  it('a look round-trips through its file: the exported text imports as a saved look, made the active one', async () => {
    const user = userEvent.setup()
    renderEditor()
    await lookHeld(ARC)
    await user.click(group(/^Accent/).getByRole('button', { name: 'Gold' }))
    await user.click(share().getByRole('button', { name: EXPORT_LABEL }))
    const text = await blobText(stub.blobs[0] as Blob)
    await paste(user, text)
    const imported: HudLook = { ...ARC, accent: 'gold', id: 'imported-1' }
    expect(savedLooks()).toEqual([imported])
    await lookHeld(imported)
    expect(share().getByRole('status')).toHaveTextContent(importedLine(ARC.name))
    expect(share().getByLabelText(IMPORT_FIELD_LABEL)).toHaveValue('')
    expect(looksRow().getAllByRole('button')).toHaveLength(PRESETS.length + 1)
    expect(looksRow().getAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  it("shows the host's reasons for a look it refuses, and adds nothing", async () => {
    const user = userEvent.setup()
    renderEditor()
    await lookHeld(ARC)
    await paste(user, JSON.stringify({ ...ARC, schema: 'nope', accent: 'teal', script: 'x' }))
    const alert = await share().findByRole('alert')
    expect(alert).toHaveTextContent(NOT_DONE)
    expect(alert).toHaveTextContent(`"script" isn't part of a Look. Remove it.`)
    expect(alert).toHaveTextContent(`This isn't a v1 Look: "schema" must be "automatos-interface-look/v1".`)
    expect(alert).toHaveTextContent(`"accent" must be one of HUD's accents`)
    expect(savedLooks()).toEqual([])
    expect(looksRow().getAllByRole('button')).toHaveLength(PRESETS.length)
    expect(heldLook()).toEqual(ARC)
  })
})

describe('Export when it cannot', () => {
  it("says the download didn't start when the browser can't make the file, and logs why", async () => {
    const user = userEvent.setup()
    const original = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: () => {
        throw new Error('no object URLs here')
      },
    })
    try {
      renderEditor()
      await lookHeld(ARC)
      await user.click(share().getByRole('button', { name: EXPORT_LABEL }))
      expect(share().getByRole('alert')).toHaveTextContent(DOWNLOAD_FAILED)
      expect(console.error).toHaveBeenCalled()
    } finally {
      if (original) Object.defineProperty(URL, 'createObjectURL', original)
      else Reflect.deleteProperty(URL, 'createObjectURL')
    }
  })

  it("says the look can't be exported outside a look runtime", async () => {
    const user = userEvent.setup()
    render(editorTree())
    await user.click(share().getByRole('button', { name: EXPORT_LABEL }))
    expect(share().getByRole('alert')).toHaveTextContent(notExportable(ARC.name))
  })
})
