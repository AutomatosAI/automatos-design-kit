/**
 * PRD-261 A-13b (F10, WCAG 2.2.2) — the Looks page's preview Auto is the one Auto on /looks: his clip plays and his
 * ring pulses, and nothing else on the page stops him. So he keeps his own Pause Auto control; a later
 * pauseControl={false} here would leave the page moving with no way to stop it. jsdom plays no media: play() is a
 * mock that resolves, as in the mascot tests.
 *
 * Moved from core's components/looks/__tests__/look-preview.test.tsx and rewritten for E3g (PRD-261 B-05e, PB-10):
 * the pause is the SDK storage area's mascot-paused, for the account (lib/mascot/pause.ts), read and made here
 * through the harness's storage area, where core's test cleared the automatos-play.mascot-paused key after each
 * case. Until the host can say whether he is paused the control is disabled; a pause made on this preview is the one
 * the next preview opens with. Auto's files are the package's (assets/mascot/, through assetUrl).
 */
import { readThemeState } from '@automatos/theme-sdk'
import { host } from '@automatos/theme-harness/host'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LookPreview, PREVIEW_CAPTION } from '../../src/components/looks/look-preview.tsx'
import { PAUSE_AUTO } from '@automatos/mascot/mascot-pause-button'
import { PAUSE_KEY, PAUSE_STATE } from '../../src/lib/mascot/pause.ts'
import { FILES_ROOT, MASCOT_FILES } from '../mascot/helpers.ts'

const pauseButton = () => screen.getByRole('button', { name: PAUSE_AUTO })
const clips = (container: HTMLElement) => Array.from(container.querySelectorAll('video'), (clip) => clip.getAttribute('src'))

beforeEach(() => {
  host.reset()
  host.setFilesRoot(FILES_ROOT)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('LookPreview — Auto can be paused where he moves (WCAG 2.2.2)', () => {
  it('offers the Pause Auto control under the preview Auto', () => {
    render(<LookPreview />)
    expect(screen.getByRole('img', { name: PREVIEW_CAPTION })).toBeInTheDocument()
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'false')
  })

  it("keeps his pause in the host's storage area: a press stills him, and the next preview opens paused (E3g)", () => {
    host.setStorage({ ready: false })
    const first = render(<LookPreview />)
    expect(pauseButton()).toBeDisabled()
    act(() => {
      host.setStorage({ ready: true })
    })
    expect(pauseButton()).toBeEnabled()
    expect(clips(first.container)).toEqual([`${MASCOT_FILES}celebrate.webm`])

    fireEvent.click(pauseButton())
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'true')
    expect(clips(first.container)).toEqual([])
    expect(readThemeState(PAUSE_KEY, PAUSE_STATE)).toMatchObject({ ready: true, value: true })
    first.unmount()

    const next = render(<LookPreview />)
    expect(pauseButton()).toHaveAttribute('aria-pressed', 'true')
    expect(clips(next.container)).toEqual([])
  })
})
