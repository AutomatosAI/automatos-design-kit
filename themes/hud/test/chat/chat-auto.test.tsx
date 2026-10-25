// Auto on the core, driven by the turn (@automatos/mascot's reducer, as Mascot.dc.html maps his states): at rest
// before anything is asked, thinking once you send and while the model reasons, searching while a web search runs
// (the chip names its query), back at rest once the tool ends, celebrating a done receipt at the turn's end, oops on
// a failure, listening while an approval card waits, asleep while the backend is down and napping after a long
// while without input. The chip says each state in words; with the look's auto knob off Auto is gone and the chip
// stays. Pause Auto stands beside the chip, clear of the rings, while Auto can move. The core's data-state is the
// state he shows; the chip is read by its text.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captionFor } from '@automatos/mascot/media'
import { host, LIVE_KEY } from '@automatos/theme-harness/host'
import { AWAITING_ANSWER, NAPPING, OPENING } from '../../src/chat/chip.ts'
import { HudChatPage } from '../../src/chat/hud-chat.tsx'
import { IDLE_MS } from '../../src/chat/use-idle-timeout.ts'
import { GHOST } from '../../src/lib/looks/presets.ts'
import {
  ask, core, dataPart, failure, HELD, renderChat, reply, stubClips, toolData, toolEnd, toolStart, words,
} from './support.tsx'

/** The state chip: the core's polite live region. */
function chip(): HTMLElement {
  const found = core().querySelector<HTMLElement>('[aria-live="polite"]')
  if (found === null) throw new Error('The core has no state chip.')
  return found
}
const stateIs = (state: string) => waitFor(() => expect(core()).toHaveAttribute('data-state', state))

beforeEach(() => {
  host.reset()
  stubClips()
})

describe("Auto's state per turn", () => {
  it('is at rest before anything is asked, and thinks once you send', async () => {
    await renderChat([HELD])
    expect(core()).toHaveAttribute('data-state', 'idle')
    expect(chip()).toHaveTextContent(captionFor('idle'))
    ask()
    await stateIs('thinking')
    expect(chip()).toHaveTextContent(captionFor('thinking'))
  })

  it('searches while a web search runs, the chip naming its query, and rests once it ends', async () => {
    await renderChat([{ frames: [toolStart('t1', 'platform_web_search', { query: 'budget laptops' })], hold: true }])
    ask()
    await stateIs('searching')
    expect(chip()).toHaveTextContent(`${captionFor('searching')} · budget laptops`)
    act(() => host.continueHeldTurn({ frames: [toolEnd({ toolCallId: 't1', toolName: 'platform_web_search', success: true }), words('Found three.')], hold: true }))
    await waitFor(() => expect(reply()).toHaveTextContent('Found three.'))
    await stateIs('idle')
  })

  it('thinks while the model reasons, and rests once his words start', async () => {
    await renderChat([{ frames: [dataPart('reasoning', { delta: 'Comparing battery life' })], hold: true }])
    ask()
    await stateIs('thinking')
    act(() => host.continueHeldTurn({ frames: [words('The second one lasts longer.')], hold: true }))
    await waitFor(() => expect(reply()).toHaveTextContent('The second one lasts longer.'))
    await stateIs('idle')
  })

  it('celebrates a done receipt once the turn ends, not before', async () => {
    const done = { action: 'platform_update_task', kind: 'write', status: 'done', subject: '#0422', effect: 'moved to Done', link: null, reason: null }
    await renderChat([{ frames: [toolData({ [LIVE_KEY]: { receipts: [done], above: [] } })], hold: true }])
    ask()
    await waitFor(() => expect(reply()).toHaveTextContent('#0422'))
    expect(core()).not.toHaveAttribute('data-state', 'celebrate')
    act(() => host.continueHeldTurn({ frames: [] }))
    await stateIs('celebrate')
    expect(chip()).toHaveTextContent(captionFor('celebrate'))
  })

  it('is oops on a reply that failed', async () => {
    await renderChat([{ frames: [failure({ message: 'The model did not answer in time.', code: 'model_timeout' })] }])
    ask()
    await stateIs('oops')
    expect(chip()).toHaveTextContent(captionFor('oops'))
  })

  it('listens while an approval card waits for your answer, and rests once you answer it', async () => {
    const approval = { grant_id: 42, action: 'platform_delete_document', message: 'Delete the old brief?' }
    await renderChat([{ frames: [toolData({ tool_approval: approval })], hold: true }])
    ask()
    await stateIs('listening')
    expect(chip()).toHaveTextContent(AWAITING_ANSWER)
    act(() => host.continueHeldTurn({ frames: [words('That needs your OK first.')] }))
    await waitFor(() => expect(reply()).toHaveTextContent('That needs your OK first.'))
    await act(async () => {
      fireEvent.click(within(reply()).getByRole('button', { name: /approve & run/i }))
    })
    await stateIs('idle')
  })

  it("sleeps while the backend is down, and says Automatos isn't running", async () => {
    await renderChat()
    act(() => host.setHealth('down'))
    await stateIs('sleeping')
    expect(chip()).toHaveTextContent(captionFor('sleeping'))
  })
})

describe('the nap', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('comes after a long while without input, and any input wakes him', () => {
    render(<HudChatPage />)
    act(() => {
      vi.advanceTimersByTime(IDLE_MS)
    })
    expect(core()).toHaveAttribute('data-state', 'sleeping')
    expect(chip()).toHaveTextContent(NAPPING)
    act(() => {
      fireEvent.keyDown(window, { key: 'a' })
    })
    expect(core()).toHaveAttribute('data-state', 'idle')
  })
})

describe('Pause Auto on the core', () => {
  const PAUSE = 'Pause Auto'
  const pauseIn = (): HTMLElement | null => within(core()).queryByRole('button', { name: PAUSE })

  it("stands beside the state chip, outside Auto's stage among the rings, and pausing makes him a still", async () => {
    await renderChat()
    const pause = pauseIn()
    if (pause === null) throw new Error('The core has no Pause Auto control.')
    expect(pause.parentElement).toBe(chip().parentElement)
    const stage = within(core()).getByRole('img', { name: `Auto: ${captionFor('idle')}` })
    expect(stage.parentElement).not.toContainElement(pause)
    expect(within(core()).getAllByRole('button', { name: PAUSE })).toHaveLength(1)
    expect(core().querySelector('video')).not.toBeNull()
    act(() => fireEvent.click(pause))
    expect(pauseIn()).toHaveAttribute('aria-pressed', 'true')
    expect(core().querySelector('video')).toBeNull()
  })

  it("is not drawn while Auto can't move: the look's auto off, or the reduced-motion setting", async () => {
    host.setLooks({ look: GHOST })
    const { unmount } = await renderChat()
    expect(pauseIn()).toBeNull()
    unmount()
    host.setLooks(null)
    host.setReducedMotion(true)
    await renderChat()
    expect(pauseIn()).toBeNull()
  })
})

describe('the look and the opening', () => {
  it("shows no Auto with the look's auto knob off, and the chip still says his state", async () => {
    host.setLooks({ look: GHOST })
    await renderChat()
    expect(within(core()).queryByRole('img')).toBeNull()
    expect(chip()).toHaveTextContent(captionFor('idle'))
  })

  it('loads in the core while the conversation opens, with no box to type in yet', () => {
    host.setChatOpening(true)
    render(<HudChatPage />)
    expect(core()).toHaveAttribute('data-state', 'loading')
    expect(chip()).toHaveTextContent(OPENING)
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
