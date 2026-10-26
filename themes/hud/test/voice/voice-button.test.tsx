// HUD's voice button on the kit's harness (the SDK's VoiceButton stand-in, core's DOM in plain colours), wrapped here to
// keep the props HUD hands it. On the desktop it stands in the middle of the design's waveform over the message box:
// hold to talk, Live where it can start (mode auto), Space as its key, talking into the conversation on screen; the
// design's hint is under it at rest and gives way to the host's caption and stop control while the session is the
// button's; nothing locks it, the box's AI label fence included. On the phone it fills the control row between TYPE and
// STOP: hold to talk, mode auto, no key, the large size, HOLD TO TALK under it at rest. TYPE and STOP still work beside
// it, and STOP ends a voice session too. Roles, names and attributes only; every value is made up.
import type { VoiceButtonProps } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { HudChatPage } from '../../src/chat/hud-chat.tsx'
import { CONTROLS_LABEL, STOP_LABEL, TYPE_LABEL } from '../../src/chat/phone/phone-controls.tsx'
import { HOLD_WORDS, PHONE_VOICE_BUTTON } from '../../src/chat/phone/voice-slot.tsx'
import { DESKTOP_VOICE_BUTTON, VOICE_DECK_LABEL, VOICE_HINT } from '../../src/voice/voice-deck.tsx'
import { DESKTOP_BARS, PHONE_BARS } from '../../src/voice/wave.ts'
import { box, openChat, renderChat, stubClips } from '../chat/support.tsx'
import { PHONE_WIDTH, resetWindowWidth, setWindowWidth } from '../support/window-width.ts'

/** Every VoiceButton HUD drew, with its props, newest last. */
const seen = vi.hoisted(() => ({ buttons: [] as readonly VoiceButtonProps[] }))

// The host's voice button is the harness's stand-in, wrapped to keep the props HUD hands it (the hotkey is a prop
// the stand-in checks but draws nothing of).
vi.mock('@automatos/theme-sdk', async (importOriginal) => {
  const sdk = await importOriginal<typeof import('@automatos/theme-sdk')>()
  const { createElement } = await import('react')
  return {
    ...sdk,
    VoiceButton: (props: VoiceButtonProps) => {
      seen.buttons = [...seen.buttons, props]
      return createElement(sdk.VoiceButton, props)
    },
  }
})

const HOLD_TO_TALK = 'Hold to talk'
const CAPTION = 'AI voice assistant'

const latestProps = (): VoiceButtonProps | undefined => seen.buttons[seen.buttons.length - 1]
const deck = (): HTMLElement => screen.getByRole('group', { name: VOICE_DECK_LABEL })
const rootOf = (press: HTMLElement): Element | null => press.closest('[data-voice-button="root"]')
const controls = (): HTMLElement => screen.getByRole('group', { name: CONTROLS_LABEL })
const typeButton = (): HTMLElement => within(controls()).getByRole('button', { name: TYPE_LABEL })
/**
 * HUD's STOP, by its word: the host's voice button draws a Stop of its own while the session is the button's (core
 * #1339's labelled row), inside the button's root, so HUD's is the one outside it.
 */
const stopButton = (): HTMLElement => {
  const hudStops = within(controls())
    .getAllByText(STOP_LABEL, { selector: 'button' })
    .filter((button) => button.closest('[data-voice-button="root"]') === null)
  if (hudStops.length !== 1) throw new Error(`expected HUD's one STOP, found ${hudStops.length}`)
  return hudStops[0]
}
/** The design's hint, as one line of text. */
const hint = (): HTMLElement | null =>
  within(deck()).queryByText((_, element) => element?.tagName === 'P' && element.textContent === VOICE_HINT)

/** The stored conversation on a phone's screen, once your words show. */
async function renderPhoneChat(): Promise<void> {
  setWindowWidth(PHONE_WIDTH)
  openChat()
  render(<HudChatPage />)
  await screen.findByRole('article', { name: 'You said' })
}

beforeEach(() => {
  host.reset()
  stubClips()
  seen.buttons = []
})

afterEach(() => {
  resetWindowWidth()
})

describe('on the desktop', () => {
  it('stands over the message box: hold to talk, Live where it can start, Space as its key, into the conversation on screen', async () => {
    await renderChat()
    const press = within(deck()).getByRole('button', { name: HOLD_TO_TALK })
    expect(DESKTOP_VOICE_BUTTON).toEqual({ mode: 'auto', press: 'hold', hotkey: 'Space', size: 'md' })
    expect(latestProps()).toEqual(DESKTOP_VOICE_BUTTON)
    expect(latestProps()).not.toHaveProperty('conversation')
    expect(rootOf(press)).toHaveAttribute('data-voice-press', 'hold')
    expect(rootOf(press)).toHaveAttribute('data-voice-size', 'md')
    expect(deck().compareDocumentPosition(box()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(deck().parentElement).toContainElement(box())
  })

  it('starts Auto Live where it can, and quick-ask where Live is not set up, on the conversation on screen', async () => {
    host.setVoiceAvailable({ live: true, reason: null })
    const live = await renderChat()
    expect(rootOf(within(deck()).getByRole('button', { name: HOLD_TO_TALK }))).toHaveAttribute('data-voice-mode', 'live')
    live.unmount()
    host.setVoiceAvailable({ live: false })
    await renderChat()
    const press = within(deck()).getByRole('button', { name: HOLD_TO_TALK })
    expect(rootOf(press)).toHaveAttribute('data-voice-mode', 'quick')
    fireEvent.click(press)
    expect(host.voicePresses()).toEqual([{ action: 'start', mode: 'quick', chatId: 'c1' }])
  })

  it("stands in the middle of the design's waveform, half its 72 bars on each side, the newest level beside it", async () => {
    await renderChat()
    const halves = Array.from(deck().querySelectorAll('[data-entry]'))
    expect(halves.map((half) => [half.getAttribute('data-entry'), half.children.length])).toEqual([
      ['end', DESKTOP_BARS / 2],
      ['start', DESKTOP_BARS / 2],
    ])
    const press = within(deck()).getByRole('button', { name: HOLD_TO_TALK })
    expect(halves[0].compareDocumentPosition(press) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(press.compareDocumentPosition(halves[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("says the design's hint under it at rest, Space in a key's box, and gives way to the host's caption and stop control", async () => {
    await renderChat()
    expect(hint()).not.toBeNull()
    expect(within(deck()).getByText('Space', { selector: 'kbd' })).toBeInTheDocument()
    act(() => host.setVoicePhase('listening'))
    expect(hint()).toBeNull()
    const caption = within(deck()).getByRole('note', { name: CAPTION })
    expect(caption.closest('[data-protected-surface="voice-control"]')).not.toBeNull()
    fireEvent.click(within(deck()).getByRole('button', { name: 'Stop' }))
    expect(host.voiceStops()).toBe(1)
    expect(hint()).not.toBeNull()
  })

  it("is never locked: the box's AI label fence disables the box alone, and the box stays to type in", async () => {
    host.setAiLabelShown(false)
    await renderChat()
    expect(box()).toBeDisabled()
    expect(within(deck()).getByRole('button', { name: HOLD_TO_TALK })).toBeEnabled()
    expect(within(deck()).getByRole('button', { name: HOLD_TO_TALK }).closest('fieldset')).toBeNull()
  })
})

describe('on the phone', () => {
  it('fills the control row between TYPE and STOP: hold to talk, Live where it can start, no key, the large size', async () => {
    await renderPhoneChat()
    const buttons = within(controls()).getAllByRole('button')
    expect(buttons).toHaveLength(3)
    expect(buttons[0]).toBe(typeButton())
    expect(buttons[1]).toHaveAccessibleName(HOLD_TO_TALK)
    expect(buttons[2]).toBe(stopButton())
    expect(PHONE_VOICE_BUTTON).toEqual({ mode: 'auto', press: 'hold', hotkey: null, size: 'lg' })
    expect(latestProps()).toEqual(PHONE_VOICE_BUTTON)
    expect(rootOf(buttons[1])).toHaveAttribute('data-voice-size', 'lg')
    expect(screen.queryByRole('group', { name: VOICE_DECK_LABEL })).toBeNull()
  })

  it("says HOLD TO TALK under it at rest, for the eye alone, and gives way to the host's control while a session runs", async () => {
    await renderPhoneChat()
    expect(within(controls()).getByText(HOLD_WORDS)).toHaveAttribute('aria-hidden', 'true')
    act(() => host.setVoicePhase('listening'))
    expect(within(controls()).queryByText(HOLD_WORDS)).toBeNull()
    expect(within(controls()).getByRole('note', { name: CAPTION })).toBeInTheDocument()
    const hostStop = within(controls()).getAllByRole('button', { name: 'Stop' }).find((button) => button !== stopButton())
    expect(hostStop?.closest('[data-protected-surface="voice-control"]')).not.toBeNull()
  })

  it("has the design's 44-bar waveform over the control row, the newest level at its middle", async () => {
    await renderPhoneChat()
    const wave = controls().previousElementSibling
    expect(wave).toHaveAttribute('data-entry', 'middle')
    expect(wave?.children).toHaveLength(PHONE_BARS)
  })

  it('keeps TYPE: it opens the message box while a voice session runs', async () => {
    await renderPhoneChat()
    act(() => host.setVoicePhase('listening'))
    fireEvent.click(typeButton())
    expect(typeButton()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('textbox', { name: 'Message Auto' })).toHaveFocus()
  })

  it('lets STOP end a voice session as it stops a reply, and hand the focus to TYPE once nothing runs', async () => {
    await renderPhoneChat()
    expect(stopButton()).toBeDisabled()
    act(() => host.setVoicePhase('speaking'))
    expect(stopButton()).toBeEnabled()
    fireEvent.click(stopButton())
    expect(host.voiceStops()).toBe(1)
    expect(stopButton()).toBeDisabled()
    expect(typeButton()).toHaveFocus()
    expect(host.chatSent()).toEqual([])
  })
})
