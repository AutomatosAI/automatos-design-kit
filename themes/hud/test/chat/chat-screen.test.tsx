// The core screen's own parts around the conversation, on the harness: the host's first-run nudge (the local
// edition's) heads the conversation's column, above its title, and never sits with the message box. Roles, names,
// the host's surface marks and the document's order only.
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { box, renderChat, stubClips } from './support.tsx'

/** The host's first-run nudge: its protected surface, as the harness's stand-in marks it. */
const nudgeIn = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-protected-surface="first-run-nudge"]')

const title = (): HTMLElement => screen.getByRole('heading', { level: 1 })

beforeEach(() => {
  host.reset()
  stubClips()
})

describe("the host's first-run nudge", () => {
  it("heads the conversation's column, above its title, apart from the message box", async () => {
    await renderChat()
    const nudge = nudgeIn()
    if (nudge === null) throw new Error('No first-run nudge on the local edition.')
    const column = nudge.parentElement
    expect(column?.firstElementChild).toBe(nudge)
    expect(column).toContainElement(title())
    expect(nudge.compareDocumentPosition(title()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const footer = column?.lastElementChild ?? null
    expect(footer).toContainElement(box())
    expect(footer).not.toContainElement(nudge)
  })

  it('is not drawn on the hosted edition', async () => {
    host.setEdition('saas')
    await renderChat()
    expect(nudgeIn()).toBeNull()
  })
})
