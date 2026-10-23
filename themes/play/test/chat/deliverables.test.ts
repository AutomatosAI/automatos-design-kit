// @vitest-environment node
/**
 * PRD-260 §4, K8 — the Deliverable a turn made, as the card inline in Auto's reply links it. P260-FX-09
 * (M76): only a checked id goes into the link, and the card links the core's own page relatively.
 *
 * Moved from core's components/play/chat/__tests__/deliverables.test.ts and rewritten for the kit. Every
 * case there ran on core's lib/chat/deliverables.ts, the host's: which Deliverables a turn made (a done
 * receipt's link read for its id, the document tool's data), and core's lib/chat/__tests__/deliverables.test.ts
 * holds them all (W-L1). A theme gets those Deliverables from the SDK already read and checked (a message's
 * deliverables and linkedDeliverables). What Play keeps is its copy of the link
 * (src/components/play/chat/deliverable-link.ts), asserted here on the ids the core's cases read from their
 * links; test/copied-from-core.test.ts holds the copy to core's.
 */
import { describe, expect, it } from 'vitest'

import { deliverableHref, isDeliverableId } from '../../src/components/play/chat/deliverable-link.ts'

const ID = '9b2f4c1e-7a3d-4e5f-8a90-1b2c3d4e5f60'

describe("deliverableHref: the core's page for one Deliverable", () => {
  it("links the core's page relatively, whatever origin the receipt named", () => {
    expect(deliverableHref('d-7')).toBe('/deliverables?deliverable=d-7')
    expect(deliverableHref(ID)).toBe(`/deliverables?deliverable=${ID}`)
  })
})

describe('isDeliverableId: an id that can go in a link', () => {
  it('refuses the ids that cannot go in a link: a path, a climb out of the page, none at all', () => {
    expect(['d-7', ID].filter((id) => !isDeliverableId(id))).toEqual([])
    expect(['a/b', '../../admin', ''].filter(isDeliverableId)).toEqual([])
  })
})
