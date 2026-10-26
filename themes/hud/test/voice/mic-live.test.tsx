// MIC LIVE in HUD's top bars, on the kit's harness: shown exactly while the host's voice session has the microphone
// open (quick-ask while it listens, a Live call for the whole call), MIC MUTED on a muted call, gone once it shuts;
// its words in a polite status that is always in the bar, so a screen reader hears it open and shut, and the chip the
// eye sees hidden from assistive technology. On the desktop it stands after the connection status, before search; on
// the phone it takes the connection status's place while the microphone is open. Nothing shows outside the host's
// voice. Roles, names and attributes only.
import { act, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { HudFrameSlot } from '../../src/slots/frame.tsx'
import { MIC_LIVE, MIC_MUTED } from '../../src/voice/session.ts'
import { PHONE_WIDTH, resetWindowWidth, setWindowWidth } from '../support/window-width.ts'

const TOP_BAR = 'Top bar'
const SEARCH = /^Search\s*⌘K$/
const CHIP_WORDS = /^●\s*Mic (?:live|muted)$/i

const bar = (): HTMLElement => screen.getByRole('banner', { name: TOP_BAR })
const statuses = (): HTMLElement[] => within(bar()).getAllByRole('status')
const connection = (): HTMLElement | undefined => statuses().find((status) => status.hasAttribute('data-connection'))

/** MIC LIVE's status: the bar's status that names no connection. */
function micStatus(): HTMLElement {
  const found = statuses().find((status) => !status.hasAttribute('data-connection'))
  if (found === undefined) throw new Error('No MIC LIVE status in the top bar.')
  return found
}

/** The chip the eye sees: the glyph, then MIC LIVE's words. */
const micChip = (): HTMLElement | null =>
  within(bar()).queryByText((_, element) => element?.getAttribute('aria-hidden') === 'true' && CHIP_WORDS.test(element.textContent ?? ''))

function renderFrame() {
  return render(
    <HudFrameSlot fullBleed>
      <p>The page the host hands the frame</p>
    </HudFrameSlot>,
  )
}

beforeEach(() => {
  host.reset()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
})

afterEach(() => {
  resetWindowWidth()
})

describe('MIC LIVE on the desktop', () => {
  it('shows only while the microphone is open, its status always in the bar and saying so', () => {
    renderFrame()
    const status = micStatus()
    expect(status).toHaveTextContent(/^$/)
    expect(micChip()).toBeNull()
    act(() => host.setVoicePhase('listening'))
    expect(micStatus()).toBe(status)
    expect(status).toHaveTextContent(MIC_LIVE)
    expect(micChip()).toHaveAttribute('aria-hidden', 'true')
    act(() => host.setVoicePhase('thinking'))
    expect(status).toHaveTextContent(/^$/)
    expect(micChip()).toBeNull()
    act(() => host.setVoicePhase('idle'))
    expect(micChip()).toBeNull()
  })

  it('shows for the whole of a Live call, says MIC MUTED while it is muted, and goes when the call ends', () => {
    renderFrame()
    act(() => host.setVoicePhase('speaking', 'live'))
    expect(micStatus()).toHaveTextContent(MIC_LIVE)
    act(() => host.setVoiceMic(true, true))
    expect(micStatus()).toHaveTextContent(MIC_MUTED)
    expect(micChip()).toHaveTextContent(/mic muted/i)
    act(() => host.setVoicePhase('ended', 'live'))
    expect(micChip()).toBeNull()
    expect(micStatus()).toHaveTextContent(/^$/)
  })

  it('stands after the connection status and before search, the status still saying the connection', () => {
    renderFrame()
    act(() => host.setVoicePhase('listening'))
    const chip = micChip()
    if (chip === null) throw new Error('No MIC LIVE chip while the microphone is open.')
    const search = within(bar()).getByRole('button', { name: SEARCH })
    expect(connection()?.compareDocumentPosition(chip)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(chip.compareDocumentPosition(search)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(connection()).toHaveTextContent('Local · online')
  })

  it("shows nothing outside the host's voice", () => {
    host.setVoiceAvailable(null)
    host.setVoicePhase('listening')
    renderFrame()
    expect(micChip()).toBeNull()
    expect(micStatus()).toHaveTextContent(/^$/)
  })
})

describe('MIC LIVE on the phone', () => {
  beforeEach(() => setWindowWidth(PHONE_WIDTH))

  it("takes the connection status's place while the microphone is open, and gives it back once it shuts", () => {
    renderFrame()
    expect(connection()).toHaveTextContent(/^● ?online$/)
    expect(micChip()).toBeNull()
    act(() => host.setVoicePhase('listening'))
    expect(micChip()).not.toBeNull()
    expect(micStatus()).toHaveTextContent(MIC_LIVE)
    expect(connection()).toBeUndefined()
    act(() => host.setVoicePhase('thinking'))
    expect(micChip()).toBeNull()
    expect(connection()).toHaveTextContent(/^● ?online$/)
  })
})
