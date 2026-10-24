// PRD-261 A-13b (PRD-260 review F10, M24; WCAG 2.2.2 Pause, Stop, Hide): the Pause Auto control under
// Auto. Moved from core's components/mascot/__tests__/auto-mascot-pause.test.tsx and rewritten for E3g
// (PB-10): the pause flag lives in the SDK's storage area (lib/mascot/pause.ts), so a pause is read and
// made through the harness's storage area (packages/theme-harness) and another tab's through its storage event,
// and Auto's files come through the SDK's assetUrl from the package's assets/mascot/. It stops his loop
// (his still shows, his ring stops), it survives a state change, a remount and another tab, and under the
// OS reduced-motion setting he is the still with no control, since nothing moves. Until the host can say
// whether he is paused (E3g), he is the still and the control is disabled. jsdom plays no media:
// play() is a mock that resolves. Roles, attributes and text only (CSS modules are proxies).
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AutoMascot } from '../../src/components/mascot/auto-mascot.tsx'
import { PAUSE_AUTO } from '@automatos/mascot/mascot-pause-button'
import { PAUSE_KEY, PAUSE_STATE, setMascotPaused } from '../../src/lib/mascot/pause.ts'
import { CLIP_MS } from '@automatos/mascot/player'
import { readThemeState } from '@automatos/theme-sdk'
import { host } from '@automatos/theme-harness/host'

const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
/** Where the host serves the package's files from; Auto's sit under assets/mascot/ (@automatos/mascot's media.ts). */
const FILES_ROOT = '/api/themes/files/0123abcd/'
const MASCOT = `${FILES_ROOT}assets/mascot/`

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia')

function preferReducedMotion(matches: boolean): void {
  const matchMedia = vi.fn((media: string) => ({
    matches,
    media,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: matchMedia })
}

const pauseButton = () => screen.getByRole('button', { name: PAUSE_AUTO })
const stills = (container: HTMLElement) => Array.from(container.querySelectorAll('img'), (image) => image.getAttribute('src'))
const clips = (container: HTMLElement) => container.querySelectorAll('video')

/** jsdom has no play(): every <video> AutoMascot mounts gets this one. */
const mockPlay = () => vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
let play: ReturnType<typeof mockPlay>

beforeEach(() => {
  host.reset()
  host.setFilesRoot(FILES_ROOT)
  Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: CHROME })
  play = mockPlay()
})

afterEach(() => {
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia)
  else Reflect.deleteProperty(window, 'matchMedia')
  Reflect.deleteProperty(window.navigator, 'userAgent')
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Pause Auto (F10, WCAG 2.2.2)', () => {
  it('sits under a moving Auto, not pressed, while his clip plays and his ring pulses', () => {
    const { container } = render(<AutoMascot state="idle" />)
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'false')
    expect(clips(container)).toHaveLength(1)
    expect(container.firstElementChild).not.toHaveAttribute('data-motion')
  })

  it('is disabled while the host cannot say whether he is paused, then enabled, and a press pauses him (E3g)', () => {
    host.setStorage({ ready: false })
    const { container } = render(<AutoMascot state="idle" />)
    expect(pauseButton()).toBeDisabled()
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'false')
    expect(clips(container)).toHaveLength(0)
    expect(container.firstElementChild).toHaveAttribute('data-motion', 'still')
    act(() => {
      host.setStorage({ ready: true })
    })
    expect(pauseButton()).toBeEnabled()
    expect(clips(container)).toHaveLength(1)
    fireEvent.click(pauseButton())
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'true')
    expect(clips(container)).toHaveLength(0)
    expect(readThemeState(PAUSE_KEY, PAUSE_STATE)).toMatchObject({ ready: true, value: true })
  })

  it('stops the loop: his clip gives way to his still, his ring stops, nothing plays again, and the host keeps the pause', () => {
    const { container } = render(<AutoMascot state="reading" />)
    expect(play).toHaveBeenCalledTimes(1)
    fireEvent.click(pauseButton())
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'true')
    expect(clips(container)).toHaveLength(0)
    expect(stills(container)).toEqual([`${MASCOT}reading.png`])
    expect(container.firstElementChild).toHaveAttribute('data-motion', 'still')
    expect(play).toHaveBeenCalledTimes(1)
    expect(readThemeState(PAUSE_KEY, PAUSE_STATE)).toMatchObject({ ready: true, value: true, persisted: true })
  })

  it('survives a state change: the new state shows as a still at once, and a one-shot still ends on the timer', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const onClipEnded = vi.fn()
    const { container, rerender } = render(<AutoMascot state="idle" onClipEnded={onClipEnded} />)
    fireEvent.click(pauseButton())
    rerender(<AutoMascot state="working" onClipEnded={onClipEnded} />)
    expect(clips(container)).toHaveLength(0)
    expect(stills(container)).toEqual([`${MASCOT}working.png`])
    rerender(<AutoMascot state="celebrate" onClipEnded={onClipEnded} />)
    expect(stills(container)).toEqual([`${MASCOT}celebrate.png`])
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'true')
    act(() => {
      vi.advanceTimersByTime(CLIP_MS)
    })
    expect(onClipEnded).toHaveBeenCalledWith('celebrate')
  })

  it('survives a remount, and plays him again when pressed a second time', () => {
    const first = render(<AutoMascot state="idle" />)
    fireEvent.click(pauseButton())
    first.unmount()
    const { container } = render(<AutoMascot state="thinking" />)
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'true')
    expect(stills(container)).toEqual([`${MASCOT}thinking.png`])
    fireEvent.click(pauseButton())
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'false')
    expect(clips(container)[0]?.getAttribute('src')).toBe(`${MASCOT}thinking.webm`)
    expect(container.firstElementChild).not.toHaveAttribute('data-motion')
  })

  it('pauses every Auto on the page with one press, and follows a play made in another tab', () => {
    const { container } = render(
      <>
        <AutoMascot state="idle" />
        <AutoMascot state="searching" lightsPage={false} />
      </>,
    )
    fireEvent.click(screen.getAllByRole('button', { name: PAUSE_AUTO })[0] as HTMLElement)
    expect(clips(container)).toHaveLength(0)
    expect(stills(container)).toEqual([`${MASCOT}idle.png`, `${MASCOT}searching.png`])
    act(() => {
      host.changeInAnotherTab(PAUSE_KEY, undefined, PAUSE_STATE)
    })
    expect(clips(container)).toHaveLength(2)
  })

  it('stills the specimens too, and gives a decorative Auto no control of his own', () => {
    setMascotPaused(true)
    const { container } = render(<AutoMascot state="oops" showCaption={false} lightsPage={false} decorative />)
    expect(screen.queryByRole('button', { hidden: true })).toBeNull()
    expect(container.firstElementChild).toHaveAttribute('data-motion', 'still')
  })

  it('gives a still that was never asked to play (playing={false}) no control: nothing of his can move', () => {
    const { container } = render(<AutoMascot state="idle" playing={false} />)
    expect(screen.queryByRole('button', { name: PAUSE_AUTO })).toBeNull()
    expect(clips(container)).toHaveLength(0)
    // His ring stands still too: with no control here, an infinite pulse would fail 2.2.2.
    expect(container.firstElementChild).toHaveAttribute('data-motion', 'still')
  })

  it('drops his own control where the page stops him another way (pauseControl={false}), yet keeps his name and obeys the pause', () => {
    const preview = render(<AutoMascot state="celebrate" caption="Ta-da." pauseControl={false} />)
    expect(screen.queryByRole('button', { name: PAUSE_AUTO })).toBeNull()
    expect(screen.getByRole('img', { name: 'Ta-da.' })).toBeInTheDocument()
    expect(clips(preview.container)).toHaveLength(1)
    preview.unmount()

    setMascotPaused(true)
    const { container } = render(<AutoMascot state="celebrate" caption="Ta-da." pauseControl={false} />)
    expect(clips(container)).toHaveLength(0)
    expect(container.firstElementChild).toHaveAttribute('data-motion', 'still')
  })
})

describe('Auto under reduced motion: the still', () => {
  it('shows the still with his ring stopped and no Pause control, since nothing moves', () => {
    preferReducedMotion(true)
    const { container } = render(<AutoMascot state="working" />)
    expect(clips(container)).toHaveLength(0)
    expect(stills(container)).toEqual([`${MASCOT}working.png`])
    expect(container.firstElementChild).toHaveAttribute('data-motion', 'still')
    expect(screen.queryByRole('button', { name: PAUSE_AUTO })).toBeNull()
    expect(play).not.toHaveBeenCalled()
  })
})
