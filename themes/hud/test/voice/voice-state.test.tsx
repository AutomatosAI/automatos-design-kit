// Auto's state in words while a voice session runs, on HUD's core screen on the kit's harness: the state chip under the
// core (desktop and phone) and the phone's top line say "Listening" while the microphone is open, then "Thinking" and
// "Speaking", the one time HUD says Listening; while the session connects and once it ends they say the chat's state
// again. Roles, names and text only; every value is made up.
import { act, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { captionFor } from '@automatos/mascot/media'
import { host } from '@automatos/theme-harness/host'
import { HudChatPage } from '../../src/chat/hud-chat.tsx'
import { core, openChat, renderChat, stubClips } from '../chat/support.tsx'
import { PHONE_WIDTH, resetWindowWidth, setWindowWidth } from '../support/window-width.ts'

/** The state chip: the core's polite live region. */
function chip(): HTMLElement {
  const found = core().querySelector<HTMLElement>('[aria-live="polite"]')
  if (found === null) throw new Error('The core has no state chip.')
  return found
}

const IDLE = captionFor('idle')

beforeEach(() => {
  host.reset()
  stubClips()
})

afterEach(() => {
  resetWindowWidth()
})

describe('on the desktop', () => {
  it("says the session's phase in the chip while it listens, thinks and speaks, then the chat's state", async () => {
    await renderChat()
    expect(chip()).toHaveTextContent(IDLE)
    act(() => host.setVoicePhase('connecting'))
    expect(chip()).toHaveTextContent(IDLE)
    act(() => host.setVoicePhase('listening'))
    expect(chip()).toHaveTextContent('Listening')
    expect(within(core()).getByRole('img', { name: 'Auto: Listening' })).toBeInTheDocument()
    act(() => host.setVoicePhase('thinking'))
    expect(chip()).toHaveTextContent('Thinking')
    act(() => host.setVoicePhase('speaking'))
    expect(chip()).toHaveTextContent('Speaking')
    act(() => host.setVoicePhase('idle'))
    expect(chip()).toHaveTextContent(IDLE)
  })

  it("follows a Live call's phases and says the chat's state once it ends or fails", async () => {
    await renderChat()
    act(() => host.setVoicePhase('speaking', 'live'))
    expect(chip()).toHaveTextContent('Speaking')
    act(() => host.setVoicePhase('listening', 'live'))
    expect(chip()).toHaveTextContent('Listening')
    act(() => host.setVoicePhase('ended', 'live'))
    expect(chip()).toHaveTextContent(IDLE)
    act(() => host.setVoicePhase('listening', 'live'))
    act(() => host.setVoiceError('The microphone stopped.'))
    expect(chip()).toHaveTextContent(IDLE)
  })
})

describe('on the phone', () => {
  it("says Auto and the session's phase in the top line and the chip, then Auto's own state again", async () => {
    setWindowWidth(PHONE_WIDTH)
    openChat()
    render(<HudChatPage />)
    await screen.findByText('Auto · Ready')
    act(() => host.setVoicePhase('listening'))
    expect(screen.getByText('Auto · Listening')).toBeInTheDocument()
    expect(chip()).toHaveTextContent('Listening')
    act(() => host.setVoicePhase('thinking'))
    expect(screen.getByText('Auto · Thinking')).toBeInTheDocument()
    act(() => host.setVoicePhase('speaking'))
    expect(screen.getByText('Auto · Speaking')).toBeInTheDocument()
    expect(chip()).toHaveTextContent('Speaking')
    act(() => host.setVoicePhase('idle'))
    expect(screen.getByText('Auto · Ready')).toBeInTheDocument()
    expect(screen.queryByText('Auto · Listening')).toBeNull()
  })
})
