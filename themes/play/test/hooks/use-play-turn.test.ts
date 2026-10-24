/**
 * PRD-261 A-11a (M28) — Play's turn is the chat controller's, and its events
 * reach Auto as the PRD-260 chat dispatched them: turn-failed is Auto's error
 * (FAILED_TURN, with the reply's code), every other event goes as it is.
 *
 * Moved from core's hooks/__tests__/use-play-turn.test.ts as it was, but for its imports: the hook and Auto's
 * events are the theme's own (src/hooks/use-play-turn.ts, and @automatos/mascot's events.ts, Play's
 * src/lib/mascot/events.ts before PRD-261 B-01i), and the turn events are the SDK's HostChatTurnEvent.
 */
import { describe, expect, it } from 'vitest'

import { mascotEventOf } from '../../src/hooks/use-play-turn.ts'
import { FAILED_TURN } from '@automatos/mascot/events'

describe("Play's turn events, as Auto plays them", () => {
  it("makes a reply that failed in words Auto's error, with its code", () => {
    expect(mascotEventOf({ type: 'turn-failed', code: 'timeout' })).toEqual({ type: 'error', message: FAILED_TURN, code: 'timeout' })
    expect(mascotEventOf({ type: 'turn-failed', code: null })).toEqual({ type: 'error', message: FAILED_TURN, code: null })
  })

  it('passes a new Deliverable and the approval events on unchanged', () => {
    expect(mascotEventOf({ type: 'deliverable-added' })).toEqual({ type: 'deliverable-added' })
    expect(mascotEventOf({ type: 'approval-waiting' })).toEqual({ type: 'approval-waiting' })
    expect(mascotEventOf({ type: 'approval-settled' })).toEqual({ type: 'approval-settled' })
  })
})
