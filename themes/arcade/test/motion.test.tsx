// Arcade's motion on a fake clock: a sprite steps through its frames every 3 ticks of 60 ms while motion is on, and
// holds its first frame under the OS's reduced motion, while the animation is paused, and before the host can say
// whether it is; the dialogue box types a reply out at Normal speed and Skip shows the rest at once.
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { host } from '@automatos/theme-harness/host'

import { AutoSprite } from '../src/art/pixel-art.tsx'
import { SPRITE_STATES } from '../src/art/states.ts'
import { Dialogue, SKIP } from '../src/chat/dialogue.tsx'
import { PAUSE_KEY } from '../src/motion/use-motion.ts'
import { SPRITE_TICKS, TICK_MS } from '../src/motion/clock.ts'

const idleFrames = SPRITE_STATES.find((state) => state.name === 'idle')?.frames ?? []
const rects = (): number => document.querySelectorAll('[data-state="idle"] rect').length

function frameShown(): number {
  const drawn = rects()
  return idleFrames.findIndex((frame) => frame.length === drawn)
}

beforeEach(() => {
  host.reset()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('a sprite', () => {
  it('steps through its loop while motion is on', () => {
    render(<AutoSprite state="idle" view="small" />)
    const seen = new Set<number>()
    for (let step = 0; step < idleFrames.length * 2; step += 1) {
      seen.add(rects())
      act(() => vi.advanceTimersByTime(TICK_MS * SPRITE_TICKS))
    }
    expect(seen.size).toBeGreaterThan(1)
  })

  it('holds its first frame under reduced motion', () => {
    host.setReducedMotion(true)
    render(<AutoSprite state="idle" view="small" />)
    act(() => vi.advanceTimersByTime(TICK_MS * SPRITE_TICKS * 3))
    expect(frameShown()).toBe(0)
  })

  it('holds its first frame while the animation is paused', () => {
    host.setStorage({ ready: true, persisted: true, themeId: 'automatos/arcade', userKey: 'local', workspaceKey: 'ws' })
    render(<AutoSprite state="idle" view="small" />)
    act(() => {
      host.changeInAnotherTab(PAUSE_KEY, true)
    })
    act(() => vi.advanceTimersByTime(TICK_MS * SPRITE_TICKS * 3))
    expect(frameShown()).toBe(0)
  })

  it('holds its first frame until the host can say whether it is paused', () => {
    host.setStorage({ ready: false, persisted: false, themeId: 'automatos/arcade', userKey: 'local', workspaceKey: 'ws' })
    render(<AutoSprite state="idle" view="small" />)
    act(() => vi.advanceTimersByTime(TICK_MS * SPRITE_TICKS * 3))
    expect(frameShown()).toBe(0)
  })
})

describe('the dialogue box', () => {
  const reply = {
    id: 'a1', role: 'assistant' as const, text: 'Your shortlist is in your bag.', knownParts: [], activity: [], error: null, writing: false,
    stopped: false, receipts: null, above: [], deliverables: [], approvals: [], taskCards: [], toolCalls: [], provenance: null,
    savedError: null, limitReached: null, reasoningChars: 0, withdrawOffer: null, linkedDeliverables: [],
  }

  function renderDialogue() {
    render(
      <Dialogue portrait="idle" phone={false} strip={null} saying={{ kind: 'reply', message: reply }} speed="normal" moving wholeIds={new Set()} />,
    )
  }

  it('types a new reply out, a character a tick, and Skip shows the rest', () => {
    renderDialogue()
    act(() => vi.advanceTimersByTime(TICK_MS * 4))
    expect(screen.queryByText(reply.text)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: SKIP }))
    expect(screen.getAllByText(reply.text).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: SKIP })).toBeNull()
  })

  it("never types the same words twice when a live reply is replaced by its saved copy", () => {
    const live = { ...reply, id: 'voice-live-assistant', text: 'Hello there.' }
    const saved = { ...reply, id: 'saved-1', text: 'Hello there. Your bag is ready.' }
    const props = { portrait: 'idle' as const, phone: false, strip: null, speed: 'normal' as const, moving: true, wholeIds: new Set<string>() }
    const { rerender } = render(<Dialogue {...props} saying={{ kind: 'reply', message: live }} />)
    act(() => vi.advanceTimersByTime(TICK_MS * (live.text.length + 2)))
    rerender(<Dialogue {...props} saying={{ kind: 'reply', message: saved }} />)
    expect(screen.getByText(/^Hello there\./)).toBeInTheDocument()
  })
})
