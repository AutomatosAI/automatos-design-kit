// Play 1.1.1: the asleep screen keeps the host's header utilities. It replaces the whole frame while the backend
// doesn't answer, header and all, so the theme menu and the profile went with it; its top row now draws the SDK's
// HeaderUtilities (Help, notifications, the theme menu and the account) beside "Not connected", the stand-in's clicks
// kept by the fake host.
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ASLEEP_TITLE, AsleepScreen, NOT_CONNECTED } from '../../src/components/play/edges/asleep-screen.tsx'
import { PlayFrameSlot } from '../../src/play-slots.tsx'
import { host } from '@automatos/theme-harness/host'

vi.mock('../../src/components/play/shell/play-sidebar.tsx', async () => {
  const { createElement } = await import('react')
  return { PlaySidebar: () => createElement('nav', { 'aria-label': 'Main' }) }
})
vi.mock('../../src/components/mascot/auto-mascot.tsx', async () => {
  const { createElement } = await import('react')
  return { AutoMascot: ({ state }: { readonly state: string }) => createElement('div', { 'data-testid': 'auto', 'data-state': state }) }
})

const UTILITIES = 'Header utilities'

beforeEach(() => {
  host.reset()
})

describe('the asleep screen keeps the header utilities (Play 1.1.1)', () => {
  it("draws the host's utilities in its top row, beside Not connected, and their clicks reach the host", () => {
    render(<AsleepScreen mascot="sleeping" detail="Automatos didn't answer." onCheck={vi.fn()} checking={false} recheckSeconds={10} local={false} />)
    const top = screen.getByRole('banner')
    expect(within(top).getByRole('status')).toHaveTextContent(NOT_CONNECTED)
    const utilities = within(top).getByRole('group', { name: UTILITIES })
    expect(utilities).toHaveAttribute('data-protected-surface', 'header-utilities')
    fireEvent.click(within(utilities).getByRole('button', { name: 'Theme' }))
    fireEvent.click(within(utilities).getByRole('button', { name: 'Account' }))
    expect(host.cardActions()).toEqual([
      { card: 'header-utilities', id: 'Theme', action: 'opened' },
      { card: 'header-utilities', id: 'Account', action: 'opened' },
    ])
  })

  it('keeps them when the frame swaps to the asleep screen, so the theme menu stays in reach', () => {
    render(
      <PlayFrameSlot>
        <p>The page</p>
      </PlayFrameSlot>,
    )
    act(() => host.setHealth('down'))
    expect(screen.getByRole('heading', { level: 1, name: ASLEEP_TITLE })).toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getByRole('group', { name: UTILITIES })).toBeInTheDocument()
    expect(screen.queryByText('The page')).toBeNull()
  })
})
