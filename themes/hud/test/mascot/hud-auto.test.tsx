// Auto in HUD's slot, on the kit's harness: his ring's tone for each of his 12 states (Mascot.dc.html's colours, the
// accent while calm or busy), nothing at all while the look's auto is off, his still with no control while the look's
// motion is off or the OS asks for reduced motion, and his clip with the Pause Auto control otherwise, which pauses
// him (the SDK's storage area keeps the flag) and makes him a still. The frame's dock shows him in the backend's state.
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { captionFor } from '@automatos/mascot/media'
import { MASCOT_STATES, type MascotName } from '@automatos/mascot/types'
import { host } from '@automatos/theme-harness/host'
import { dockState } from '../../src/frame/auto-dock.tsx'
import { ARC, GHOST } from '../../src/lib/looks/presets.ts'
import type { HudLook } from '../../src/lib/looks/types.ts'
import { HudAuto } from '../../src/mascot/hud-auto.tsx'

const PAUSE = 'Pause Auto'
const FILES_ROOT = '/api/themes/files/0123abcd/'
const RING_TONE: Readonly<Record<MascotName, string>> = {
  hello: 'light', idle: 'light', listening: 'light', celebrate: 'light',
  thinking: 'accent', working: 'accent', searching: 'accent', reading: 'accent',
  oops: 'error', sleeping: 'dusk', lost: 'dusk', loading: 'quiet',
}

function withLook(look: HudLook): void {
  host.setLooks({ look })
}

function stage(state: MascotName): HTMLElement {
  return screen.getByRole('img', { name: captionFor(state) })
}

beforeEach(() => {
  host.reset()
  host.setFilesRoot(FILES_ROOT)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
})

describe("Auto's ring", () => {
  it.each([...MASCOT_STATES])('%s: the tone of his state, and his state in words', (state) => {
    withLook(ARC)
    render(<HudAuto state={state} playing={false} />)
    expect(stage(state)).toHaveAttribute('data-ring', RING_TONE[state])
    expect(screen.getByText(captionFor(state), { selector: 'p' })).toHaveAttribute('aria-live', 'polite')
  })
})

describe('the look decides', () => {
  it("draws nothing while the look's auto is off", () => {
    withLook(GHOST)
    const { container } = render(<HudAuto state="idle" />)
    expect(container).toBeEmptyDOMElement()
  })

  it("is his still, with no control, while the look's motion is off", () => {
    withLook({ ...ARC, motion: 'off' })
    const { container } = render(<HudAuto state="idle" />)
    expect(container.querySelector('video')).toBeNull()
    expect(container.querySelector('img')).toHaveAttribute('src', `${FILES_ROOT}assets/mascot/idle.png`)
    expect(screen.queryByRole('button', { name: PAUSE })).toBeNull()
  })

  it('is his still, with no control, under the reduced-motion setting', () => {
    withLook(ARC)
    host.setReducedMotion(true)
    const { container } = render(<HudAuto state="idle" />)
    expect(container.querySelector('video')).toBeNull()
    expect(screen.queryByRole('button', { name: PAUSE })).toBeNull()
  })
})

describe('the Pause Auto control', () => {
  it('plays his clip under the control, and pausing makes him a still', () => {
    withLook(ARC)
    const { container } = render(<HudAuto state="idle" />)
    expect(container.querySelector('video')).not.toBeNull()
    const pause = screen.getByRole('button', { name: PAUSE })
    expect(pause).toHaveAttribute('aria-pressed', 'false')
    act(() => fireEvent.click(pause))
    expect(screen.getByRole('button', { name: PAUSE })).toHaveAttribute('aria-pressed', 'true')
    expect(container.querySelector('video')).toBeNull()
  })

  it('is disabled, and he is a still, until the host can say whether he is paused', () => {
    withLook(ARC)
    host.setStorage({ ready: false })
    const { container } = render(<HudAuto state="idle" />)
    expect(container.querySelector('video')).toBeNull()
    expect(screen.getByRole('button', { name: PAUSE })).toBeDisabled()
  })
})

describe("the frame's dock", () => {
  it("shows the backend's state: ready, loading while asked, asleep while down", () => {
    expect([dockState('connected'), dockState('checking'), dockState('down')]).toEqual(['idle', 'loading', 'sleeping'])
  })
})
