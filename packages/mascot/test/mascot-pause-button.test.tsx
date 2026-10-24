/**
 * PRD-261 B-01i: the F10 Pause control (WCAG 2.2.2) as @automatos/mascot gives it to a theme. One name, "Pause Auto",
 * whether he is paused or not, with aria-pressed saying which; a press toggles; until the host can say whether he is
 * paused it is a native disabled button, which a press can't reach; and the classes on the button and its two-bar
 * icon are the theme's own, since the package brings no stylesheet. Play's own cases, the control under Auto with its
 * stylesheet, are Play's test/mascot/auto-mascot-pause.test.tsx.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MascotPauseButton, PAUSE_AUTO } from '../src/mascot-pause-button.tsx'

const noop = (): void => undefined

describe('MascotPauseButton', () => {
  it('keeps its one name and says by aria-pressed whether Auto is paused', () => {
    const { rerender } = render(<MascotPauseButton paused={false} onToggle={noop} />)
    expect(screen.getByRole('button', { name: PAUSE_AUTO }).getAttribute('aria-pressed')).toBe('false')
    rerender(<MascotPauseButton paused onToggle={noop} />)
    expect(screen.getByRole('button', { name: PAUSE_AUTO }).getAttribute('aria-pressed')).toBe('true')
  })

  it("toggles on a press, and while disabled is a native disabled button a press can't reach", () => {
    const onToggle = vi.fn()
    const { rerender } = render(<MascotPauseButton paused={false} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('button', { name: PAUSE_AUTO }))
    expect(onToggle).toHaveBeenCalledTimes(1)
    rerender(<MascotPauseButton paused={false} onToggle={onToggle} disabled />)
    const button = screen.getByRole('button', { name: PAUSE_AUTO }) as HTMLButtonElement
    fireEvent.click(button)
    expect([button.disabled, onToggle.mock.calls.length]).toEqual([true, 1])
  })

  it("wears the theme's classes on the button and its hidden icon, and none of its own", () => {
    const themed = <MascotPauseButton paused={false} onToggle={noop} className="play-pause" iconClassName="play-pause-icon" />
    const { container, rerender } = render(themed)
    const icon = screen.getByRole('button', { name: PAUSE_AUTO }).querySelector('span')
    expect([screen.getByRole('button').className, icon?.className, icon?.getAttribute('aria-hidden')]).toEqual(['play-pause', 'play-pause-icon', 'true'])
    rerender(<MascotPauseButton paused={false} onToggle={noop} />)
    expect(container.querySelectorAll('[class]')).toHaveLength(0)
  })
})
