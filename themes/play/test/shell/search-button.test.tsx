// Play 1.1.1: the header's search button. Its aria-label, "Open search (⌘K)", differed from what it shows, "Search ⌘K",
// which axe reported as serious on every view (label-content-name-mismatch, WCAG 2.5.3 Label in Name). Now it has no
// aria-label: its name is its visible text, and the shortcut is announced through aria-keyshortcuts.
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SEARCH_SHORTCUT } from '../../src/components/play/shell/play-frame.tsx'
import { PlayFrameSlot } from '../../src/play-slots.tsx'
import { host } from '@automatos/theme-harness/host'

vi.mock('../../src/components/play/shell/play-sidebar.tsx', async () => {
  const { createElement } = await import('react')
  return { PlaySidebar: () => createElement('aside', { 'data-testid': 'play-sidebar' }) }
})

const VISIBLE = 'Search ⌘K'

beforeEach(() => {
  host.reset()
})

describe("the header's search button (Play 1.1.1)", () => {
  it('is named by the words it shows, with no aria-label of its own', () => {
    render(
      <PlayFrameSlot>
        <p>The page</p>
      </PlayFrameSlot>,
    )
    const search = within(screen.getByRole('banner')).getByRole('button', { name: VISIBLE })
    expect(search).not.toHaveAttribute('aria-label')
    expect(search.textContent?.replace(/\s+/g, ' ').trim()).toBe(VISIBLE)
  })

  it('announces the ⌘K shortcut through aria-keyshortcuts, and still opens the global search', () => {
    render(
      <PlayFrameSlot>
        <p>The page</p>
      </PlayFrameSlot>,
    )
    const search = screen.getByRole('button', { name: VISIBLE })
    expect(SEARCH_SHORTCUT).toBe('Meta+K')
    expect(search).toHaveAttribute('aria-keyshortcuts', SEARCH_SHORTCUT)
    fireEvent.click(search)
    expect(host.globalSearchOpens()).toBe(1)
  })
})
