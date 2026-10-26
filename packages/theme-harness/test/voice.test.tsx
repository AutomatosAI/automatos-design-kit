// Theme voice (SDK 1.2.0): the fake voice area, read through the SDK as a theme reads it. useVoice is a frozen snapshot
// a test drives (the phase, the microphone, what was heard and replied, the error, what is available), the same object
// while nothing changed; readVoiceLevels answers the levels a test set while a session runs, clamped, and zeros
// otherwise; VoiceButton draws a real <button> under a root carrying core's data attributes, checks its props as core
// does, owns the session it started, shows the "AI voice assistant" caption and the stop control while it does (in a
// row that wraps, Stop, End call and Close each its icon and its word, as core's fix/voice-stop-label draws them), and its
// presses move the session; every stop() is counted, and host.reset() puts it all back.
import { readVoiceLevels, useVoice, VoiceButton, type HostVoiceState, type VoiceButtonProps } from '@automatos/theme-sdk'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Component, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { host, VOICE_DEFAULTS } from '../src/host.ts'
import { checkedVoiceButtonProps } from '../src/sdk/voice-button.tsx'

const ROOT = '[data-voice-button="root"]'
const CAPTION = 'AI voice assistant'

let seen: HostVoiceState[] = []

/** What a theme's voice strip reads, kept render by render. */
function Strip() {
  const voice = useVoice()
  seen = [...seen, voice]
  return (
    <p data-testid="strip">
      {`${voice.phase}:${voice.mode ?? 'none'}:${String(voice.micOpen)}:${voice.heard}:${voice.reply}:${voice.error ?? ''}`}
    </p>
  )
}

const strip = (): string | null => screen.getByTestId('strip').textContent

/** A stop control as core draws it: a plain button showing its word beside its icon, never the bare icon. */
function expectLabelled(control: HTMLElement, word: string): void {
  expect(control).toHaveAttribute('type', 'button')
  expect(control.textContent).toBe(word)
  expect(control.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
}
const rootOf = (button: HTMLElement): Element | null => button.closest(ROOT)
const attributeOf = (button: HTMLElement, name: string): string | null | undefined => rootOf(button)?.getAttribute(name)

/** Shows the error a child threw while rendering, as an alert. */
class Caught extends Component<{ readonly children: ReactNode }, { readonly error: Error | null }> {
  override state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  override render() {
    return this.state.error === null ? this.props.children : <p role="alert">{this.state.error.message}</p>
  }
}

beforeEach(() => {
  host.reset()
  seen = []
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useVoice', () => {
  it('starts with no session, the host voice on the page as VOICE_DEFAULTS offers it, frozen', () => {
    render(<Strip />)
    expect(strip()).toBe('idle:none:false:::')
    const [first] = seen
    expect(Object.isFrozen(first)).toBe(true)
    expect(first?.available).toEqual(VOICE_DEFAULTS)
    expect(Object.isFrozen(first?.available)).toBe(true)
  })

  it('renders again with what a test sets: the phase and engine, the microphone, the words and the error', () => {
    render(<Strip />)
    act(() => host.setVoicePhase('listening'))
    expect(strip()).toBe('listening:quick:true:::')
    act(() => host.setVoiceWords({ heard: 'What is on the board' }))
    act(() => host.setVoicePhase('speaking'))
    act(() => host.setVoiceWords({ reply: 'Three cards wait for you' }))
    expect(strip()).toBe('speaking:quick:false:What is on the board:Three cards wait for you:')
    act(() => host.setVoicePhase('thinking', 'live'))
    expect(strip()).toBe('thinking:live:true:What is on the board:Three cards wait for you:')
    act(() => host.setVoiceMic(true, true))
    expect(seen[seen.length - 1]?.muted).toBe(true)
    act(() => host.setVoiceError('The microphone stopped.'))
    expect(strip()).toBe('error:live:false:What is on the board:Three cards wait for you:The microphone stopped.')
    act(() => host.setVoice({ durationSec: 42, chatId: 'c-1' }))
    expect(seen[seen.length - 1]).toMatchObject({ durationSec: 42, chatId: 'c-1' })
  })

  it('hands back the same object while nothing changed', () => {
    const { rerender } = render(<Strip />)
    rerender(<Strip />)
    expect(seen).toHaveLength(2)
    expect(seen[1]).toBe(seen[0])
  })

  it('answers the idle snapshot with nothing available and the reason outside the host voice; stop() then does nothing', () => {
    host.setVoiceAvailable(null)
    host.setVoicePhase('listening')
    render(<Strip />)
    const voice = seen[seen.length - 1]
    expect(voice).toMatchObject({ phase: 'idle', mode: null, available: { quick: false, live: false, reason: "Voice isn't available on this page." } })
    voice?.stop()
    expect(host.voiceStops()).toBe(0)
  })

  it('counts every stop(), and ends the session as the host does: quick-ask back to idle, a Live call ended', () => {
    render(<Strip />)
    act(() => host.setVoicePhase('speaking'))
    act(() => seen[seen.length - 1]?.stop())
    expect(strip()).toBe('idle:none:false:::')
    act(() => host.setVoicePhase('listening', 'live'))
    act(() => seen[seen.length - 1]?.stop())
    expect(strip()).toBe('ended:live:false:::')
    expect(host.voiceStops()).toBe(2)
  })

  it('offers what a test sets: the defaults with the changes', () => {
    host.setVoiceAvailable({ live: true, reason: null })
    render(<Strip />)
    expect(seen[0]?.available).toEqual({ quick: true, live: true, reason: null })
  })
})

describe('readVoiceLevels', () => {
  it('answers zeros with no session, whatever a test set', () => {
    host.setVoiceLevels({ user: 0.7, agent: 0.2 })
    expect(readVoiceLevels()).toEqual({ user: 0, agent: 0 })
  })

  it('answers the levels a test set while a session runs, frozen, clamped to 0 to 1, and a value that is no number as 0', () => {
    host.setVoicePhase('listening')
    host.setVoiceLevels({ user: 0.7 })
    const levels = readVoiceLevels()
    expect(levels).toEqual({ user: 0.7, agent: 0 })
    expect(Object.isFrozen(levels)).toBe(true)
    host.setVoiceLevels({ agent: 2 })
    expect(readVoiceLevels()).toEqual({ user: 0.7, agent: 1 })
    host.setVoiceLevels({ user: -1, agent: Number.NaN })
    expect(readVoiceLevels()).toEqual({ user: 0, agent: 0 })
  })

  it('answers zeros once the session ends, and outside the host voice', () => {
    host.setVoicePhase('speaking')
    host.setVoiceLevels({ agent: 0.5 })
    expect(readVoiceLevels().agent).toBe(0.5)
    host.setVoicePhase('error')
    expect(readVoiceLevels().agent).toBe(0)
    host.setVoicePhase('speaking')
    host.setVoiceAvailable(null)
    expect(readVoiceLevels().agent).toBe(0)
  })
})

describe('VoiceButton', () => {
  it("draws a real button, named by what a press does, under a root with core's data attributes", () => {
    render(<VoiceButton />)
    const button = screen.getByRole('button', { name: 'Hold to talk' })
    expect(button.getAttribute('data-voice-button')).toBe('press')
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveAttribute('title', 'Hold to talk')
    const names = ['data-voice-state', 'data-voice-mode', 'data-voice-press', 'data-voice-size', 'data-voice-mic']
    expect(names.map((name) => attributeOf(button, name))).toEqual(['idle', 'quick', 'hold', 'md', 'closed'])
    expect(screen.queryByText(CAPTION)).toBeNull()
  })

  it('honours label, press, size and mode', () => {
    host.setVoiceAvailable({ live: true, reason: null })
    render(<VoiceButton label="Ask Auto" press="toggle" size="lg" />)
    const button = screen.getByRole('button', { name: 'Ask Auto' })
    expect(['data-voice-press', 'data-voice-size', 'data-voice-mode'].map((name) => attributeOf(button, name))).toEqual(['toggle', 'lg', 'live'])
    render(<VoiceButton press="toggle" mode="quick" />)
    expect(rootOf(screen.getByRole('button', { name: 'Talk to Auto' }))?.getAttribute('data-voice-mode')).toBe('quick')
  })

  it('titles a Live button with why Live cannot start', () => {
    render(<VoiceButton mode="live" />)
    expect(screen.getByRole('button', { name: 'Hold to talk' })).toHaveAttribute('title', VOICE_DEFAULTS.reason)
  })

  it('refuses a prop of the wrong kind, naming it, as core does', () => {
    const wrong = (props: Readonly<Record<string, unknown>>) => () => checkedVoiceButtonProps(props as VoiceButtonProps)
    expect(wrong({ mode: 'phone' })).toThrow(new TypeError('Automatos theme SDK: VoiceButton needs mode to be one of auto, quick, live.'))
    expect(wrong({ press: 'tap' })).toThrow('VoiceButton needs press to be one of hold, toggle.')
    expect(wrong({ size: 'xl' })).toThrow('VoiceButton needs size to be one of sm, md, lg.')
    expect(wrong({ label: ' ' })).toThrow('VoiceButton needs label to be some text.')
    expect(wrong({ conversation: 7 })).toThrow('VoiceButton needs conversation to be some text or null.')
    expect(wrong({ hotkey: 7 })).toThrow('VoiceButton needs hotkey to be some text or null.')
    expect(checkedVoiceButtonProps({ conversation: null, hotkey: null })).toMatchObject({ conversation: null, hotkey: null })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const bad = { size: 'xl' } as unknown as VoiceButtonProps
    render(<Caught><VoiceButton {...bad} /></Caught>)
    expect(screen.getByRole('alert')).toHaveTextContent('VoiceButton needs size to be one of sm, md, lg.')
  })

  it('a toggle starts on its conversation, sends on the next press, and keeps each press', () => {
    render(<VoiceButton press="toggle" conversation="c-1" />)
    const button = screen.getByRole('button', { name: 'Talk to Auto' })
    fireEvent.click(button)
    expect(attributeOf(button, 'data-voice-state')).toBe('listening')
    expect(attributeOf(button, 'data-voice-mic')).toBe('open')
    expect(button).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(button)
    expect(attributeOf(button, 'data-voice-state')).toBe('thinking')
    expect(host.voicePresses()).toEqual([
      { action: 'start', mode: 'quick', chatId: 'c-1' },
      { action: 'release', mode: 'quick', chatId: 'c-1' },
    ])
  })

  it('a hold starts on the press and sends on the release; a click no pointer made toggles', async () => {
    render(<VoiceButton />)
    const button = screen.getByRole('button', { name: 'Hold to talk' })
    await userEvent.setup().click(button)
    expect(host.voicePresses().map((press) => press.action)).toEqual(['start', 'release'])
    expect(attributeOf(button, 'data-voice-state')).toBe('thinking')
    act(() => host.setVoicePhase('idle'))
    fireEvent.click(button)
    expect(attributeOf(button, 'data-voice-state')).toBe('listening')
  })

  it('shows the AI voice caption, a tiny caption in a protected surface, and Stop while the session is its own', () => {
    render(<VoiceButton press="toggle" />)
    fireEvent.click(screen.getByRole('button', { name: 'Talk to Auto' }))
    const caption = screen.getByRole('note', { name: CAPTION })
    expect(caption).toHaveTextContent(CAPTION)
    expect(caption.closest('[data-protected-surface="voice-control"]')).not.toBeNull()
    expect(caption.style.fontSize).toBe('10px')
    expect([caption.style.background, caption.style.borderRadius, caption.style.padding]).toEqual(['', '', ''])
    expect(screen.getByText('Mic live')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Auto is listening. Mic live')
    const row = caption.parentElement as HTMLElement
    expect([row.style.display, row.style.flexWrap, row.style.columnGap, row.style.rowGap]).toEqual(['flex', 'wrap', '6px', '4px'])
    expect(row).toHaveTextContent(`${CAPTION}Mic liveStop`)
    const stop = screen.getByRole('button', { name: 'Stop' })
    expectLabelled(stop, 'Stop')
    expect([stop.style.height, stop.style.borderRadius, stop.style.fontSize]).toEqual(['28px', '9999px', '12px'])
    fireEvent.click(stop)
    expect(host.voiceStops()).toBe(1)
    expect(screen.queryByText(CAPTION)).toBeNull()
  })

  it("shows nothing of a session that isn't its own: another engine or another conversation", () => {
    host.setVoice({ chatId: 'c-2' })
    host.setVoicePhase('listening', 'live')
    render(<><VoiceButton mode="quick" /><VoiceButton conversation="c-1" /></>)
    expect(screen.queryByText(CAPTION)).toBeNull()
    expect(Array.from(document.querySelectorAll(ROOT), (root) => root.getAttribute('data-voice-state'))).toEqual(['idle', 'idle'])
  })

  it('a Live call ends with End call and closes with Close live voice, each showing its word', () => {
    host.setVoicePhase('speaking', 'live')
    render(<VoiceButton />)
    const end = screen.getByRole('button', { name: 'End call' })
    expectLabelled(end, 'End call')
    fireEvent.click(end)
    expect(rootOf(screen.getByRole('button', { name: 'Hold to talk' }))?.getAttribute('data-voice-state')).toBe('ended')
    const close = screen.getByRole('button', { name: 'Close live voice' })
    expectLabelled(close, 'Close')
    fireEvent.click(close)
    expect(host.voiceStops()).toBe(2)
  })

  it('names the microphone prompt while it connects, and a failure with Try again and Close', () => {
    host.setVoicePhase('connecting')
    const { rerender } = render(<VoiceButton />)
    expect(screen.getByText('Allow the microphone if your browser asks.')).toBeInTheDocument()
    act(() => host.setVoiceError('The microphone stopped.'))
    rerender(<VoiceButton />)
    expect(screen.getByRole('alert')).toHaveTextContent('The microphone stopped.')
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(rootOf(screen.getByRole('button', { name: 'Hold to talk' }))?.getAttribute('data-voice-state')).toBe('listening')
    expect(host.voicePresses()).toEqual([{ action: 'start', mode: 'quick', chatId: null }])
  })

  it('is drawn disabled outside the host voice, titled with the reason, and its presses reach nothing', () => {
    host.setVoiceAvailable(null)
    render(<VoiceButton />)
    const button = screen.getByRole('button', { name: 'Hold to talk' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', "Voice isn't available on this page.")
    fireEvent.click(button)
    expect(host.voicePresses()).toEqual([])
  })
})

describe('host.reset()', () => {
  it('puts the voice back: no session, the defaults, zero levels, nothing pressed or stopped', () => {
    host.setVoicePhase('listening')
    host.setVoiceLevels({ user: 0.5 })
    host.setVoiceAvailable({ live: true })
    render(<VoiceButton press="toggle" />)
    fireEvent.click(screen.getByRole('button', { name: 'Talk to Auto' }))
    act(() => host.reset())
    render(<Strip />)
    expect(strip()).toBe('idle:none:false:::')
    expect(seen[seen.length - 1]?.available).toEqual(VOICE_DEFAULTS)
    act(() => host.setVoicePhase('listening'))
    expect(readVoiceLevels()).toEqual({ user: 0, agent: 0 })
    expect([host.voiceStops(), host.voicePresses()]).toEqual([0, []])
  })
})
