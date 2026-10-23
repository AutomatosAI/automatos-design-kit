// @vitest-environment node
// PRD-261 B-05a: the names the fake host (src/host.ts) gives a theme's own fixtures, so a theme's test builds the
// chat's parts as the fake chat reads and reports them, never with core's modules: the tool-data key the receipts
// frame rides under, which the fake's liveReceiptsOf reads as core's does (lib/chat/receipts.ts), and the code a
// request refused for used-up credits reports, the one the recorded refusal's body carries (fixtures/streams).
import type { HostReceipt } from '@automatos/theme-sdk'
import { describe, expect, it } from 'vitest'
import turnsFixture from '../fixtures/streams/turns.json'
import { CREDITS_EXHAUSTED_CODE, LIVE_KEY } from '../src/host.ts'
import { liveReceiptsOf } from '../src/sdk/chat.ts'

const RECEIPT: HostReceipt = {
  action: 'platform_web_search', kind: 'read', status: 'done', subject: 'laptops', effect: 'searched the web', link: null, reason: null,
}

describe("the chat's names a theme's fixtures use", () => {
  it('names the tool-data key the receipts frame rides under: liveReceiptsOf reads it there, and nowhere else', () => {
    expect(liveReceiptsOf({ type: 'tool-data', data: { [LIVE_KEY]: { receipts: [RECEIPT] } } })).toEqual({
      receipts: [RECEIPT], above: [], model: null,
    })
    expect(liveReceiptsOf({ type: 'tool-data', data: { [`${LIVE_KEY}-other`]: { receipts: [RECEIPT] } } })).toBeNull()
  })

  it('names the code a request refused for used-up credits reports, the one the recorded refusal carries', () => {
    expect(CREDITS_EXHAUSTED_CODE.length).toBeGreaterThan(0)
    expect(turnsFixture.turns.outOfCredits.body).toContain(CREDITS_EXHAUSTED_CODE)
  })
})
